"use client";

import { useEffect, useState } from "react";
import {
  getProductHistory,
  getProductHistoryStats,
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

function formatQty(change) {
  if (!change) return "—";
  return change > 0 ? `+${change}` : String(change);
}

export default function ProductHistoryList() {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    eventTypes: [],
    products: [],
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    term: "",
    productId: "",
    eventType: "",
    from: "",
    to: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (filters.term.trim()) params.term = filters.term.trim();
      if (filters.productId) params.productId = filters.productId;
      if (filters.eventType) params.eventType = filters.eventType;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const data = await getProductHistory(params);
      setHistory(data.history || []);
      setTotalPages(data.totalPages || 1);
      setFilterOptions(data.filters || { eventTypes: [], products: [] });
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getProductHistoryStats()
      .then((res) => setStats(res.stats))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    load();
  }, [page, filters.productId, filters.eventType]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div>
      {stats && (
        <div className="admin-stats admin-stats--compact" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.total}</p>
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

      <form className="orders-filters audit-filters" onSubmit={handleSearch}>
        <input
          className="orders-filters__search"
          placeholder="Buscar producto, SKU, pedido..."
          value={filters.term}
          onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value }))}
        />
        <select
          value={filters.productId}
          onChange={(e) => {
            setFilters((f) => ({ ...f, productId: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Todos los productos</option>
          {filterOptions.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
        <select
          value={filters.eventType}
          onChange={(e) => {
            setFilters((f) => ({ ...f, eventType: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Todos los tipos</option>
          {filterOptions.eventTypes.map((t) => (
            <option key={t} value={t}>
              {getProductEventLabel(t)}
            </option>
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
        <button type="submit" className="admin-btn admin-btn--primary">
          Buscar
        </button>
      </form>

      {loading ? (
        <p className="auth-loading">Cargando historial...</p>
      ) : history.length === 0 ? (
        <p className="admin-page__subtitle">
          No hay movimientos registrados. Los nuevos productos, ventas y cambios
          de stock aparecerán aquí automáticamente.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table product-history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Variante</th>
                <th>Movimiento</th>
                <th>Stock</th>
                <th>Referencia</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>
                    <span
                      className={`product-event-badge ${PRODUCT_EVENT_CLASSES[row.eventType] || ""}`}
                    >
                      {getProductEventLabel(row.eventType)}
                    </span>
                  </td>
                  <td>
                    <strong>{row.productName}</strong>
                    {row.productSlug && (
                      <div className="product-history-meta">{row.productSlug}</div>
                    )}
                  </td>
                  <td>
                    {row.sku ? (
                      <>
                        <div>{row.sku}</div>
                        {(row.sizeName || row.colorName) && (
                          <div className="product-history-meta">
                            {[row.sizeName, row.colorName].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="product-history-qty">
                    {formatQty(row.quantityChange)}
                  </td>
                  <td>
                    {row.stockBefore != null || row.stockAfter != null ? (
                      <span>
                        {row.stockBefore ?? "—"} → {row.stockAfter ?? "—"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {row.referenceLabel ? (
                      row.referenceType === "order" ? (
                        <span>{row.referenceLabel}</span>
                      ) : (
                        row.referenceLabel
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{row.userEmail || "Sistema / cliente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="catalog-pagination" style={{ marginTop: "1.5rem" }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
