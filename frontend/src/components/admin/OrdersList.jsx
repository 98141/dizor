"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAdminOrders, exportOrdersPdf } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  CHANNEL_ORIGIN_LABELS,
  getStatusBadgeClass,
} from "@/lib/orderLabels";

function SourceBadge({ source, channelOrigin }) {
  if (source === "manual") {
    const ch = CHANNEL_ORIGIN_LABELS[channelOrigin] || channelOrigin || "Manual";
    return (
      <span style={{
        display: "inline-block", padding: "0.1rem 0.45rem",
        background: "#f3e8ff", color: "#6b21a8",
        borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700,
        whiteSpace: "nowrap",
      }}>
        {ch}
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-block", padding: "0.1rem 0.45rem",
      background: "#f0fdf4", color: "#166534",
      borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700,
    }}>Web</span>
  );
}

/* ── Main OrdersList ────────────────────────────────── */
export default function OrdersList({ basePath = "/admin/pedidos" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", orderStatus: "", paymentStatus: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const loadOrders = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = { ...filters, page: pg, limit: 15 };
      const data = await getAdminOrders(params);
      setOrders(data.orders);
      setTotalPages(data.totalPages);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadOrders(page);
  }, [page, filters.orderStatus, filters.paymentStatus]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadOrders(1);
  };

  return (
    <div>
      <form className="orders-filters" onSubmit={handleSearch}>
        <input
          className="orders-filters__search"
          placeholder="Buscar por número, nombre, correo..."
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select value={filters.orderStatus}
          onChange={(e) => { setFilters((f) => ({ ...f, orderStatus: e.target.value })); setPage(1); }}>
          <option value="">Estado pedido</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filters.paymentStatus}
          onChange={(e) => { setFilters((f) => ({ ...f, paymentStatus: e.target.value })); setPage(1); }}>
          <option value="">Estado pago</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="admin-btn admin-btn--primary">Buscar</button>
        <button type="button" className="admin-btn" disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try { await exportOrdersPdf(filters); }
            catch { alert("No se pudo exportar el PDF"); }
            finally { setExporting(false); }
          }}>
          {exporting ? "Exportando…" : "PDF"}
        </button>
      </form>

      {loading ? (
        <p className="auth-loading">Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="catalog-empty">No hay pedidos con estos filtros.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {order.orderNumber}
                    </div>
                    <div style={{ marginTop: "0.3rem" }}>
                      <SourceBadge source={order.source} channelOrigin={order.channelOrigin} />
                    </div>
                    <Link
                      href={`${basePath}/${order.id}`}
                      className="admin-btn admin-btn--sm admin-btn--primary"
                      style={{ marginTop: "0.4rem" }}
                    >
                      Ver pedido
                    </Link>
                  </td>
                  <td>
                    {order.buyer?.name}
                    <br />
                    <small style={{ color: "var(--color-text-muted)" }}>{order.buyer?.phone}</small>
                  </td>
                  <td>{formatCOP(order.total)}</td>
                  <td>
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
                    <br />
                    <span className={`status-badge ${getStatusBadgeClass(order.paymentStatus)}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(order.orderStatus)}`}>
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="catalog-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
        </div>
      )}
    </div>
  );
}
