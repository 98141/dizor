"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getFinanceReport,
  exportFinanceCsv,
  exportFinanceXlsx,
  exportFinancePdf,
} from "@/services/financeAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { PAYMENT_METHOD_LABELS } from "@/lib/orderLabels";

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Últimos 7 días" },
  { value: "month", label: "Mes actual" },
  { value: "days30", label: "Últimos 30 días" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Año" },
  { value: "all", label: "Histórico" },
  { value: "custom", label: "Rango" },
];

const money = (value) => formatCOP(value || 0);
const units = (value) => new Intl.NumberFormat("es-CO").format(value || 0);

function profitCopy(sales) {
  if (!sales || sales.profitabilityStatus === "empty") {
    return { figure: money(0), label: "Ganancia bruta estimada", margin: sales?.ordersCount ? `${sales.grossMarginPct}%` : "—", pending: false };
  }
  if (sales.profitabilityStatus === "pending") {
    return { figure: "Pendiente", label: "Rentabilidad pendiente de completar costos", margin: "No verificable", pending: true };
  }
  if (sales.profitabilityStatus === "partial") {
    return {
      figure: money(sales.knownProfit),
      label: `Ganancia sobre costos conocidos · cobertura ${sales.costCoveragePct}%`,
      margin: sales.knownMarginPct == null ? "No verificable" : `${sales.knownMarginPct}% conocido`,
      pending: true,
    };
  }
  return { figure: money(sales.grossProfit), label: "Ganancia bruta estimada", margin: `${sales.grossMarginPct}%`, pending: false };
}

