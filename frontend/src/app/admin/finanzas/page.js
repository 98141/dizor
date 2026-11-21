"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminFeedback from "@/components/admin/AdminFeedback";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import FinanceDashboard from "@/components/admin/FinanceDashboard";
import { formatCOP } from "@/lib/formatCurrency";
import {
  getFinanceHistory,
  getFinanceProducts,
  updateProductCost,
} from "@/services/financeAdminService";

/* ─── Semáforo de margen ─────────────────────────────── */
function MarginBadge({ pct }) {
  if (pct == null) return <span className="finance-badge finance-badge--missing">Sin costo</span>;
  if (pct < 20) return <span className="finance-badge finance-badge--danger">{pct}%</span>;
  if (pct < 40) return <span className="finance-badge finance-badge--warn">{pct}%</span>;
  return <span className="finance-badge finance-badge--ok">{pct}%</span>;
}

/* ─── Panel Costos y Precios ─────────────────────────── */
function CostPricesPanel() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all"); // all | missing | active
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loadError, setLoadError] = useState("");
  const lock = useRef(false);
  const costTrigger = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getFinanceProducts();
      setRows(data.products || []);
      setSummary(data.summary || null);
      setLoadError("");
    } catch {
      setLoadError("No se pudieron consultar los costos. No se presentan importes vacíos como datos confirmados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveCost = async (id) => {
    if (lock.current) return;
    const val = editValue.trim();
    const numVal = val === "" ? null : Number(val);
    if (val !== "" && (Number.isNaN(numVal) || numVal < 0)) {
      setIsError(true); setMessage("Ingresa un valor válido (número ≥ 0)");
      return;
    }
    lock.current = true; setSaving(true); setMessage("");
    try {
      await updateProductCost(id, numVal);
      setIsError(false); setMessage("Costo guardado");
      setEditingId(null);
      setEditValue("");
      await load();
    } catch (err) {
      setIsError(true); setMessage(err.response?.data?.message || "No se pudo guardar");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setMessage(""); setIsError(false);
    setEditingId(row.id);
    setEditValue(row.internalCost != null ? String(row.internalCost) : "");
  };
  const cancelCost = () => { if (lock.current) return; setEditingId(null); setEditValue(""); costTrigger.current?.focus(); };

  const filteredRows = rows.filter((r) => {
    if (filter === "missing") return r.internalCost == null;
    if (filter === "active") return r.isActive;
    return true;
  });

  if (loading) return <p className="auth-loading">Cargando productos…</p>;
  if (loadError) return <><AdminFeedback message={loadError} /><button type="button" className="admin-btn" onClick={load}>Reintentar costos</button></>;

  return (
    <div>
      <AdminFeedback id="finance-cost-feedback" message={message} variant={isError ? "error" : "success"} />
      {/* ── Stats ── */}
      {summary && (
        <div className="admin-stats admin-stats--compact" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">{formatCOP(summary.totalStockValue)}</p>
            <p className="admin-stat-card__label">Valor inventario (costo)</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{summary.avgMarginPct}%</p>
            <p className="admin-stat-card__label">Margen promedio</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{summary.total}</p>
            <p className="admin-stat-card__label">Productos totales</p>
          </div>
          {summary.missingCost > 0 && (
            <div className="admin-stat-card" style={{ borderColor: "#fbbf24" }}>
              <p className="admin-stat-card__value finance-warn">{summary.missingCost}</p>
              <p className="admin-stat-card__label">Sin costo registrado</p>
            </div>
          )}
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-md)", flexWrap: "wrap" }}>
        {[
          { key: "all", label: "Todos" },
          { key: "active", label: "Activos" },
          { key: "missing", label: "Sin costo" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`admin-btn admin-btn--sm${filter === key ? " admin-btn--primary" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={load}
        >
          Actualizar
        </button>
      </div>

      {/* ── Tabla ── */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Costo compra</th>
              <th>Precio venta</th>
              <th>Margen</th>
              <th>Valor stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
                  Sin productos
                </td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <tr key={row.id} style={{ opacity: row.isActive ? 1 : 0.55 }}>
                <td data-label="Producto">
                  <strong>{row.name}</strong>
                  {!row.isActive && (
                    <span className="admin-muted"> (inactivo)</span>
                  )}
                  <br />
                  <span className="admin-muted">{row.salesCount} vendido(s)</span>
                </td>
                <td data-label="Stock">
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        row.totalStock === 0
                          ? "var(--color-error)"
                          : row.totalStock < 3
                          ? "#b45309"
                          : "inherit",
                    }}
                  >
                    {row.totalStock}
                  </span>
                </td>
                <td data-label="Costo compra">
                  {editingId === row.id ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                      <input
                        aria-label="Costo de compra (COP)"
                        aria-invalid={isError ? true : undefined}
                        aria-describedby={message ? "finance-cost-feedback" : undefined}
                        disabled={saving}
                        type="number"
                        min="0"
                        step="1000"
                        className="auth-field__input"
                        style={{ width: "110px", padding: "0.35rem 0.5rem", fontSize: "0.85rem" }}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="0"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCost(row.id);
                          if (e.key === "Escape") cancelCost();
                        }}
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--primary"
                        onClick={() => handleSaveCost(row.id)}
                        disabled={saving}
                      >
                        Guardar costo
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        disabled={saving}
                        onClick={cancelCost}
                      >
                        Cancelar edición
                      </button>
                    </div>
                  ) : (
                    <span
                      style={{
                        color: row.internalCost == null ? "var(--color-error)" : "inherit",
                      }}
                    >
                      {row.internalCost != null ? formatCOP(row.internalCost) : "—"}
                    </span>
                  )}
                </td>
                <td data-label="Precio venta">{formatCOP(row.salePrice)}</td>
                <td data-label="Margen">
                  <MarginBadge pct={row.marginPct} />
                  {row.margin != null && (
                    <div className="admin-muted" style={{ fontSize: "0.75rem" }}>
                      {formatCOP(row.margin)} / ud.
                    </div>
                  )}
                </td>
                <td data-label="Valor stock">
                  {row.stockValue != null ? formatCOP(row.stockValue) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>
                <td data-label="Acciones">
                  {editingId !== row.id && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm"
                      disabled={saving}
                      onClick={(e) => { costTrigger.current = e.currentTarget; startEdit(row); }}
                    >
                      Editar costo
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Variantes expandidas ── */}
      <details style={{ marginTop: "var(--space-lg)" }}>
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--color-text-muted)",
          }}
        >
          Ver detalle por variante (talla/color/stock)
        </summary>
        <div className="admin-table-wrap" style={{ marginTop: "var(--space-md)" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Talla</th>
                <th>Color</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Precio variante</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.flatMap((row) =>
                row.variants.map((v) => (
                  <tr key={`${row.id}-${v.id}`}>
                    <td data-label="Producto">{row.name}</td>
                    <td data-label="Talla">{v.sizeName}</td>
                    <td data-label="Color">{v.colorName}</td>
                    <td data-label="SKU" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{v.sku}</td>
                    <td data-label="Stock"
                      style={{
                        fontWeight: 600,
                        color: v.stock === 0 ? "var(--color-error)" : "inherit",
                      }}
                    >
                      {v.stock}
                    </td>
                    <td data-label="Precio variante">
                      {v.price != null ? formatCOP(v.price) : (
                        <span className="admin-muted">Base ({formatCOP(row.salePrice)})</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ─── Historial financiero ───────────────────────────── */
const GROUP_OPTIONS = [
  { value: "day",   label: "Por día" },
  { value: "week",  label: "Por semana" },
  { value: "month", label: "Por mes" },
  { value: "year",  label: "Por año" },
];

function HistoryChart({ rows }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => r.totalRevenue), 1);
  return (
    <>
      <div className="finance-history-chart">
        {rows.map((row) => (
          <div key={row.periodKey} className="finance-history-chart__col">
            <div className="finance-history-chart__bars">
              <div
                className="finance-history-chart__bar finance-history-chart__bar--revenue"
                style={{ height: `${Math.max(4, (row.totalRevenue / max) * 120)}px` }}
                title={`Ingresos: ${formatCOP(row.totalRevenue)}`}
              />
              <div
                className="finance-history-chart__bar finance-history-chart__bar--profit"
                style={{ height: `${Math.max(row.grossProfit > 0 ? 4 : 0, (Math.max(0, row.grossProfit) / max) * 120)}px` }}
                title={`Ganancia: ${formatCOP(row.grossProfit)}`}
              />
            </div>
            <span className="finance-history-chart__label">{row.label}</span>
          </div>
        ))}
      </div>
      <div className="finance-history-legend">
        <span>
          <i className="finance-history-legend__dot finance-history-legend__dot--revenue" />
          Ingresos
        </span>
        <span>
          <i className="finance-history-legend__dot finance-history-legend__dot--profit" />
          Ganancia bruta
        </span>
      </div>
    </>
  );
}

function FinanceHistoryPanel() {
  const [groupBy, setGroupBy] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { groupBy };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await getFinanceHistory(params);
      setData(res);
    } catch {
      setData(null);
      setError("No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [groupBy, from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="auth-loading">Cargando historial…</p>;
  if (error) return (
    <div>
      <p style={{ color: "#b33" }}>{error}</p>
      <button type="button" className="admin-btn" onClick={load}>Reintentar</button>
    </div>
  );

  const { rows = [], summary } = data || {};

  return (
    <div>
      {/* ── Controles ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", alignItems: "flex-end", marginBottom: "var(--space-lg)" }}>
        <div className="finance-period-tabs">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`finance-period-tabs__btn${groupBy === opt.value ? " finance-period-tabs__btn--active" : ""}`}
              aria-pressed={groupBy === opt.value}
              onClick={() => setGroupBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", alignItems: "center", fontSize: "0.85rem" }}>
          <label htmlFor="finance-history-from" style={{ color: "var(--color-text-muted)" }}>Desde</label>
          <input
            id="finance-history-from"
            type="date"
            className="auth-field__input"
            style={{ padding: "0.3rem 0.5rem", fontSize: "0.82rem" }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label htmlFor="finance-history-to" style={{ color: "var(--color-text-muted)" }}>Hasta</label>
          <input
            id="finance-history-to"
            type="date"
            className="auth-field__input"
            style={{ padding: "0.3rem 0.5rem", fontSize: "0.82rem" }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {(from || to) && (
            <button
              type="button"
              className="admin-btn admin-btn--sm"
              onClick={() => { setFrom(""); setTo(""); }}
            >
              Limpiar
            </button>
          )}
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={load}
        >
          Actualizar
        </button>
      </div>

      {/* ── Resumen ── */}
      {summary && (
        <div className="admin-stats admin-stats--compact" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">{formatCOP(summary.totalRevenue)}</p>
            <p className="admin-stat-card__label">Ingresos totales</p>
          </div>
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">{formatCOP(summary.totalProfit)}</p>
            <p className="admin-stat-card__label">Ganancia bruta estimada</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{summary.grossMarginPct}%</p>
            <p className="admin-stat-card__label">Margen bruto</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{summary.totalOrders}</p>
            <p className="admin-stat-card__label">Pedidos totales</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{summary.periodsWithSales}</p>
            <p className="admin-stat-card__label">Períodos con ventas</p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="finance-empty">No hay datos en este período.</div>
      ) : (
        <>
          {/* ── Gráfico ── */}
          <HistoryChart rows={rows} />

          {/* ── Tabla detalle ── */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Pedidos</th>
                  <th>Ingresos</th>
                  <th>COGS</th>
                  <th>Ganancia bruta</th>
                  <th>Margen</th>
                  <th>Uds. vendidas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.periodKey}>
                    <td data-label="Período" style={{ fontWeight: 600 }}>{row.label}</td>
                    <td data-label="Pedidos">{row.ordersCount}</td>
                    <td data-label="Ingresos" style={{ fontWeight: 600 }}>{formatCOP(row.totalRevenue)}</td>
                    <td data-label="COGS">{formatCOP(row.cogs)}</td>
                    <td data-label="Ganancia bruta" style={{ color: row.grossProfit >= 0 ? "#065f46" : "#b91c1c", fontWeight: 600 }}>
                      {formatCOP(row.grossProfit)}
                    </td>
                    <td data-label="Margen">
                      {row.totalRevenue > 0 ? (
                        <MarginBadge pct={row.grossMarginPct} />
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td data-label="Uds. vendidas">{row.unitsSold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "var(--space-md)" }}>
            * Ganancia estimada con base en costos registrados. Pedidos sin costo de producto reducen la precisión del COGS.
            Este historial se genera desde los registros de pedidos y no puede ser eliminado.
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Página principal ───────────────────────────────── */
export default function FinanzasPage() {
  const [tab, setTab] = useState("resumen");

  return (
    <RoleRoute allowedRoles={["superadmin"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <div className="admin-page__header-row">
            <div>
              <h1 className="admin-page__title">Control financiero</h1>
              <p className="admin-page__subtitle">
                Ganancias, inventario, costos y precios. Acceso exclusivo superadmin.
              </p>
            </div>
            <Link href="/admin" className="admin-btn">
              ← Dashboard
            </Link>
          </div>

          {/* ── Tabs ── */}
          <div className="admin-view-tabs" style={{ marginBottom: "var(--space-lg)" }}>
            <button
              type="button"
              className={`admin-btn${tab === "resumen" ? " admin-btn--primary" : ""}`}
              aria-pressed={tab === "resumen"}
              onClick={() => setTab("resumen")}
            >
              Panel financiero
            </button>
            <button
              type="button"
              className={`admin-btn${tab === "costos" ? " admin-btn--primary" : ""}`}
              aria-pressed={tab === "costos"}
              onClick={() => setTab("costos")}
            >
              Costos y precios
            </button>
            <button
              type="button"
              className={`admin-btn${tab === "historial" ? " admin-btn--primary" : ""}`}
              aria-pressed={tab === "historial"}
              onClick={() => setTab("historial")}
            >
              Historial
            </button>
          </div>

          {tab === "resumen" && <FinanceDashboard />}
          {tab === "costos" && <CostPricesPanel />}
          {tab === "historial" && <FinanceHistoryPanel />}
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
