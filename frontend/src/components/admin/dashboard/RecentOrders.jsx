"use client";
import Link from "next/link";
import { formatCOP } from "@/lib/formatCurrency";
import { formatOrderDate } from "@/lib/orderWorkspace";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orderLabels";
import { OrderReference, StatusChip } from "./DashboardUI";

// The next action always comes from the backend (`operation.primary`); nothing is inferred here.
const ACTIONABLE = ["review", "prepare", "dispatch", "deliver", "collect"];
const ORDER_TONE = { cancelado: "muted", rechazado: "muted", devuelto: "muted", entregado: "success", enviado: "info", en_preparacion: "accent" };
const PAY_TONE = { pagado: "success", rechazado: "danger", reembolsado: "muted" };

export default function RecentOrders({ orders, base, limit = 6 }) {
  if (!orders.length) return <p className="dz-empty-line">Todavía no hay pedidos registrados.</p>;
  return <ul className="dz-recent">
    {orders.slice(0, limit).map((o) => {
      const primary = o.operation?.primary || {}, actionable = ACTIONABLE.includes(primary.code);
      const href = `${base}/${o.id}?returnTo=${encodeURIComponent(base)}`;
      return <li key={o.id} className="dz-recent__row">
        <div className="dz-recent__who">
          <OrderReference value={o.orderNumber} />
          <span className="dz-recent__buyer">{o.buyer?.name || "Comprador sin nombre"}</span>
          <span className="dz-recent__date">{formatOrderDate(o.createdAt)}</span>
        </div>
        <span className="dz-recent__total">{formatCOP(o.total)}</span>
        <div className="dz-recent__status">
          <StatusChip tone={ORDER_TONE[o.orderStatus] || "neutral"}>{ORDER_STATUS_LABELS[o.orderStatus] || o.orderStatus}</StatusChip>
          <StatusChip tone={PAY_TONE[o.paymentStatus] || "warning"}>Pago: {(PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus || "").toLowerCase()}</StatusChip>
        </div>
        <div className="dz-recent__action">
          {actionable ? <Link className={`dz-btn dz-btn--sm ${primary.code === "review" ? "dz-btn--danger" : "dz-btn--primary"}`} href={href} aria-label={`${primary.label}: pedido ${o.orderNumber}`}>{primary.label}</Link>
            : <><span className="dz-recent__note">{primary.label}</span><Link className="dz-btn dz-btn--sm dz-btn--ghost" href={href} aria-label={`Ver pedido ${o.orderNumber}`}>Ver</Link></>}
        </div>
      </li>;
    })}
  </ul>;
}
