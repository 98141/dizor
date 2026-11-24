"use client";
import { useState } from "react";
import Link from "next/link";
import { HiOutlineChevronDown, HiOutlineArrowRight } from "react-icons/hi2";
import { formatNumber } from "@/lib/dashboardPeriod";

/**
 * Collapsible alert category with progressive disclosure. `rows` are the items the API
 * returned (a sample); `total` is the real count, so the footer never claims to show all.
 */
export function AlertGroup({ id, title, icon: Icon, tone = "neutral", total, description, rows = [], listTotal, listTitle, initial = 3, href, hrefLabel, children, defaultOpen = true }) {
  const listCount = listTotal ?? total;
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, initial);
  const hidden = rows.length - visible.length, partial = listCount > rows.length;
  return <section className={`dz-alert-group dz-alert-group--${tone}`} data-group={id} id={`alerta-${id}`} aria-labelledby={`alerta-${id}-title`}>
    <header className="dz-alert-group__head">
      {Icon && <span className="dz-alert-group__icon" aria-hidden="true"><Icon /></span>}
      <div className="dz-alert-group__titles">
        <h2 id={`alerta-${id}-title`}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <span className={`dz-count dz-count--${tone}`}>{formatNumber(total)}</span>
      <button type="button" className="dz-alert-group__toggle" aria-expanded={open} aria-controls={`alerta-${id}-body`} onClick={() => setOpen((v) => !v)}>
        <span className="dz-sr-only">{open ? "Contraer" : "Expandir"} {title}</span><HiOutlineChevronDown aria-hidden="true" />
      </button>
    </header>
    <div id={`alerta-${id}-body`} className="dz-alert-group__body" hidden={!open}>
      {open && <>
        {children}
        {rows.length > 0 && listTitle && <h3 className="dz-alert-group__list-title">{listTitle}</h3>}
        {rows.length > 0 && <ul className="dz-alert-list">{visible}</ul>}
        {(rows.length > initial || partial || href) && <footer className="dz-alert-group__foot">
          {rows.length > initial && <button type="button" className="dz-alert-group__more" aria-expanded={expanded} aria-controls={`alerta-${id}-body`} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ver menos" : `Ver más (${hidden})`}
          </button>}
          {rows.length > 0 && <span className="dz-alert-group__count">Mostrando {visible.length} de {formatNumber(listCount)}{partial && expanded ? " · el resumen incluye sólo los primeros registros" : ""}</span>}
          {href && <Link className="dz-link" href={href}>{hrefLabel || "Ver todos"}<HiOutlineArrowRight aria-hidden="true" /></Link>}
        </footer>}
      </>}
    </div>
  </section>;
}

/** One compact alert: affected element, reason, key data, priority and action. */
export function AlertRow({ title, titleExtra, meta, chip, value, action, children }) {
  return <li className="dz-alert-row">
    <div className="dz-alert-row__main">
      <span className="dz-alert-row__title">{title}{titleExtra}</span>
      {meta && <span className="dz-alert-row__meta">{meta}</span>}
      {children}
    </div>
    {(chip || value) && <div className="dz-alert-row__aside">{chip}{value && <span className="dz-alert-row__value">{value}</span>}</div>}
    {action && <Link className="dz-btn dz-btn--sm" href={action.href} aria-label={action.ariaLabel}>{action.label}</Link>}
  </li>;
}
