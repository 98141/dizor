"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getAdminDashboard } from "@/services/adminDashboardService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  getAuditActionLabel,
  getAuditModuleLabel,
} from "@/lib/auditLabels";

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboard()
      .then((res) => setData(res.dashboard))
      .catch(() => setError("No se pudo cargar el dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="auth-loading">Cargando dashboard...</p>;
  }

  if (error || !data) {
    return (
      <p className="admin-page__error" style={{ color: "#b33" }}>
        {error || "Sin datos disponibles."}
      </p>
    );
  }

  const { orders, specialRequests, catalog, users, marketing, audit } = data;

  return (
    <div className="admin-page">
      <div className="admin-page__header-row">
        <div>
          <h1 className="admin-page__title">Dashboard</h1>
          <p className="admin-page__subtitle">
            Resumen operativo de la tienda Dizor
          </p>
        </div>
        <div className="admin-page__actions" style={{ margin: 0 }}>
          {isSuperadmin && (
            <Link href="/admin/finanzas" className="admin-btn admin-btn--primary">
              Finanzas
            </Link>
          )}
          <Link href="/admin/inventario" className="admin-btn">
            Inventario
          </Link>
        </div>
      </div>

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">Pedidos</h2>
        <div className="admin-stats">
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{orders.total}</p>
            <p className="admin-stat-card__label">Total pedidos</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{orders.ordersToday}</p>
            <p className="admin-stat-card__label">Hoy</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{orders.pendingPayment}</p>
            <p className="admin-stat-card__label">Pagos pendientes</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{orders.toPrepare}</p>
            <p className="admin-stat-card__label">Por preparar</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{orders.shippedToday}</p>
            <p className="admin-stat-card__label">Enviados hoy</p>
          </div>
          <div className="admin-stat-card admin-stat-card--highlight">
            <p className="admin-stat-card__value">
              {formatCOP(orders.revenueMonth)}
            </p>
            <p className="admin-stat-card__label">Ventas del mes (pagadas)</p>
          </div>
        </div>
        <div className="admin-page__actions">
          <Link href="/admin/pedidos" className="admin-btn admin-btn--primary">
            Gestionar pedidos
          </Link>
        </div>
      </section>

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">Catálogo y clientes</h2>
        <div className="admin-stats admin-stats--compact">
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{catalog.activeProducts}</p>
            <p className="admin-stat-card__label">Productos activos</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{catalog.lowStock}</p>
            <p className="admin-stat-card__label">Stock bajo</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{catalog.outOfStock}</p>
            <p className="admin-stat-card__label">Sin stock</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{users.clients}</p>
            <p className="admin-stat-card__label">Clientes activos</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{users.staff}</p>
            <p className="admin-stat-card__label">Equipo activo</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">
              {marketing.newsletterSubscribers}
            </p>
            <p className="admin-stat-card__label">Newsletter</p>
          </div>
        </div>
        <div className="admin-page__actions">
          <Link href="/admin/inventario" className="admin-btn admin-btn--primary">
            Historial inventario
          </Link>
          <Link href="/admin/productos" className="admin-btn">
            Productos
          </Link>
          <Link href="/admin/marketing" className="admin-btn">
            Marketing
          </Link>
        </div>
      </section>

      <section className="admin-dashboard-section">
        <h2 className="admin-dashboard-section__title">Solicitudes especiales</h2>
        <div className="admin-stats admin-stats--compact">
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{specialRequests.pending}</p>
            <p className="admin-stat-card__label">Pendientes</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{specialRequests.inReview}</p>
            <p className="admin-stat-card__label">En revisión</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{specialRequests.quoted}</p>
            <p className="admin-stat-card__label">Cotizadas</p>
          </div>
        </div>
        <div className="admin-page__actions">
          <Link href="/admin/solicitudes" className="admin-btn admin-btn--primary">
            Ver solicitudes
          </Link>
        </div>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-page__header-row">
          <h2 className="admin-dashboard-section__title">
            Actividad reciente
          </h2>
          <span className="admin-dashboard-badge">
            {audit.eventsToday} eventos hoy
          </span>
        </div>
        {audit.recent?.length ? (
          <div className="admin-audit-preview">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {audit.recent.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.userEmail || "—"}</td>
                    <td>{getAuditModuleLabel(log.module)}</td>
                    <td>{getAuditActionLabel(log.action)}</td>
                    <td>{log.summary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-page__subtitle">Aún no hay eventos registrados.</p>
        )}
        <div className="admin-page__actions" style={{ marginTop: "1rem" }}>
          <Link href="/admin/auditoria" className="admin-btn">
            Historial completo
          </Link>
          <Link href="/admin/contenido" className="admin-btn">
            Contenido
          </Link>
          <Link href="/admin/configuracion" className="admin-btn">
            Configuración
          </Link>
        </div>
      </section>
    </div>
  );
}