function TrendChart({ trend }) {
  if (!trend?.length) return <p className="finance-empty">Sin meses para comparar.</p>;
  const max = Math.max(...trend.map((row) => Math.max(row.productRevenue || 0, row.marginReliable ? row.grossProfit || 0 : 0)), 1);
  const width = 640;
  const height = 180;
  const step = width / trend.length;
  const x = (index) => step * index + step / 2;
  const y = (value) => height - 16 - ((value || 0) / max) * (height - 28);
  const line = (key) => trend.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  return (
    <div className="fn-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución de ventas conciliadas y de la ganancia cuando el costo está completo">
        <polyline points={line("productRevenue")} className="fn-chart__sales" fill="none" />
        {trend.map((row, index) => row.marginReliable && index > 0 && trend[index - 1].marginReliable ? (
          <line key={`p-${row.key || index}`} x1={x(index - 1)} y1={y(trend[index - 1].grossProfit)} x2={x(index)} y2={y(row.grossProfit)} className="fn-chart__profit" />
        ) : null)}
        {trend.map((row, index) => (
          <g key={row.key || row.month}>
            <circle cx={x(index)} cy={y(row.productRevenue)} r="3" className="fn-chart__sales" />
            <text x={x(index)} y={height - 2} textAnchor="middle" className="fn-chart__tick">{row.month}</text>
          </g>
        ))}
      </svg>
      <p className="fn-chart__legend"><span>Ventas de productos</span><span>Ganancia solo si el mes tiene costos completos</span></p>
      <table className="fn-chart-fallback">
        <caption>Cifras de la evolución</caption>
        <thead><tr><th>Mes</th><th>Ventas</th><th>Ganancia</th></tr></thead>
        <tbody>
          {trend.map((row) => (
            <tr key={row.key || row.month}>
              <td>{row.month}</td>
              <td>{money(row.productRevenue)}</td>
              <td>{row.marginReliable ? money(row.grossProfit) : "Pendiente de costos"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mix({ sales }) {
  const revenue = sales?.productRevenue || 0;
  const known = sales?.cogs || 0;
  const profit = sales?.marginReliable ? sales.grossProfit : sales?.knownProfit;
  const max = Math.max(revenue, known, profit || 0, 1);
  const row = (label, value, tone) => (
    <div className="fn-mix__row">
      <span>{label}</span>
      <span className="fn-mix__track"><span className={`fn-mix__bar fn-mix__bar--${tone}`} style={{ width: `${Math.max(2, ((value || 0) / max) * 100)}%` }} /></span>
      <strong>{value == null ? "Pendiente" : money(value)}</strong>
    </div>
  );
  return (
    <div className="fn-mix" aria-label="Ingresos, costos conocidos y rentabilidad">
      {row("Ingresos de productos", revenue, "sales")}
      {row("Costos conocidos", known, "cost")}
      {row(sales?.marginReliable ? "Ganancia verificada" : "Ganancia sobre costos conocidos", profit, "profit")}
      {!sales?.marginReliable && <p className="fn-note">La comparación no está completa: hay ventas sin costo registrado.</p>}
    </div>
  );
}

export default function FinanceDashboard() {
  const [range, setRange] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(null);
  const [retry, setRetry] = useState(0);
  const [seen, setSeen] = useState("");
  const ready = range !== "custom" || (from && to);
  const queryKey = ready ? `${range}|${from}|${to}|${retry}` : "wait";
  if (seen !== queryKey) {
    setSeen(queryKey);
    setLoading(ready);
    if (!ready) setError("");
  }

  useEffect(() => {
    if (!ready) return undefined;
    let cancel = false;
    const params = range === "custom" ? { from, to } : { range };
    getFinanceReport(params).then((res) => {
      if (!cancel) { setData(res); setError(""); }
    }).catch((err) => {
      if (cancel) return;
      setData(null);
      setError(err.response?.status === 403 ? "Solo el superadministrador puede ver finanzas." : err.response?.data?.message || "No se pudo cargar el panel financiero.");
    }).finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [queryKey, ready, range, from, to]);

  const handleExport = async (type) => {
    if (!ready) return;
    setExporting(type);
    try {
      const params = range === "custom" ? { from, to } : { range };
      if (type === "csv") await exportFinanceCsv(params);
      else if (type === "xlsx") await exportFinanceXlsx(params);
      else await exportFinancePdf(params);
    } catch {
      setError("No se pudo exportar el reporte. Intenta de nuevo.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <p className="auth-loading">Cargando finanzas...</p>;
  if (error && !data) {
    return <div className="finance-dashboard"><p role="alert">{error}</p><button type="button" className="admin-btn" onClick={() => setRetry((n) => n + 1)}>Reintentar</button></div>;
  }
  if (!data) return <p className="finance-empty">Elige las dos fechas del rango.</p>;

  const { sales, inventory, pending, paymentMethods, monthlyTrend, period: periodInfo } = data;
  const profit = profitCopy(sales);
  const investment = inventory.investmentTop || inventory.catalogSummary || [];

  return (
    <div className="finance-dashboard fn-dashboard">
      <div className="fn-toolbar">
        <p className="finance-period-label">{periodInfo?.label}</p>
        <div className="finance-period-tabs" role="group" aria-label="Periodo financiero">
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" className={`finance-period-tabs__btn${range === opt.value ? " finance-period-tabs__btn--active" : ""}`} aria-pressed={range === opt.value} onClick={() => setRange(opt.value)}>{opt.label}</button>
          ))}
        </div>
        {range === "custom" && (
          <div className="fn-range">
            <label htmlFor="finance-from">Desde</label>
            <input id="finance-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <label htmlFor="finance-to">Hasta</label>
            <input id="finance-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <div className="finance-export-btns">
          <button type="button" className="admin-btn admin-btn--sm" disabled={!!exporting || !ready} onClick={() => handleExport("csv")}>{exporting === "csv" ? "Exportando…" : "CSV"}</button>
          <button type="button" className="admin-btn admin-btn--sm" disabled={!!exporting || !ready} onClick={() => handleExport("xlsx")}>{exporting === "xlsx" ? "Exportando…" : "Excel"}</button>
          <button type="button" className="admin-btn admin-btn--sm" disabled={!!exporting || !ready} onClick={() => handleExport("pdf")}>{exporting === "pdf" ? "Exportando…" : "PDF"}</button>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {sales.ordersCount === 0 && <div className="finance-empty" role="status">No hay ventas conciliadas en este período. El inventario sigue visible. Los pendientes no se suman como ventas.</div>}
      {profit.pending && <p className="fn-note" role="status">Rentabilidad pendiente de completar costos. {units(sales.itemsMissingCost)} unidades vendidas no tienen costo. La ganancia verificable usa solo las líneas con costo.</p>}

      <section className="fn-kpis" aria-label="Indicadores principales">
        <article className="fn-kpi"><p>{money(sales.totalCollected)}</p><span>Ventas conciliadas</span></article>
        <article className="fn-kpi"><p>{units(sales.ordersCount)}</p><span>Pedidos conciliados</span></article>
        <article className="fn-kpi"><p>{units(sales.unitsSold)}</p><span>Unidades vendidas</span></article>
        <article className="fn-kpi"><p>{profit.figure}</p><span>{profit.label}</span></article>
        <article className="fn-kpi"><p>{profit.margin}</p><span>Margen según cobertura</span></article>
        <article className="fn-kpi"><p>{money(sales.cogs)}</p><span>COGS conocidos</span></article>
      </section>

      <div className="fn-split">
        <section>
          <h2>Evolución</h2>
          <TrendChart trend={monthlyTrend} />
        </section>
        <section>
          <h2>Costos y margen</h2>
          <Mix sales={sales} />
          <p className="fn-quiet">Ticket promedio {money(sales.averageOrderValue)}. Envío {money(sales.shippingCollected)}. Impuestos {money(sales.taxCollected)}. Descuentos {money(sales.discountsGiven)}.</p>
          <p className="fn-quiet">Por cobrar {money(pending.amount)} en {units(pending.ordersCount)} pedidos. No es dinero recibido.</p>
        </section>
      </div>

      <section>
        <h2>Inventario e inversión</h2>
        <p className="fn-quiet">El valor a costo suma solo existencias de variantes activas con costo registrado. El valor potencial multiplica esas existencias por el precio actual, incluidos los productos no publicados ({units(inventory.unpublishedUnits)} unidades). No es caja ni una venta.</p>
        <div className="fn-kpis fn-kpis--secondary">
          <article className="fn-kpi"><p>{money(inventory.investmentAtCost)}</p><span>Valor a costo conocido</span></article>
          <article className="fn-kpi"><p>{money(inventory.potentialRetail)}</p><span>Valor potencial de venta</span></article>
          <article className="fn-kpi"><p>{inventory.potentialMarginReliable ? money(inventory.potentialProfitKnown) : money(inventory.potentialProfitKnown)}</p><span>{inventory.potentialMarginReliable ? "Ganancia potencial estimada" : "Ganancia potencial solo con costo conocido"}</span></article>
          <article className="fn-kpi"><p>{units(inventory.unitsInStock)}</p><span>Unidades en variantes activas</span></article>
          <article className="fn-kpi"><p>{units(inventory.productsMissingCost)}</p><span>Productos sin costo</span><Link href="/admin/finanzas?tab=costos&costFilter=missing">Ver listado</Link></article>
        </div>
      </section>

      <div className="fn-split">
        <section>
          <h2>Mayor contribución de stock</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Producto</th><th>Stock</th><th>Costo</th><th>Potencial</th></tr></thead>
              <tbody>
                {(inventory.stockLeaders || []).map((row) => (
                  <tr key={row.id}>
                    <td data-label="Producto">{row.name}{row.isActive === false && <span className="admin-muted"> · no publicado</span>}</td>
                    <td data-label="Stock">{units(row.unitsInStock)}</td>
                    <td data-label="Costo">{row.costKnown ? money(row.internalCost) : "Sin costo"}</td>
                    <td data-label="Potencial">{money(row.potentialRetail)}</td>
                  </tr>
                ))}
                {!inventory.stockLeaders?.length && <tr><td colSpan={4}>Sin existencias.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Ventas conciliadas por método</h2>
          <p className="fn-quiet">Solo pedidos ya conciliados. La contraentrega pendiente está en «Por cobrar».</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Método</th><th>Pedidos</th><th>Total conciliado</th></tr></thead>
              <tbody>
                {(paymentMethods || []).map((row) => (
                  <tr key={row.method}><td data-label="Método">{PAYMENT_METHOD_LABELS[row.method] || row.method}</td><td data-label="Pedidos">{row.count}</td><td data-label="Total">{money(row.total)}</td></tr>
                ))}
                {!paymentMethods?.length && <tr><td colSpan={3}>Sin ventas conciliadas en el periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="fn-split">
        <section>
          <h2>Top por ingresos</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Producto</th><th>Uds</th><th>Ingresos</th><th>Ganancia</th></tr></thead>
              <tbody>
                {sales.topByRevenue?.length ? sales.topByRevenue.map((row) => (
                  <tr key={row.productId}><td data-label="Producto">{row.name}</td><td data-label="Uds">{units(row.units)}</td><td data-label="Ingresos">{money(row.revenue)}</td><td data-label="Ganancia">{row.costComplete ? money(row.profit) : "Pendiente"}</td></tr>
                )) : <tr><td colSpan={4}>Sin ventas en el período</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Top por ganancia verificable</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Producto</th><th>Margen</th><th>Ganancia</th></tr></thead>
              <tbody>
                {sales.topByProfit?.length ? sales.topByProfit.map((row) => (
                  <tr key={`${row.productId}-profit`}><td data-label="Producto">{row.name}</td><td data-label="Margen">{row.marginPct}%</td><td data-label="Ganancia">{money(row.profit)}</td></tr>
                )) : <tr><td colSpan={3}>No hay productos con costo completo en el periodo.</td></tr>}
              </tbody>
            </table>
          </div>
          {!!sales.missingCostProducts?.length && <p className="fn-quiet">{sales.missingCostProducts.length} productos vendidos siguen sin costo y no entran en este ranking.</p>}
        </section>
      </div>

      <section>
        <h2>Mayor inversión conocida</h2>
        <p className="fn-quiet">Primeros {investment.length} de {units(inventory.catalogCount || investment.length)} productos activos, por valor a costo. El resto se consulta en Costos y precios.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Producto</th><th>Stock</th><th>Costo</th><th>Valor conocido</th><th>Potencial</th></tr></thead>
            <tbody>
              {investment.map((row) => (
                <tr key={row.id}>
                  <td data-label="Producto">{row.name}</td>
                  <td data-label="Stock">{units(row.unitsInStock)}</td>
                  <td data-label="Costo">{row.internalCost != null ? money(row.internalCost) : "Sin costo"}</td>
                  <td data-label="Valor conocido">{row.costKnown || row.internalCost != null ? money(row.investmentAtCost) : "Sin costo"}</td>
                  <td data-label="Potencial">{money(row.potentialRetail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
