"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getAdminDashboard } from "@/services/adminDashboardService";
import { formatCOP } from "@/lib/formatCurrency";
import { getAuditActionLabel, getAuditModuleLabel } from "@/lib/auditLabels";

// ── Helpers ────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const ORDER_STATUS_LABELS = {
  pendiente: "Pendiente",
  pago_pendiente: "Pago pendiente",
  pagado: "Pagado",
  en_preparacion: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  rechazado: "Rechazado",
};

const PAYMENT_METHOD_SHORT = {
  wompi: "Wompi",
  nequi_manual: "Nequi",
  contra_entrega: "Contraentrega",
};

// ── Sub-components ─────────────────────────────────────────────────────
function KpiCard({ value, label, color = "primary", href, urgent, highlight }) {
  const colorMap = {
    red: "#dc2626",
    amber: "#d97706",
    green: "#16a34a",
    blue: "#2563eb",
    primary: "var(--color-primary)",
    purple: "#7c3aed",
  };
  const borderColor = colorMap[color] ?? colorMap.primary;

  const card = (
    <div
      className={`dash-kpi${highlight ? " dash-kpi--highlight" : ""}${urgent ? " dash-kpi--urgent" : ""}`}
      style={{ borderLeftColor: borderColor }}
    >
      <p className="dash-kpi__value" style={{ color: borderColor }}>
        {value}
      </p>
      <p className="dash-kpi__label">{label}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="dash-kpi-link">
      {card}
    </Link>
  ) : (
    card
  );
}

