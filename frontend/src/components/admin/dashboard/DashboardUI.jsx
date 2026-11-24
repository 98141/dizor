"use client";
// Reusable building blocks of the premium admin layout (Sprint 01). Styles: "dz-" classes in
// styles/pages/admin-dashboard.css. They only render data; no business rules live here.
import { useState } from "react";
import Link from "next/link";
import { HiOutlineArrowTrendingUp, HiOutlineArrowTrendingDown, HiOutlineDocumentDuplicate, HiOutlineCheck, HiOutlineArrowPath, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { formatPct } from "@/lib/dashboardPeriod";

export function DashboardSection({ id, eyebrow, title, description, actions, children, className = "", as: Tag = "section" }) {
  return <Tag className={`dz-section ${className}`} aria-labelledby={`${id}-title`}>
    <header className="dz-section__head">
      <div className="dz-section__titles">
        {eyebrow && <p className="dz-eyebrow">{eyebrow}</p>}
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <p className="dz-section__desc">{description}</p>}
      </div>
      {actions && <div className="dz-section__actions">{actions}</div>}
    </header>
    {children}
  </Tag>;
}

export function DashboardCard({ title, id, subtitle, actions, children, className = "" }) {
  return <article className={`dz-card ${className}`} aria-labelledby={id}>
    <header className="dz-card__head"><div><h3 id={id}>{title}</h3>{subtitle && <p className="dz-card__sub">{subtitle}</p>}</div>{actions}</header>
    {children}
  </article>;
}

/** Compact KPI. With `href` the whole card is one keyboard-focusable link. */
export function DashboardMetricCard({ href, icon: Icon, value, label, hint, tone = "neutral", badge, delta, className = "" }) {
  const body = <>
    <span className="dz-metric__top">
      {Icon && <span className="dz-metric__icon" aria-hidden="true"><Icon /></span>}
      {badge && <span className={`dz-chip dz-chip--${tone}`}>{badge}</span>}
    </span>
    <strong className="dz-metric__value">{value}</strong>
    <span className="dz-metric__label">{label}</span>
    {delta}
    {hint && <small className="dz-metric__hint">{hint}</small>}
  </>;
  const cls = `dz-metric dz-metric--${tone} ${href ? "dz-metric--link" : ""} ${className}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Variation against the equivalent previous period; omitted when the backend could not validate it. */
export function DeltaBadge({ metric, previousLabel }) {
  if (!metric || metric.deltaPct == null) return null;
  const up = metric.deltaPct > 0, flat = metric.deltaPct === 0, Icon = up ? HiOutlineArrowTrendingUp : HiOutlineArrowTrendingDown;
  return <span className={`dz-delta ${flat ? "" : up ? "dz-delta--up" : "dz-delta--down"}`} title={previousLabel ? `Comparado con ${previousLabel}` : undefined}>
    {!flat && <Icon aria-hidden="true" />}
    <span className="dz-sr-only">{flat ? "Sin variación" : up ? "Aumentó" : "Disminuyó"}</span>
    {formatPct(metric.deltaPct)}<span className="dz-delta__vs"> vs. periodo anterior</span>
  </span>;
}

export function DashboardStateNotice({ tone = "loading", children, onRetry, retryLabel = "Reintentar" }) {
  return <div className={`dz-notice dz-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
    {tone === "error" ? <HiOutlineExclamationTriangle aria-hidden="true" /> : <span className="dz-spinner" aria-hidden="true" />}
    <div className="dz-notice__body">{children}</div>
    {onRetry && <button type="button" className="dz-btn dz-btn--sm" onClick={onRetry}><HiOutlineArrowPath aria-hidden="true" />{retryLabel}</button>}
  </div>;
}

export function DashboardEmptyState({ icon: Icon, title, children, compact = false }) {
  return <div className={`dz-empty ${compact ? "dz-empty--compact" : ""}`}>
    {Icon && <span className="dz-empty__icon" aria-hidden="true"><Icon /></span>}
    <p className="dz-empty__title">{title}</p>
    {children && <p className="dz-empty__text">{children}</p>}
  </div>;
}

export function StatusChip({ tone = "neutral", children }) {
  return <span className={`dz-chip dz-chip--${tone}`}>{children}</span>;
}

/** Long order numbers (DIZ-AAAAMMDD-20 hex) shown short, complete for assistive tech, copyable. */
export function OrderReference({ value }) {
  const [copied, setCopied] = useState(null);
  if (!value) return <span className="dz-ref">Sin número</span>;
  const match = /^([A-Z]+)-\d{8}-([0-9A-Z]{8,})$/i.exec(value);
  const short = match ? `${match[1]}-…${match[2].slice(-6)}` : value;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied("ok"); } catch { setCopied("error"); }
    setTimeout(() => setCopied(null), 2000);
  };
  return <span className="dz-ref">
    <span className="dz-ref__text" title={value} aria-hidden="true">{short}</span>
    <span className="dz-sr-only">Pedido {value}</span>
    <button type="button" className="dz-ref__copy" onClick={copy} aria-label={`Copiar número de pedido ${value}`} title="Copiar número completo">
      {copied === "ok" ? <HiOutlineCheck aria-hidden="true" /> : <HiOutlineDocumentDuplicate aria-hidden="true" />}
    </button>
    <span className="dz-sr-only" role="status">{copied === "ok" ? "Número copiado" : copied === "error" ? "No se pudo copiar el número" : ""}</span>
  </span>;
}

/** Product thumbnail or a neutral placeholder with initials. */
export function ProductThumb({ src, name, size = 40 }) {
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  // Decorative (the name is next to it): CSS background, no Next image runtime required.
  return src ? <span className="dz-thumb dz-thumb--image" aria-hidden="true" style={{ width: size, height: size, backgroundImage: `url(${JSON.stringify(String(src))})` }} />
    : <span className="dz-thumb dz-thumb--empty" aria-hidden="true" style={{ width: size, height: size }}>{initials}</span>;
}
