"use client";
// Lightweight SVG charts (no chart dependency). Pixel-based SVG sized from the container so
// text stays crisp; every value is also available in a data table.
import { useEffect, useRef, useState } from "react";
import { HiOutlineChartBar } from "react-icons/hi2";
import { formatCOP } from "@/lib/formatCurrency";
import { bucketLabel, formatCompactCOP, formatNumber } from "@/lib/dashboardPeriod";
import { DashboardEmptyState } from "./DashboardUI";

function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
function niceMax(value) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value)), f = value / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}
const GRANULARITY_TEXT = { hour: "por hora", day: "por día", week: "por semana", month: "por mes" };

export function SalesTrendChart({ series, granularity, title = "Evolución de ventas conciliadas" }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const [announce, setAnnounce] = useState("");
  const total = series.reduce((s, p) => s + p.sales, 0);
  if (!series.length || total === 0) {
    return <DashboardEmptyState icon={HiOutlineChartBar} title="Sin ventas conciliadas en el periodo">
      La gráfica aparece cuando hay pedidos pagados y sin incidencias creados en estas fechas.
    </DashboardEmptyState>;
  }
  const height = width < 480 ? 176 : 216, m = { top: 14, right: 14, bottom: 28, left: width < 480 ? 48 : 58 };
  const plotW = width - m.left - m.right, plotH = height - m.top - m.bottom;
  const max = niceMax(Math.max(...series.map((p) => p.sales)) * 1.08), ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const x = (i) => m.left + (series.length === 1 ? plotW / 2 : (i * plotW) / (series.length - 1));
  const y = (v) => m.top + plotH - (v / max) * plotH;
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.sales).toFixed(1)}`).join("");
  const area = `${line}L${x(series.length - 1).toFixed(1)},${m.top + plotH}L${x(0).toFixed(1)},${m.top + plotH}Z`;
  // Evenly spaced x labels; the count follows the measured width and the longest label.
  const labelW = Math.max(...series.map((p) => bucketLabel(p, granularity).length)) * 6.6 + 14;
  // The first/last labels are anchored to the edges, so neighbours need 1.5 label widths.
  const labelCount = Math.min(series.length, Math.max(2, Math.floor(plotW / (labelW * 1.5)) + 1));
  const labelIdx = series.length === 1 ? [0] : [...new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (series.length - 1)) / (labelCount - 1))))];
  const describe = (i) => { const p = series[i]; return `${bucketLabel(p, granularity, true)}: ${formatCOP(p.sales)}, ${p.orders} ${p.orders === 1 ? "pedido conciliado" : "pedidos conciliados"}`; };
  const select = (i, keyboard) => { setActive(i); if (keyboard) setAnnounce(describe(i)); };
  const onKey = (e) => {
    const last = series.length - 1, current = active ?? last;
    const next = { ArrowRight: Math.min(last, current + 1), ArrowLeft: Math.max(0, current - 1), Home: 0, End: last }[e.key];
    if (next === undefined) { if (e.key === "Escape") setActive(null); return; }
    e.preventDefault(); select(next, true);
  };
  const onPointer = (e) => {
    const box = e.currentTarget.getBoundingClientRect(), px = e.clientX - box.left;
    const i = series.length === 1 ? 0 : Math.round(((px - m.left) / plotW) * (series.length - 1));
    select(Math.min(series.length - 1, Math.max(0, i)), false);
  };
  const point = active == null ? null : series[active];
  const tipLeft = point ? Math.min(Math.max(x(active), 90), width - 90) : 0;
  return <div className="dz-trend" ref={ref}>
    <div className="dz-trend__plot" tabIndex={0} role="group" aria-roledescription="gráfica de líneas"
      aria-label={`${title}, ${GRANULARITY_TEXT[granularity]}. Usa las flechas izquierda y derecha para recorrer los valores; la tabla de datos está debajo.`}
      onKeyDown={onKey} onPointerMove={onPointer} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}>
      <svg width={width} height={height} aria-hidden="true" focusable="false">
        {ticks.map((t) => <g key={t}>
          <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="dz-chart__grid" />
          <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="dz-chart__tick">{formatCompactCOP(t)}</text>
        </g>)}
        <path d={area} className="dz-trend__area" />
        <path d={line} className="dz-trend__line" />
        {labelIdx.map((i) => <text key={series[i].key} x={x(i)} y={height - 8} textAnchor={series.length === 1 ? "middle" : i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} className="dz-chart__tick">{bucketLabel(series[i], granularity)}</text>)}
        {point && <g>
          <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + plotH} className="dz-trend__cursor" />
          <circle cx={x(active)} cy={y(point.sales)} r="5" className="dz-trend__dot" />
        </g>}
      </svg>
      {point && <div className="dz-trend__tooltip" style={{ left: tipLeft }} aria-hidden="true">
        <strong>{formatCOP(point.sales)}</strong>
        <span>{bucketLabel(point, granularity, true)}</span>
        <span>{point.orders} {point.orders === 1 ? "pedido conciliado" : "pedidos conciliados"}</span>
      </div>}
    </div>
    <p className="dz-sr-only" aria-live="polite">{announce}</p>
    <details className="dz-table-toggle">
      <summary>Ver datos en tabla</summary>
      <div className="dz-table-scroll">
        <table className="dz-data-table">
          <caption className="dz-sr-only">{title} {GRANULARITY_TEXT[granularity]}</caption>
          <thead><tr><th scope="col">Periodo</th><th scope="col">Ventas conciliadas</th><th scope="col">Pedidos conciliados</th></tr></thead>
          <tbody>{series.map((p) => <tr key={p.key}><th scope="row">{bucketLabel(p, granularity, true)}</th><td>{formatCOP(p.sales)}</td><td>{p.orders}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </div>;
}

/** Exclusive operational states as bars; the review indicator overlaps them and is shown apart. */
export function OrderDistribution({ distribution }) {
  if (!distribution.total) {
    return <DashboardEmptyState icon={HiOutlineChartBar} title="Sin pedidos registrados en el periodo" compact />;
  }
  const max = Math.max(...distribution.statuses.map((s) => s.count), 1);
  return <div className="dz-dist">
    <ul className="dz-dist__list">
      {distribution.statuses.map((s) => {
        const pct = Math.round((s.count / distribution.total) * 100);
        return <li key={s.key} className={`dz-dist__row ${["cancelled", "returned", "other"].includes(s.key) ? "dz-dist__row--closed" : ""}`}>
          <span className="dz-dist__label">{s.label}</span>
          <span className="dz-dist__track" aria-hidden="true"><span className="dz-dist__bar" style={{ width: s.count ? `max(4px, ${(s.count / max) * 100}%)` : 0 }} /></span>
          <span className="dz-dist__value"><strong>{formatNumber(s.count)}</strong><span className="dz-dist__pct">{pct} %</span></span>
        </li>;
      })}
    </ul>
    <p className="dz-dist__total">{formatNumber(distribution.total)} {distribution.total === 1 ? "pedido creado" : "pedidos creados"} en el periodo, según su estado actual.</p>
    <p className={`dz-dist__review ${distribution.review ? "dz-dist__review--alert" : ""}`}>
      <strong>{formatNumber(distribution.review)}</strong> Requieren revisión
      <span>Indicador que puede coincidir con cualquiera de los estados anteriores; no se suma al total.</span>
    </p>
  </div>;
}
