"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getAlerts } from "@/services/adminAlertService";

const REFRESH_INTERVAL = 60_000;

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtExpires = (d) =>
  new Date(d).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// ── Tarjeta de resumen ──────────────────────────────────────────────
function SummaryCard({ count, label, color, href }) {
  const card = (
    <div
      className="alert-summary-card"
      style={{ borderTopColor: color }}
    >
      <p className="alert-summary-card__count" style={{ color }}>
        {count}
      </p>
      <p className="alert-summary-card__label">{label}</p>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{card}</Link> : card;
}

// ── Sección colapsable ──────────────────────────────────────────────
function AlertSection({ id, title, count, color, dot, children, actionHref, actionLabel }) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <section className="alert-section">
      <div className="alert-section__header" onClick={() => setOpen((v) => !v)}>
        <div className="alert-section__title-row">
          <span className="alert-section__dot">{dot}</span>
          <h2 className="alert-section__title">{title}</h2>
          <span className="alert-section__badge" style={{ background: color }}>
            {count}
          </span>
        </div>
        <button type="button" className="alert-section__toggle">
          {open ? "▲" : "▼"}
        </button>
      </div>
      {open && (
        <div className="alert-section__body">
          {children}
          {actionHref && (
            <div className="alert-section__footer">
              <Link href={actionHref} className="alert-section__action">
                {actionLabel || "Ver todos →"}
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Página principal ────────────────────────────────────────────────
export default function AlertasPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getAlerts();
      setData(res);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
    } catch {
      setError("No se pudieron cargar las alertas. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [lastRefresh]);

  const alerts = data?.alerts ?? {};
  const total = data?.totalCount ?? 0;

  return (
    <AdminShell>
      <div className="alerts-page">
        {/* Header */}
        <div className="admin-page__header-row">
          <div>
            <h1 className="admin-page__title">Alertas del sistema</h1>
            <p className="admin-page__subtitle">
              Monitoreo en tiempo real · se actualiza automáticamente cada 60 segundos
            </p>
          </div>
          <div className="alerts-page__toolbar">
            {lastRefresh && (
              <span className="alerts-page__refresh-info">
                Actualizado {lastRefresh.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                {" · "}próximo en {countdown}s
              </span>
            )}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={load}
              disabled={loading}
            >
              Actualizar ahora
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-error-banner">{error}</div>
        )}

        {loading && !data && (
          <p className="alerts-page__loading">Cargando alertas…</p>
        )}

        {data && (
          <>
            {/* Tarjetas de resumen */}
            <div className="alert-summary-grid">
              <SummaryCard
                count={alerts.newOrders?.count ?? 0}
                label="Pedidos nuevos (24h)"
                color="#dc2626"
                href="/admin/pedidos"
              />
              <SummaryCard
                count={alerts.pendingPayments?.count ?? 0}
                label="Pagos por confirmar"
                color="#d97706"
                href="/admin/pedidos"
              />
              <SummaryCard
                count={alerts.lowStock?.count ?? 0}
                label="Stock bajo"
                color="#d97706"
                href="/admin/inventario"
              />
              <SummaryCard
                count={alerts.outOfStock?.count ?? 0}
                label="Sin stock"
                color="#dc2626"
                href="/admin/inventario"
              />
              <SummaryCard
                count={alerts.specialRequests?.count ?? 0}
                label="Solicitudes pendientes"
                color="#d97706"
                href="/admin/solicitudes"
              />
              <SummaryCard
                count={alerts.expiringCoupons?.count ?? 0}
                label="Cupones por vencer"
                color="#7c3aed"
                href="/admin/cupones"
              />
            </div>

            {total === 0 && (
              <div className="alerts-page__all-clear">
                <span className="alerts-page__all-clear-icon">✓</span>
                <p>Todo en orden — sin alertas activas</p>
              </div>
            )}

            {/* ── Pedidos nuevos ── */}
            <AlertSection
              id="newOrders"
              title="Pedidos nuevos (últimas 24 h)"
              count={alerts.newOrders?.count ?? 0}
              color="#dc2626"
              dot="🔴"
              actionHref="/admin/pedidos"
              actionLabel="Ver todos los pedidos →"
            >
              <div className="alert-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Estado pedido</th>
                      <th>Estado pago</th>
                      <th>Método</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.newOrders.items.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <Link href="/admin/pedidos" className="alert-link">
                            #{o.orderNumber}
                          </Link>
                        </td>
                        <td>{o.buyer?.name}<br /><small>{o.buyer?.email}</small></td>
                        <td>{fmt(o.total)}</td>
                        <td><span className={`alert-status alert-status--${o.orderStatus}`}>{o.orderStatus}</span></td>
                        <td><span className={`alert-status alert-status--pay-${o.paymentStatus}`}>{o.paymentStatus}</span></td>
                        <td>{o.paymentMethod === "nequi_manual" ? "Nequi" : o.paymentMethod === "wompi" ? "Wompi" : "Contraentrega"}</td>
                        <td>{fmtDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AlertSection>

            {/* ── Pagos Nequi por confirmar ── */}
            <AlertSection
              id="pendingPayments"
              title="Pagos Nequi por confirmar"
              count={alerts.pendingPayments?.count ?? 0}
              color="#d97706"
              dot="🟡"
              actionHref="/admin/pedidos"
              actionLabel="Gestionar pedidos →"
            >
              <p className="alert-hint">
                Estos pedidos fueron pagados por Nequi y esperan confirmación manual del pago.
              </p>
              <div className="alert-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Fecha</th>
                      <th>Espera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.pendingPayments.items.map((o) => {
                      const horasEspera = Math.floor(
                        (Date.now() - new Date(o.createdAt).getTime()) / 3_600_000
                      );
                      return (
                        <tr key={o._id}>
                          <td>
                            <Link href="/admin/pedidos" className="alert-link">
                              #{o.orderNumber}
                            </Link>
                          </td>
                          <td>{o.buyer?.name}<br /><small>{o.buyer?.phone}</small></td>
                          <td>{fmt(o.total)}</td>
                          <td>{fmtDate(o.createdAt)}</td>
                          <td>
                            <span className={horasEspera > 12 ? "alert-warn-text" : ""}>
                              {horasEspera}h
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AlertSection>

            {/* ── Stock bajo ── */}
            <AlertSection
              id="lowStock"
              title={`Stock bajo (≤ ${alerts.lowStock?.threshold ?? 5} unidades)`}
              count={alerts.lowStock?.count ?? 0}
              color="#d97706"
              dot="🟡"
              actionHref="/admin/inventario"
              actionLabel="Ir a Inventario →"
            >
              <div className="alert-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock total</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.lowStock.items.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>
                          <span className="alert-stock alert-stock--low">
                            {p.totalStock} ud{p.totalStock !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td>
                          <Link href="/admin/inventario" className="alert-link">
                            Ajustar →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AlertSection>

            {/* ── Sin stock ── */}
            <AlertSection
              id="outOfStock"
              title="Productos agotados"
              count={alerts.outOfStock?.count ?? 0}
              color="#dc2626"
              dot="🔴"
              actionHref="/admin/inventario"
              actionLabel="Ir a Inventario →"
            >
              <div className="alert-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.outOfStock.items.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>
                          <span className="alert-stock alert-stock--out">Agotado</span>
                        </td>
                        <td>
                          <Link href="/admin/inventario" className="alert-link">
                            Reabastecer →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AlertSection>

            {/* ── Solicitudes especiales ── */}
            <AlertSection
              id="specialRequests"
              title="Solicitudes especiales sin atender"
              count={alerts.specialRequests?.count ?? 0}
              color="#d97706"
              dot="🟡"
              actionHref="/admin/solicitudes"
              actionLabel="Ver solicitudes →"
            >
              <div className="alert-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>N° solicitud</th>
                      <th>Tipo</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.specialRequests.items.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <Link href="/admin/solicitudes" className="alert-link">
                            #{r.requestNumber}
                          </Link>
                        </td>
                        <td>
                          {r.type === "customization" ? "Personalización" : "Pedido mayor"}
                        </td>
                        <td>{r.contact?.name}<br /><small>{r.contact?.email}</small></td>
                        <td>{fmtDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AlertSection>

            {/* ── Cupones por vencer ── */}
            <AlertSection
              id="expiringCoupons"
              title="Cupones próximos a vencer (3 días)"
              count={alerts.expiringCoupons?.count ?? 0}
              color="#7c3aed"
              dot="🟣"
              actionHref="/admin/cupones"
              actionLabel="Gestionar cupones →"
            >
              <div className="alert-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Vence</th>
                      <th>Usos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.expiringCoupons.items.map((c) => (
                      <tr key={c._id}>
                        <td><code className="alert-code">{c.code}</code></td>
                        <td>{fmtExpires(c.expiresAt)}</td>
                        <td>
                          {c.usedCount}
                          {c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AlertSection>
          </>
        )}
      </div>
    </AdminShell>
  );
}
