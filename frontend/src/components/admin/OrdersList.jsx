"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminOrders } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  getStatusBadgeClass,
} from "@/lib/orderLabels";

export default function OrdersList({ basePath = "/admin/pedidos" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    orderStatus: "",
    paymentStatus: "",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrders({
        ...filters,
        page,
        limit: 15,
      });
      setOrders(data.orders);
      setTotalPages(data.totalPages);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, filters.orderStatus, filters.paymentStatus]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
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
        <select
          value={filters.orderStatus}
          onChange={(e) => {
            setFilters((f) => ({ ...f, orderStatus: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Estado pedido</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filters.paymentStatus}
          onChange={(e) => {
            setFilters((f) => ({ ...f, paymentStatus: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Estado pago</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="admin-btn admin-btn--primary">
          Buscar
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
                    <Link href={`${basePath}/${order.id}`}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>
                    {order.buyer?.name}
                    <br />
                    <small style={{ color: "var(--color-text-muted)" }}>
                      {order.buyer?.phone}
                    </small>
                  </td>
                  <td>{formatCOP(order.total)}</td>
                  <td>
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                    <br />
                    <span
                      className={`status-badge ${getStatusBadgeClass(order.paymentStatus)}`}
                    >
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${getStatusBadgeClass(order.orderStatus)}`}
                    >
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </span>
                  </td>
                  <td>
                    {new Date(order.createdAt).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="catalog-pagination">
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