function OrderBadge({ status }) {
  return (
    <span className={`dash-badge dash-badge--${status}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PayBadge({ status }) {
  const map = { pendiente: "dash-pay--pending", pagado: "dash-pay--paid", rechazado: "dash-pay--rejected" };
  const labels = { pendiente: "Pend.", pagado: "Pagado", rechazado: "Rechazado" };
  return (
    <span className={`dash-badge ${map[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

const QUICK_LINKS = [
  { href: "/admin/pedidos",     icon: "📦", label: "Pedidos",      desc: "Envíos y pagos" },
  { href: "/admin/inventario",  icon: "📊", label: "Inventario",   desc: "Historial de stock" },
  { href: "/admin/productos",   icon: "🧢", label: "Productos",    desc: "Catálogo y precios" },
  { href: "/admin/solicitudes", icon: "📝", label: "Solicitudes",  desc: "Pedidos especiales" },
  { href: "/admin/cupones",     icon: "🏷️",  label: "Cupones",     desc: "Descuentos activos" },
  { href: "/admin/alertas",     icon: "🔔", label: "Alertas",      desc: "Monitoreo sistema" },
];

// ── Página ─────────────────────────────────────────────────────────────
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
    return (
      <div className="dash-page">
        <div className="dash-loading">Cargando dashboard…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dash-page">
        <p style={{ color: "#b33" }}>{error || "Sin datos disponibles."}</p>
      </div>
    );
  }

  const { orders, specialRequests, catalog, users, marketing, coupons, recentOrders, audit } = data;

  const todayStr = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const urgentCount =
    (orders.pendingPayment || 0) +
    (orders.toPrepare || 0) +
    (catalog.outOfStock || 0) +
    (specialRequests.pending || 0);

  return (
    <div className="dash-page">

      {/* ── Header de bienvenida ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-greeting">
            {getGreeting()}, {user?.name?.split(" ")[0] ?? "admin"}
          </h1>
          <p className="dash-date" style={{ textTransform: "capitalize" }}>{todayStr}</p>
        </div>
        <div className="dash-header-actions">
          {urgentCount > 0 && (
            <Link href="/admin/alertas" className="dash-alert-link">
              🔔 {urgentCount} alerta{urgentCount !== 1 ? "s" : ""} activa{urgentCount !== 1 ? "s" : ""}
            </Link>
          )}
          {isSuperadmin && (
            <Link href="/admin/finanzas" className="admin-btn admin-btn--primary">
              Ver finanzas
            </Link>
          )}
        </div>
      </div>

      {/* ── Sección 1: Requieren atención ── */}
      <section className="dash-section">
        <p className="dash-section__title">⚡ Requieren atención</p>
        <div className="dash-kpi-grid">
          <KpiCard
            value={orders.pendingPayment}
            label="Pagos por confirmar"
            color="red"
            href="/admin/pedidos"
            urgent={orders.pendingPayment > 0}
          />
          <KpiCard
            value={orders.toPrepare}
            label="Por preparar"
            color="amber"
            href="/admin/pedidos"
            urgent={orders.toPrepare > 0}
          />
          <KpiCard
            value={catalog.outOfStock}
            label="Productos sin stock"
            color="red"
            href="/admin/inventario"
            urgent={catalog.outOfStock > 0}
          />
          <KpiCard
            value={specialRequests.pending}
            label="Solicitudes pendientes"
            color="amber"
            href="/admin/solicitudes"
            urgent={specialRequests.pending > 0}
          />
        </div>
      </section>

      {/* ── Sección 2: Actividad del día y mes ── */}
      <section className="dash-section">
        <p className="dash-section__title">📊 Actividad</p>
        <div className="dash-kpi-grid">
          <KpiCard
            value={formatCOP(orders.revenueMonth)}
            label="Ventas del mes (pagadas)"
            color="primary"
            highlight
          />
          <KpiCard
            value={orders.ordersToday}
            label="Pedidos recibidos hoy"
            color="primary"
          />
          <KpiCard
            value={orders.shippedToday}
            label="Enviados hoy"
            color="green"
          />
          <KpiCard
            value={catalog.lowStock}
            label="Productos stock bajo"
            color="amber"
            href="/admin/inventario"
          />
          <KpiCard
            value={users.clients}
            label="Clientes activos"
            color="blue"
          />
          <KpiCard
            value={marketing.newsletterSubscribers}
            label="Suscritos al newsletter"
            color="blue"
          />
        </div>
      </section>

      {/* ── Accesos rápidos ── */}
      <section className="dash-section">
        <p className="dash-section__title">🔗 Acceso rápido</p>
        <div className="dash-quick-links">
          {QUICK_LINKS.map((ql) => (
            <Link key={ql.href} href={ql.href} className="dash-quick-link">
              <span className="dash-quick-link__icon">{ql.icon}</span>
              <span className="dash-quick-link__label">{ql.label}</span>
              <span className="dash-quick-link__desc">{ql.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Pedidos recientes ── */}
      <section className="dash-section">
        <div className="dash-section-header">
          <p className="dash-section__title" style={{ margin: 0 }}>📋 Pedidos recientes</p>
          <Link href="/admin/pedidos" className="dash-see-all">
            Ver todos →
          </Link>
        </div>
        {recentOrders?.length ? (
          <div className="admin-table-wrap" style={{ marginTop: "var(--space-md)" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>N° pedido</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href="/admin/pedidos" className="dash-order-link">
                        #{o.orderNumber}
                      </Link>
                    </td>
                    <td>{o.buyerName}</td>
                    <td><OrderBadge status={o.orderStatus} /></td>
                    <td><PayBadge status={o.paymentStatus} /></td>
                    <td>{PAYMENT_METHOD_SHORT[o.paymentMethod] ?? o.paymentMethod ?? "—"}</td>
                    <td>{formatCOP(o.total)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dash-empty">Aún no hay pedidos registrados.</p>
        )}
      </section>

      {/* ── Dos columnas: Solicitudes + Cupones ── */}
      <div className="dash-two-col">

        {/* Solicitudes especiales */}
        <section className="dash-section">
          <div className="dash-section-header">
            <p className="dash-section__title" style={{ margin: 0 }}>📝 Solicitudes especiales</p>
            <Link href="/admin/solicitudes" className="dash-see-all">Ver →</Link>
          </div>
          <div className="dash-sol-grid">
            <div className="dash-sol-card dash-sol-card--warn">
              <p className="dash-sol-card__value">{specialRequests.pending}</p>
              <p className="dash-sol-card__label">Pendientes</p>
            </div>
            <div className="dash-sol-card">
              <p className="dash-sol-card__value">{specialRequests.inReview}</p>
              <p className="dash-sol-card__label">En revisión</p>
            </div>
            <div className="dash-sol-card">
              <p className="dash-sol-card__value">{specialRequests.quoted}</p>
              <p className="dash-sol-card__label">Cotizadas</p>
            </div>
          </div>
          <p className="dash-sol-total">
            {specialRequests.total} solicitudes en total
          </p>
        </section>

        {/* Cupones */}
        <section className="dash-section">
          <div className="dash-section-header">
            <p className="dash-section__title" style={{ margin: 0 }}>🏷️ Cupones</p>
            <Link href="/admin/cupones" className="dash-see-all">Gestionar →</Link>
          </div>
          <div className="dash-coupon-row">
            <div className="dash-coupon-stat">
              <p className="dash-coupon-stat__value" style={{ color: "var(--color-primary)" }}>
                {coupons?.active ?? 0}
              </p>
              <p className="dash-coupon-stat__label">Cupones activos</p>
            </div>
            <div className="dash-coupon-stat">
              <p
                className="dash-coupon-stat__value"
                style={{ color: (coupons?.expiringSoon ?? 0) > 0 ? "#d97706" : "var(--color-text-muted)" }}
              >
                {coupons?.expiringSoon ?? 0}
              </p>
              <p className="dash-coupon-stat__label">Vencen en 3 días</p>
            </div>
          </div>
          {(coupons?.expiringSoon ?? 0) > 0 && (
            <p className="dash-coupon-warn">
              ⚠️ {coupons.expiringSoon} cupón{coupons.expiringSoon !== 1 ? "es" : ""} próximo{coupons.expiringSoon !== 1 ? "s" : ""} a vencer — revísalos antes de que caduquen.
            </p>
          )}
        </section>
      </div>

      {/* ── Actividad reciente (auditoría) ── */}
      <section className="dash-section">
        <div className="dash-section-header">
          <p className="dash-section__title" style={{ margin: 0 }}>
            🕓 Actividad reciente
          </p>
          <span style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span className="admin-dashboard-badge">{audit.eventsToday} eventos hoy</span>
            <Link href="/admin/auditoria" className="dash-see-all">Historial completo →</Link>
          </span>
        </div>
        {audit.recent?.length ? (
          <div className="admin-table-wrap" style={{ marginTop: "var(--space-md)" }}>
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
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(log.createdAt)}</td>
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
          <p className="dash-empty">Aún no hay eventos registrados.</p>
        )}
      </section>

    </div>
  );
}
