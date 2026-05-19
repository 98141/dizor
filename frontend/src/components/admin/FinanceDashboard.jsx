"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getFinanceReport,
  exportFinanceCsv,
  exportFinanceXlsx,
  exportFinancePdf,
} from "@/services/financeAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { PAYMENT_METHOD_LABELS } from "@/lib/orderLabels";

const PERIOD_OPTIONS = [
  { value: "week", label: "7 días" },
  { value: "month", label: "Mes actual" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Año" },
  { value: "all", label: "Histórico" },
];

function TrendBars({ trend }) {
  if (!trend?.length) return null;
  const max = Math.max(...trend.map((t) => t.grossProfit || 0), 1);

  return (
    <div className="finance-trend">
      {trend.map((row) => (
        <div key={row.month} className="finance-trend__item">
          <div className="finance-trend__bar-wrap">
            <div
              className="finance-trend__bar finance-trend__bar--revenue"
              style={{
                height: `${Math.max(8, (row.productRevenue / max) * 100)}%`,
              }}
              title={`Ingresos: ${formatCOP(row.productRevenue)}`}
            />
            <div
              className="finance-trend__bar finance-trend__bar--profit"
              style={{
                height: `${Math.max(8, (row.grossProfit / max) * 100)}%`,
              }}
              title={`Ganancia: ${formatCOP(row.grossProfit)}`}
            />
          </div>
          <span className="finance-trend__label">{row.month}</span>
          <span className="finance-trend__meta">{row.orders} ped.</span>
        </div>
      ))}
      <div className="finance-trend__legend">
        <span>
          <i className="finance-trend__dot finance-trend__dot--revenue" /> Ingresos
        </span>
        <span>
          <i className="finance-trend__dot finance-trend__dot--profit" /> Ganancia bruta
        </span>
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getFinanceReport({ range });
      setData(res);
    } catch (err) {
      setData(null);
      const apiMsg = err.response?.data?.message;
      setError(
        err.response?.status === 403
          ? "Solo el superadministrador puede ver finanzas."
          : apiMsg || "No se pudo cargar el panel financiero."
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const params = { range };
      if (type === "csv") await exportFinanceCsv(params);
      else if (type === "xlsx") await exportFinanceXlsx(params);
      else await exportFinancePdf(params);
    } catch {
      setError("No se pudo exportar el reporte. Intenta de nuevo.");
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="auth-loading">Cargando finanzas...</p>;
  }

  if (error && !data) {
    return (
      <div className="finance-dashboard">
        <p style={{ color: "#b33" }}>{error}</p>
        <button type="button" className="btn btn--secondary" onClick={load}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) {
    return <p style={{ color: "#b33" }}>Sin datos</p>;
  }

  const { sales, inventory, pending, paymentMethods, monthlyTrend, notes, period: periodInfo } =
    data;

  return (
    <div className="finance-dashboard">
      <div className="admin-page__header-row">
        <div>
          <p className="finance-period-label">{periodInfo?.label}</p>
        </div>
        <div className="finance-toolbar">
          <div className="finance-period-tabs">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`finance-period-tabs__btn${range === opt.value ? " finance-period-tabs__btn--active" : ""}`}
                onClick={() => setRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="finance-export-btns">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={!!exporting}
              onClick={() => handleExport("csv")}
            >
              {exporting === "csv" ? "Exportando…" : "CSV"}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={!!exporting}
              onClick={() => handleExport("xlsx")}
            >
              {exporting === "xlsx" ? "Exportando…" : "Excel"}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={!!exporting}
              onClick={() => handleExport("pdf")}
            >
              {exporting === "pdf" ? "Exportando…" : "PDF"}
            </button>
          </div>
        </div>
      </div>

      {sales.ordersCount === 0 && (
        <div className="finance-empty" role="status">
          No hay ventas pagadas en este período. Los totales aparecen en cero; el
          inventario y la tendencia de meses anteriores siguen visibles.
        </div>
      )}

      {notes?.length > 0 && (
        <div className="finance-notes">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">Ventas y ganancias</h2>
        <div className="admin-stats">
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">{formatCOP(sales.grossProfit)}</p>
            <p className="admin-stat-card__label">Ganancia bruta estimada</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{sales.grossMarginPct}%</p>
            <p className="admin-stat-card__label">Margen bruto</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">
              {formatCOP(sales.productRevenue)}
            </p>
            <p className="admin-stat-card__label">Ingresos por productos</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{formatCOP(sales.cogs)}</p>
            <p className="admin-stat-card__label">Costo de ventas (COGS)</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">
              {formatCOP(sales.totalCollected)}
            </p>
            <p className="admin-stat-card__label">Total cobrado (pedidos)</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{sales.ordersCount}</p>
            <p className="admin-stat-card__label">Pedidos pagados</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{sales.unitsSold}</p>
            <p className="admin-stat-card__label">Unidades vendidas</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">
              {formatCOP(sales.averageOrderValue)}
            </p>
            <p className="admin-stat-card__label">Ticket promedio</p>
          </div>
        </div>
        <div className="finance-substats">
          <span>Envío cobrado: {formatCOP(sales.shippingCollected)}</span>
          <span>Impuestos: {formatCOP(sales.taxCollected)}</span>
          <span>Descuentos: {formatCOP(sales.discountsGiven)}</span>
          <span className={pending.amount > 0 ? "finance-warn" : ""}>
            Por cobrar: {formatCOP(pending.amount)} ({pending.ordersCount} ped.)
          </span>
          {sales.itemsMissingCost > 0 && (
            <span className="finance-warn">
              {sales.itemsMissingCost} uds vendidas sin costo registrado
            </span>
          )}
        </div>
      </section>

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">Tendencia (6 meses)</h2>
        <TrendBars trend={monthlyTrend} />
      </section>

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">Inventario e inversión</h2>
        <div className="admin-stats admin-stats--compact">
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">
              {formatCOP(inventory.investmentAtCost)}
            </p>
            <p className="admin-stat-card__label">Valor invertido (costo)</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">
              {formatCOP(inventory.potentialRetail)}
            </p>
            <p className="admin-stat-card__label">Valor venta potencial</p>
          </div>
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">
              {formatCOP(inventory.potentialProfit)}
            </p>
            <p className="admin-stat-card__label">Ganancia potencial stock</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{inventory.potentialMarginPct}%</p>
            <p className="admin-stat-card__label">Margen potencial</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{inventory.unitsInStock}</p>
            <p className="admin-stat-card__label">Unidades en stock</p>
          </div>
          {inventory.productsMissingCost > 0 && (
            <div className="admin-stat-card">
              <p className="admin-stat-card__value finance-warn">
                {inventory.productsMissingCost}
              </p>
              <p className="admin-stat-card__label">Productos sin costo</p>
            </div>
          )}
        </div>
      </section>

      <div className="finance-grid-2">
        <section className="admin-dashboard-section">
          <h2 className="admin-dashboard-section__title">Top por ingresos</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Uds</th>
                  <th>Ingresos</th>
                  <th>Ganancia est.</th>
                </tr>
              </thead>
              <tbody>
                {sales.topByRevenue?.length ? (
                  sales.topByRevenue.map((row) => (
                    <tr key={row.productId}>
                      <td>{row.name}</td>
                      <td>{row.units}</td>
                      <td>{formatCOP(row.revenue)}</td>
                      <td>{formatCOP(row.profit)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Sin ventas en el período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-dashboard-section">
          <h2 className="admin-dashboard-section__title">Top por ganancia</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Margen</th>
                  <th>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {sales.topByProfit?.length ? (
                  sales.topByProfit.map((row) => (
                    <tr key={`${row.productId}-profit`}>
                      <td>{row.name}</td>
                      <td>{row.marginPct}%</td>
                      <td>{formatCOP(row.profit)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>Sin datos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="finance-grid-2">
        <section className="admin-dashboard-section">
          <h2 className="admin-dashboard-section__title">Margen bajo (&lt;25%)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {inventory.lowMarginProducts?.length ? (
                  inventory.lowMarginProducts.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.unitsInStock}</td>
                      <td className="finance-warn">{row.marginPct}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>Ninguno crítico</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-dashboard-section">
          <h2 className="admin-dashboard-section__title">Pagos por método</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Pedidos</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods?.map((row) => (
                  <tr key={row.method}>
                    <td>
                      {PAYMENT_METHOD_LABELS[row.method] || row.method || "—"}
                    </td>
                    <td>{row.count}</td>
                    <td>{formatCOP(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">
          Mayor inversión en inventario
        </h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock</th>
                <th>Costo u.</th>
                <th>Inversión</th>
                <th>Venta pot.</th>
                <th>Ganancia pot.</th>
              </tr>
            </thead>
            <tbody>
              {inventory.catalogSummary?.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.unitsInStock}</td>
                  <td>
                    {row.internalCost != null
                      ? formatCOP(row.internalCost)
                      : "—"}
                  </td>
                  <td>{formatCOP(row.investmentAtCost)}</td>
                  <td>{formatCOP(row.potentialRetail)}</td>
                  <td>{formatCOP(row.potentialProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
