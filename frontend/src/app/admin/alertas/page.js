"use client";
// Centro de alertas (Sprint 01). Same /admin/alerts contract and criteria; polling every
// 60 s plus manual refresh. Lists are the API sample (≤ 10) and say so.
import { useEffect, useState } from "react";
import Link from "next/link";
import { HiOutlineCreditCard, HiOutlineExclamationTriangle, HiOutlineArchiveBox, HiOutlineCube, HiOutlineShieldExclamation, HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight, HiOutlineTicket, HiOutlineShoppingBag, HiOutlineArrowPath, HiOutlineCheckCircle } from "react-icons/hi2";
import AdminShell from "@/components/admin/AdminShell";
import PaymentEventAlerts from "@/components/admin/PaymentEventAlerts";
import { AlertGroup, AlertRow } from "@/components/admin/dashboard/AlertGroup";
import { DashboardStateNotice, OrderReference, StatusChip } from "@/components/admin/dashboard/DashboardUI";
import { getAlerts } from "@/services/adminAlertService";
import { formatCOP } from "@/lib/formatCurrency";
import { formatNumber } from "@/lib/dashboardPeriod";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/orderLabels";

const REFRESH_INTERVAL = 60_000;
const TZ = "America/Bogota";
const fmtDate = (d) => new Date(d).toLocaleString("es-CO", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtTime = (d) => d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
const hoursSince = (date, now) => Math.max(0, Math.floor((now - new Date(date).getTime()) / 3_600_000));
const waitText = (h) => h < 1 ? "menos de 1 h" : h < 48 ? `${h} h` : `${Math.floor(h / 24)} días`;
const stockHref = (productId, variantId) => `/admin/productos?view=stock&productId=${productId}${variantId ? `&variantId=${variantId}` : ""}`;
const VARIANT = { out: "Agotada", low: "Bajo", review: "Revisar" };

function VariantPills({ product }) {
  if (!product.affectedVariants?.length) return null;
  return <span className="dz-pills">{product.affectedVariants.map((v) => <Link key={v.id} className={`dz-pill dz-pill--${v.stockStatus}`} href={stockHref(product.id, v.id)}
    aria-label={`${v.sku}: ${v.stockStatus === "review" ? "existencias por revisar" : `${v.stock} unidades`} (${VARIANT[v.stockStatus] || v.stockStatus}). Ajustar variante`}>
    <span className="dz-mono">{v.sku}</span><span>{v.stockStatus === "review" ? "revisar" : `${v.stock} ud${v.stock === 1 ? "" : "s"}`}</span>
  </Link>)}</span>;
}
const inventoryRows = (group, action) => (group?.items || []).map((p) => <AlertRow key={p.id} title={p.name}
  meta={p.unavailable ? "Sin variantes disponibles para la venta" : `${p.affectedVariants?.length || 0} ${p.affectedVariants?.length === 1 ? "variante afectada" : "variantes afectadas"}`}
  action={{ href: stockHref(p.id, p.affectedVariants?.[0]?.id), label: action, ariaLabel: `${action}: ${p.name}` }}><VariantPills product={p} /></AlertRow>);

export default function AlertasPage() {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ version: -1, data: null, error: false, at: null });
  useEffect(() => {
    let active = true;
    getAlerts().then((res) => {
      if (!res?.alerts) throw new Error("Respuesta incompleta");
      if (active) setState({ version, data: res, error: false, at: new Date() });
    }).catch(() => { if (active) setState((s) => ({ ...s, version, error: true })); });
    return () => { active = false; };
  }, [version]);
  useEffect(() => { const id = setInterval(() => setVersion((v) => v + 1), REFRESH_INTERVAL); return () => clearInterval(id); }, []);
  const refresh = () => setVersion((v) => v + 1);
  const refreshing = state.version !== version, data = state.data, a = data?.alerts || {};
  const now = state.at?.getTime() || 0;
  const n = (k) => a[k]?.count || 0;
  const payments = n("paymentEvents") + n("financialFollowUp") + n("oldPendingPayments");
  const summary = [
    ["payments", "Pagos", payments, "danger"], ["orders", "Pedidos con incidencias", n("pendingPayments"), "danger"], ["out", "Agotados", n("outOfStock"), "danger"],
    ["low", "Stock bajo", n("lowStock"), "warning"], ["review-stock", "Existencias por revisar", n("inventoryReview"), "review"], ["communications", "Comunicaciones", n("communications"), "warning"],
    ["requests", "Solicitudes", n("specialRequests"), "info"], ["coupons", "Cupones por vencer", n("expiringCoupons"), "info"], ["new", "Pedidos nuevos 24 h", n("newOrders"), "neutral"],
  ];
  const actionable = summary.filter(([k]) => k !== "new").reduce((s, [, , c]) => s + c, 0);

  return <AdminShell>
    <div className="dz-page dz-alerts">
      <header className="dz-hero dz-hero--alerts">
        <div className="dz-hero__titles">
          <p className="dz-eyebrow">Inicio · Alertas importantes</p>
          <h1>Centro de alertas</h1>
          <p className="dz-lead">Revisa los eventos que necesitan seguimiento.</p>
        </div>
        <div className="dz-hero__actions">
          <p className="dz-hero__meta dz-alerts__status" role="status">
            {refreshing && data ? "Actualizando…" : state.at ? <>Última actualización <strong>{fmtTime(state.at)}</strong></> : "Consultando alertas…"}
            <span> · revisión automática cada 60 s</span>
          </p>
          <button type="button" className="dz-btn dz-btn--primary" onClick={refresh}><HiOutlineArrowPath aria-hidden="true" />Actualizar</button>
        </div>
      </header>

      {!data && refreshing && <DashboardStateNotice>Cargando alertas…</DashboardStateNotice>}
      {!data && !refreshing && state.error && <DashboardStateNotice tone="error" onRetry={refresh}>No se pudieron cargar las alertas. Ninguna categoría se muestra como vacía mientras no haya respuesta.</DashboardStateNotice>}
      {data && state.error && !refreshing && <DashboardStateNotice tone="error" onRetry={refresh} retryLabel="Reintentar actualización">No se pudieron actualizar las alertas. Se muestran los datos de las {fmtTime(state.at)}.</DashboardStateNotice>}

      {data && <>
        <nav className="dz-alert-summary" aria-label="Resumen de alertas por categoría">
          <ul>{summary.map(([key, label, count, tone]) => <li key={key}>
            {count || key === "payments" ? <a href={`#alerta-${key}`} className={`dz-summary-chip ${count ? `dz-summary-chip--${tone}` : "is-clear"}`}>
              <strong>{formatNumber(count)}</strong><span>{label}</span>
            </a> : <span className="dz-summary-chip is-clear"><strong>0</strong><span>{label}</span></span>}
          </li>)}</ul>
        </nav>

        {actionable === 0 && <div className="dz-all-clear" role="status"><HiOutlineCheckCircle aria-hidden="true" /><div><p className="dz-empty__title">Sin alertas activas</p><p>No hay pagos, pedidos, inventario, comunicaciones, solicitudes ni cupones que requieran seguimiento.</p></div></div>}

        <div className="dz-alert-groups">
          <AlertGroup id="payments" title="Incidencias de pagos" icon={HiOutlineCreditCard} tone={payments ? "danger" : "calm"} total={payments}
            description={`${formatNumber(n("paymentEvents"))} eventos Wompi sin completar · ${formatNumber(n("financialFollowUp"))} en seguimiento financiero · ${formatNumber(n("oldPendingPayments"))} pagos pendientes > 24 h. Ninguna de estas señales confirma un pago.`}
            rows={(a.oldPendingPayments?.items || []).map((o) => <AlertRow key={o._id} title={<OrderReference value={o.orderNumber} />} meta={`Pago Wompi pendiente desde ${fmtDate(o.createdAt)}`}
              chip={<StatusChip tone="warning">{waitText(hoursSince(o.createdAt, now))}</StatusChip>} value={formatCOP(o.total)}
              action={{ href: `/admin/pedidos/${o._id}`, label: "Revisar", ariaLabel: `Revisar pedido ${o.orderNumber}` }} />)}
            listTotal={n("oldPendingPayments")} listTitle="Pagos Wompi pendientes por más de 24 horas" initial={2}>
            <PaymentEventAlerts alerts={a.paymentEvents} oldPending={a.oldPendingPayments} financialFollowUp={a.financialFollowUp} />
          </AlertGroup>

          {n("pendingPayments") > 0 && <AlertGroup id="orders" title="Pedidos que requieren atención" icon={HiOutlineExclamationTriangle} tone="danger" total={n("pendingPayments")}
            description="Incidencias de pago, inventario o registro. Resuélvelas antes de preparar o despachar." href="/admin/pedidos?tray=review" hrefLabel="Ver bandeja de revisión"
            rows={a.pendingPayments.items.map((o) => { const active = (o.incidents || []).filter((i) => !i.resolvedAt).length;
              return <AlertRow key={o._id} title={<OrderReference value={o.orderNumber} />} meta={`${o.buyer?.name || "Comprador sin nombre"} · ${active ? `${active} ${active === 1 ? "incidencia activa" : "incidencias activas"}` : "Marcado para revisión"}`}
                chip={<StatusChip tone={hoursSince(o.createdAt, now) > 12 ? "danger" : "warning"}>Espera {waitText(hoursSince(o.createdAt, now))}</StatusChip>} value={formatCOP(o.total)}
                action={{ href: `/admin/pedidos/${o._id}`, label: "Revisar", ariaLabel: `Revisar pedido ${o.orderNumber}` }} />; })} />}

          {n("outOfStock") > 0 && <AlertGroup id="out" title="Inventario agotado" icon={HiOutlineArchiveBox} tone="danger" total={n("outOfStock")}
            description="Productos publicados con alguna variante activa en cero. Cada etiqueta indica la variante (SKU) y sus unidades." href="/admin/productos?view=stock&stock=out" hrefLabel="Ver todos en Existencias"
            rows={inventoryRows(a.outOfStock, "Reabastecer")} />}

          {n("lowStock") > 0 && <AlertGroup id="low" title="Inventario bajo" icon={HiOutlineCube} tone="warning" total={n("lowStock")}
            description={`Productos con variantes de ${a.lowStock.threshold ?? 5} unidades o menos.`} href="/admin/productos?view=stock&stock=low" hrefLabel="Ver todos en Existencias"
            rows={inventoryRows(a.lowStock, "Ajustar")} />}

          {n("inventoryReview") > 0 && <AlertGroup id="review-stock" title="Existencias por revisar" icon={HiOutlineShieldExclamation} tone="review" total={n("inventoryReview")}
            description="Existencias históricas inválidas o ausentes. No se modificaron automáticamente." href="/admin/productos?view=stock&stock=review" hrefLabel="Revisar existencias históricas"
            rows={inventoryRows(a.inventoryReview, "Revisar")} />}

          {n("communications") > 0 && <AlertGroup id="communications" title="Comunicaciones fallidas" icon={HiOutlineEnvelope} tone="warning" total={n("communications")}
            description="Los errores de correo no cambian pagos ni inventario. Revisa el historial del pedido o solicita un reintento." href="/admin/pedidos?tray=communications" hrefLabel="Ver bandeja de comunicaciones"
            rows={a.communications.items.map((c) => <AlertRow key={c.id} title={c.orderNumber ? <OrderReference value={c.orderNumber} /> : "Pedido sin número"} meta={`${c.message}${c.count > 1 ? ` · ${c.count} intentos` : ""}`}
              value={c.at ? fmtDate(c.at) : null} action={{ href: `/admin/pedidos/${c.orderId}`, label: "Ver pedido", ariaLabel: `Ver pedido ${c.orderNumber || ""}`.trim() }} />)} />}

          {n("specialRequests") > 0 && <AlertGroup id="requests" title="Solicitudes sin atender" icon={HiOutlineChatBubbleLeftRight} tone="info" total={n("specialRequests")}
            description="Personalizaciones y pedidos por mayor pendientes de respuesta." href="/admin/solicitudes" hrefLabel="Ver solicitudes"
            rows={a.specialRequests.items.map((r) => <AlertRow key={r._id} title={`#${r.requestNumber}`} meta={`${r.type === "customization" ? "Personalización" : "Pedido por mayor"} · ${r.contact?.name || "Sin nombre"}`}
              value={fmtDate(r.createdAt)} action={{ href: `/admin/solicitudes/${r._id}`, label: "Atender", ariaLabel: `Atender solicitud ${r.requestNumber}` }} />)} />}

          {n("expiringCoupons") > 0 && <AlertGroup id="coupons" title="Cupones por vencer" icon={HiOutlineTicket} tone="info" total={n("expiringCoupons")}
            description="Vencen en los próximos 3 días." href="/admin/cupones" hrefLabel="Gestionar cupones"
            rows={a.expiringCoupons.items.map((c) => <AlertRow key={c._id} title={<span className="dz-mono">{c.code}</span>} meta={`Vence ${fmtDate(c.expiresAt)}`}
              value={`${formatNumber(c.usedCount)} / ${c.maxUses ? formatNumber(c.maxUses) : "∞"} usos`} />)} />}

          {n("newOrders") > 0 && <AlertGroup id="new" title="Pedidos nuevos · últimas 24 h" icon={HiOutlineShoppingBag} tone="neutral" total={n("newOrders")} defaultOpen={false}
            description="Informativo: pedidos abiertos creados en las últimas 24 horas." href="/admin/pedidos" hrefLabel="Ver todos los pedidos"
            rows={a.newOrders.items.map((o) => <AlertRow key={o._id} title={<OrderReference value={o.orderNumber} />} meta={`${o.buyer?.name || "Comprador sin nombre"} · ${PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod} · ${fmtDate(o.createdAt)}`}
              chip={<StatusChip tone="neutral">{ORDER_STATUS_LABELS[o.orderStatus] || o.orderStatus} · pago {(PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus || "").toLowerCase()}</StatusChip>}
              value={formatCOP(o.total)} action={{ href: `/admin/pedidos/${o._id}`, label: "Ver", ariaLabel: `Ver pedido ${o.orderNumber}` }} />)} />}
        </div>
      </>}
    </div>
  </AdminShell>;
}
