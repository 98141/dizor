"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getProductHistory,
  getProductHistoryStats,
  exportProductHistoryPdf,
} from "@/services/productHistoryService";
import {
  getProductEventLabel,
  PRODUCT_EVENT_CLASSES,
} from "@/lib/productHistoryLabels";

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function QtyCell({ change }) {
  if (change == null || change === 0) return <span>—</span>;
  const color = change > 0 ? "#166534" : "#991b1b";
  return (
    <span className="product-history-qty" style={{ color }}>
      {change > 0 ? `+${change}` : change}
    </span>
  );
}

function RefCell({ referenceType, referenceLabel }) {
  if (!referenceLabel && !referenceType) return <span>—</span>;

  const channelBadge =
    referenceType === "pos" ? (
      <span style={{
        display: "inline-block", padding: "0.1rem 0.35rem",
        background: "#e0e7ff", color: "#3730a3", borderRadius: "3px",
        fontSize: "0.65rem", fontWeight: 700, marginRight: "0.3rem", verticalAlign: "middle",
      }}>POS</span>
    ) : referenceType === "order" ? (
      <span style={{
        display: "inline-block", padding: "0.1rem 0.35rem",
        background: "#dcfce7", color: "#166534", borderRadius: "3px",
        fontSize: "0.65rem", fontWeight: 700, marginRight: "0.3rem", verticalAlign: "middle",
      }}>Web</span>
    ) : null;

  return <span>{channelBadge}{referenceLabel || "—"}</span>;
}

const EMPTY_FILTERS = { term: "", productId: "", eventType: "", from: "", to: "" };

export default function ProductHistoryList() {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ eventTypes: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const buildParams = useCallback((pg = page) => {
    const params = { page: pg, limit: 30 };
    if (filters.term.trim()) params.term = filters.term.trim();
    if (filters.productId) params.productId = filters.productId;
    if (filters.eventType) params.eventType = filters.eventType;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [page, filters]);

  const load = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const data = await getProductHistory(buildParams(pg));
      setHistory(data.history || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setFilterOptions(data.filters || { eventTypes: [], products: [] });
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams, page]);

  useEffect(() => {
    getProductHistoryStats()
      .then((res) => setStats(res.stats))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.productId, filters.eventType]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1);
  };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = { ...buildParams() };
      delete params.page;
      delete params.limit;
      await exportProductHistoryPdf(params);
    } catch {
      alert("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters =
    filters.term || filters.productId || filters.eventType || filters.from || filters.to;

  return (
    <div>
      {/* ── Stats ── */}
      {stats && (
        <div className="admin-stats admin-stats--compact" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.total.toLocaleString("es-CO")}</p>
            <p className="admin-stat-card__label">Movimientos totales</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.today}</p>
            <p className="admin-stat-card__label">Hoy</p>
          </div>
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">{stats.unitsSoldToday}</p>
            <p className="admin-stat-card__label">Unidades vendidas hoy</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.stockAdjustmentsToday}</p>
            <p className="admin-stat-card__label">Ajustes de stock hoy</p>
          </div>
        </div>
      )}

      {/* ── Filters + Export button ── */}
      <form
        className="orders-filters audit-filters"
        onSubmit={handleSearch}
        style={{ marginBottom: "0.75rem", alignItems: "center" }}
      >
        <input
          className="orders-filters__search"
          placeholder="Buscar producto, SKU, pedido, usuario..."
          value={filters.term}
          onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value }))}
        />
        <select
          value={filters.productId}
          onChange={(e) => { setFilters((f) => ({ ...f, productId: e.target.value })); setPage(1); }}
        >
          <option value="">Todos los productos</option>
          {filterOptions.products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.count})</option>
          ))}
        </select>
        <select
          value={filters.eventType}
          onChange={(e) => { setFilters((f) => ({ ...f, eventType: e.target.value })); setPage(1); }}
        >
          <option value="">Todos los tipos</option>
          {filterOptions.eventTypes.map((t) => (
            <option key={t} value={t}>{getProductEventLabel(t)}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          aria-label="Desde"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          aria-label="Hasta"
        />
        <button type="submit" className="admin-btn admin-btn--primary">Buscar</button>
        {hasActiveFilters && (
          <button type="button" className="admin-btn" onClick={handleClear}>Limpiar</button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={handleExportPdf}
          disabled={exporting}
          title="Descarga el historial actual (con los filtros aplicados) como PDF no modificable"
          style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
        >
          {exporting ? "Generando PDF…" : "⬇ Descargar PDF"}
        </button>
      </form>

      {/* ── Result count + readonly notice ── */}
      {!loading && (
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
          {total.toLocaleString("es-CO")} registro{total !== 1 ? "s" : ""}
          {hasActiveFilters ? " con los filtros aplicados" : " en total"}
          {" · "}
          <span style={{ fontStyle: "italic" }}>
            Solo lectura — este historial no es modificable
          </span>
        </p>
      )}

      {/* ── Table ── */}
      {loading ? (
        <p className="auth-loading">Cargando historial...</p>
      ) : history.length === 0 ? (
        <p className="admin-page__subtitle">
          No hay movimientos registrados con los filtros actuales.
          Los nuevos productos, ventas y cambios de stock aparecerán aquí automáticamente.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table product-history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Variante / SKU</th>
                <th>Mov.</th>
                <th>Stock</th>
                <th>Referencia</th>
                <th>Detalle</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td>
                    <span className={`product-event-badge ${PRODUCT_EVENT_CLASSES[row.eventType] || ""}`}>
                      {getProductEventLabel(row.eventType)}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: "0.83rem" }}>{row.productName}</strong>
                    {row.productSlug && (
                      <div className="product-history-meta">{row.productSlug}</div>
                    )}
                  </td>
                  <td>
                    {row.sku ? (
                      <>
                        <div style={{ fontSize: "0.82rem", fontFamily: "monospace" }}>{row.sku}</div>
                        {(row.sizeName || row.colorName) && (
                          <div className="product-history-meta">
                            {[row.sizeName, row.colorName].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="product-history-meta">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <QtyCell change={row.quantityChange} />
                  </td>
                  <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                    {row.stockBefore != null || row.stockAfter != null ? (
                      <span>
                        {row.stockBefore ?? "—"}{" "}
                        <span style={{ color: "var(--color-text-muted)" }}>→</span>{" "}
                        {row.stockAfter ?? "—"}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    <RefCell referenceType={row.referenceType} referenceLabel={row.referenceLabel} />
                  </td>
                  <td
                    style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", maxWidth: "200px" }}
                    title={row.summary || ""}
                  >
                    {row.summary || "—"}
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                    {row.userEmail || "Sistema / cliente"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="catalog-pagination" style={{ marginTop: "1.5rem" }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
