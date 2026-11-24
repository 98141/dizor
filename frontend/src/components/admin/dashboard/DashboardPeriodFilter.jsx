"use client";
import { useState } from "react";
import { HiOutlineCalendarDays } from "react-icons/hi2";
import { PERIOD_OPTIONS, todayInBogota, shiftDate, validateRange } from "@/lib/dashboardPeriod";

/**
 * Segmented control on wide screens, native select on narrow ones (only one is displayed).
 * `onChange({ option, from, to })` receives a validated period; the page stores it in the URL.
 */
export default function DashboardPeriodFilter({ period, onChange, disabled = false }) {
  const [customOpen, setCustomOpen] = useState(period.option.api === "custom");
  const [draft, setDraft] = useState(() => ({ from: period.from || shiftDate(todayInBogota(), -29), to: period.to || todayInBogota() }));
  const [error, setError] = useState("");
  const showCustom = customOpen || period.option.api === "custom";
  const choose = (url) => {
    const option = PERIOD_OPTIONS.find((o) => o.url === url);
    if (option.api === "custom") { setCustomOpen(true); return; }
    setCustomOpen(false); setError(""); onChange({ option, from: "", to: "" });
  };
  const apply = (event) => {
    event.preventDefault();
    const message = validateRange(draft.from, draft.to);
    setError(message);
    if (!message) onChange({ option: PERIOD_OPTIONS.find((o) => o.api === "custom"), from: draft.from, to: draft.to });
  };
  const selected = showCustom ? "personalizado" : period.option.url;
  return <div className="dz-period">
    <p className="dz-period__label" id="dz-period-label"><HiOutlineCalendarDays aria-hidden="true" />Periodo de análisis</p>
    <div className="dz-period__segmented" role="group" aria-labelledby="dz-period-label">
      {PERIOD_OPTIONS.map((o) => <button key={o.url} type="button" className="dz-period__option" aria-pressed={selected === o.url} disabled={disabled} onClick={() => choose(o.url)}>{o.label}</button>)}
    </div>
    <label className="dz-period__select">
      <span className="dz-sr-only">Periodo de análisis</span>
      <select value={selected} disabled={disabled} onChange={(e) => choose(e.target.value)}>
        {PERIOD_OPTIONS.map((o) => <option key={o.url} value={o.url}>{o.label === "7 días" || o.label === "30 días" ? `Últimos ${o.label}` : o.label}</option>)}
      </select>
    </label>
    {showCustom && <form className="dz-period__custom" onSubmit={apply} noValidate>
      <label htmlFor="dz-period-from">Desde<input id="dz-period-from" type="date" value={draft.from} max={todayInBogota()} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} aria-invalid={!!error} aria-describedby={error ? "dz-period-error" : undefined} /></label>
      <label htmlFor="dz-period-to">Hasta<input id="dz-period-to" type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} aria-invalid={!!error} aria-describedby={error ? "dz-period-error" : undefined} /></label>
      <button type="submit" className="dz-btn dz-btn--sm" disabled={disabled}>Aplicar rango</button>
      {error && <p className="dz-period__error" id="dz-period-error" role="alert">{error}</p>}
    </form>}
  </div>;
}
