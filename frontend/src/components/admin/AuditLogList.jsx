"use client";

// Sprint 08 · Historial de auditoría. Read-only: GET /admin/audit (server pagination, 15 per
// page) and GET /admin/audit/stats. Filters and page live in the URL (q, module, action,
// result, from, to, page) so reload and browser history keep the view. Details open on demand.
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HiOutlineMagnifyingGlass, HiOutlineAdjustmentsHorizontal, HiOutlineArrowPath, HiOutlineClipboardDocumentList, HiOutlineFunnel } from "react-icons/hi2";
import { getAuditLogs, getAuditStats } from "@/services/auditAdminService";
import { getAuditActionLabel, getAuditModuleLabel, getAuditRoleLabel } from "@/lib/auditLabels";

export const AUDIT_PAGE_SIZE = 15; // backend accepts 1..100
const FILTER_KEYS = ["q", "module", "action", "result", "from", "to"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "America/Bogota";
const dayFormat = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fullFormat = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
const clean = (s) => s.replace(/\./g, "").replace(/\s+/g, " ").trim();
// "26 nov 2026" and "10:26 a m": short, unambiguous and free of the "de" fillers.
const dayPart = (d) => dayFormat.formatToParts(d).filter((p) => ["day", "month", "year"].includes(p.type)).map((p) => clean(p.value)).join(" ");
const shortParts = (v) => (v ? { day: dayPart(new Date(v)), time: clean(timeFormat.format(new Date(v))) } : null);
const shortDate = (v) => { const s = shortParts(v); return s ? `${s.day}, ${s.time}` : "Sin fecha"; };
const fullDate = (v) => (v ? `${fullFormat.format(new Date(v))} (hora de Colombia)` : "Sin fecha");

function readQuery(query) {
  const sp = new URLSearchParams(query);
  const result = sp.get("result");
  return {
    q: (sp.get("q") || "").slice(0, 120),
    module: sp.get("module") || "",
    action: sp.get("action") || "",
    result: result === "true" || result === "false" ? result : "",
    from: DATE.test(sp.get("from") || "") ? sp.get("from") : "",
    to: DATE.test(sp.get("to") || "") ? sp.get("to") : "",
    page: Math.max(1, parseInt(sp.get("page"), 10) || 1),
  };
}

function auditParams(view) {
  const params = { page: view.page, limit: AUDIT_PAGE_SIZE };
  if (view.q.trim()) params.term = view.q.trim();
  if (view.module) params.module = view.module;
  if (view.action) params.action = view.action;
  if (view.result) params.success = view.result;
  if (view.from) params.from = view.from;
  if (view.to) params.to = view.to;
  return params;
}

function hrefFor(pathname, next) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (next[key]) params.set(key, next[key]);
  if (next.page > 1) params.set("page", String(next.page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

// Display-only protection: secrets never belong in an audit payload, but if one slipped in it is not shown.
const SENSITIVE = /pass|token|secret|hash|authorization|cookie|cvv|card/i;
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? "[oculto]" : redact(v)]));
  return value;
}
function DataBlock({ title, value }) {
  if (value == null) return null;
  const safe = redact(value);
  const flat = safe && typeof safe === "object" && !Array.isArray(safe) && Object.values(safe).every((v) => v === null || typeof v !== "object");
  return <div className="cf-data">
    <p className="cf-data__title">{title}</p>
    {flat
      ? <dl className="cf-kv">{Object.entries(safe).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v === null ? "—" : String(v)}</dd></div>)}</dl>
      : <pre>{JSON.stringify(safe, null, 2)}</pre>}
  </div>;
}

function AuditDetail({ log }) {
  return <div className="cf-detail">
    <dl className="cf-dl cf-dl--grid">
      <div><dt>Fecha completa</dt><dd>{fullDate(log.createdAt)}</dd></div>
      <div><dt>Usuario</dt><dd className="cf-break">{log.userEmail || "Sin usuario registrado"}</dd></div>
      <div><dt>Rol</dt><dd>{getAuditRoleLabel(log.role)}</dd></div>
      <div><dt>Acción</dt><dd>{getAuditActionLabel(log.action)}</dd></div>
      <div><dt>Módulo</dt><dd>{getAuditModuleLabel(log.module)}</dd></div>
      <div><dt>Resultado</dt><dd>{log.success ? "Exitoso" : "Fallido"}</dd></div>
      <div className="cf-dl__wide"><dt>Descripción</dt><dd className="cf-break">{log.summary || "Sin descripción registrada"}</dd></div>
      {(log.entityType || log.entityId) && <div><dt>Referencia</dt><dd className="cf-break cf-mono">{[log.entityType, log.entityId].filter(Boolean).join(" · ")}</dd></div>}
      {log.ip && <div><dt>IP</dt><dd className="cf-mono">{log.ip}</dd></div>}
    </dl>
    {(log.previousData != null || log.newData != null) && <div className="cf-detail__data">
      <DataBlock title="Datos anteriores" value={log.previousData} />
      <DataBlock title="Datos nuevos" value={log.newData} />
    </div>}
  </div>;
}

export default function AuditLogList() {
  const searchParams = useSearchParams(), router = useRouter(), pathname = usePathname();
  const query = searchParams.toString();
  const applied = readQuery(query);
  // Draft filters follow the URL until the person edits them (no effect needed).
  const [draftState, setDraftState] = useState({ query, values: applied });
  const draft = draftState.query === query ? draftState.values : applied;
  const setDraft = (patch) => setDraftState({ query, values: { ...draft, ...patch } });

  // Each answer is tagged with the query and attempt it belongs to; the status is derived from
  // that tag, so a late answer for an older query never replaces the current view.
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null); // { key, ok, data } — data is the last confirmed page
  const [statsAttempt, setStatsAttempt] = useState(0);
  const [statsResult, setStatsResult] = useState(null); // { attempt, ok, stats }
  const [expanded, setExpanded] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateError, setDateError] = useState("");
  const listTop = useRef(null);

  const key = `${query}#${attempt}`;
  useEffect(() => {
    let current = true;
    const view = readQuery(query), tag = `${query}#${attempt}`;
    getAuditLogs(auditParams(view)).then((res) => {
      if (!current) return;
      setResult({ key: tag, ok: true, data: { logs: res.logs || [], total: res.total ?? 0, totalPages: res.totalPages || 1, page: res.page || view.page, filters: res.filters || { modules: [], actions: [] } } });
    }).catch(() => {
      if (current) setResult((prev) => ({ key: tag, ok: false, data: prev?.data ?? null }));
    });
    return () => { current = false; };
  }, [query, attempt]);

  useEffect(() => {
    let current = true;
    getAuditStats()
      .then((res) => { if (current) setStatsResult({ attempt: statsAttempt, ok: true, stats: res.stats }); })
      .catch(() => { if (current) setStatsResult({ attempt: statsAttempt, ok: false, stats: null }); });
    return () => { current = false; };
  }, [statsAttempt]);

  const status = result?.key === key ? (result.ok ? "ready" : "error") : "loading";
  const data = result?.data ?? null;
  const stats = statsResult?.ok ? statsResult.stats : null;
  const statsError = statsResult?.attempt === statsAttempt && !statsResult.ok;

  // A stale URL beyond the last page goes to the last real page.
  const lastPage = status === "ready" && data.total > 0 && applied.page > data.totalPages ? data.totalPages : 0;
  useEffect(() => {
    if (lastPage) router.replace(hrefFor(pathname, { ...readQuery(query), page: lastPage }), { scroll: false });
  }, [lastPage, pathname, query, router]);

  const go = (next) => router.push(hrefFor(pathname, next), { scroll: false });
  const loadLogs = () => setAttempt((n) => n + 1);
  const loadStats = () => setStatsAttempt((n) => n + 1);

  const apply = (patch) => {
    const next = { ...draft, ...patch };
    if (next.from && next.to && next.from > next.to) { setDraft(patch); setDateError("La fecha inicial no puede ser posterior a la fecha final."); return; }
    setDateError("");
    setExpanded(null);
    go({ ...next, page: 1 });
  };
  const clear = () => { setDateError(""); setExpanded(null); go({ page: 1 }); };
  const changePage = (page) => { setExpanded(null); go({ ...applied, page }); listTop.current?.scrollIntoView({ block: "start" }); };

  const advancedCount = ["module", "action", "result", "from", "to"].filter((k) => applied[k]).length;
  const filtered = advancedCount > 0 || !!applied.q;
  const union = (list = [], value) => (value && !list.includes(value) ? [...list, value] : list);
  const modules = union(data?.filters.modules, applied.module), actions = union(data?.filters.actions, applied.action);
  const logs = data?.logs || [];
  const first = data ? (data.page - 1) * AUDIT_PAGE_SIZE + 1 : 0, last = data ? first + logs.length - 1 : 0;

  const kpis = [["Eventos totales", stats?.total, ""], ["Hoy", stats?.today, "Día civil de Colombia"], ["Fallidos", stats?.failed, ""]];

  return (
    <div className="cf-audit-list">
      <div className="cf-kpis" aria-label="Indicadores del historial completo" role="group">
        {kpis.map(([label, value, hint], i) => <div key={label} className={`cf-kpi${i === 2 && value > 0 ? " cf-kpi--danger" : ""}`}>
          <span className="cf-kpi__value">{stats ? value.toLocaleString("es-CO") : statsError ? "—" : "…"}</span>
          <span className="cf-kpi__label">{label}</span>
          {hint && <span className="cf-kpi__hint">{hint}</span>}
        </div>)}
        {statsError && <p className="cf-kpis__error" role="alert">Indicadores no disponibles. <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm" onClick={loadStats}>Reintentar indicadores</button></p>}
      </div>

      <form className="cf-audit-filters" role="search" aria-label="Filtrar historial" onSubmit={(e) => { e.preventDefault(); apply({}); }}>
        <div className="cf-audit-filters__main">
          <label className="cf-field cf-field--search" htmlFor="cf-audit-q">
            <span className="cf-field__label">Buscar eventos</span>
            <HiOutlineMagnifyingGlass aria-hidden="true" />
            <input id="cf-audit-q" type="search" maxLength={120} placeholder="Correo, acción, módulo o descripción" value={draft.q} onChange={(e) => setDraft({ q: e.target.value })} />
          </label>
          <button type="submit" className="admin-btn">Buscar</button>
          <button id="cf-audit-filters-toggle" type="button" className="admin-btn cf-audit-filters__toggle" aria-expanded={filtersOpen} aria-controls="cf-audit-advanced" onClick={() => setFiltersOpen((v) => !v)}>
            <HiOutlineAdjustmentsHorizontal aria-hidden="true" />Filtros{advancedCount ? ` (${advancedCount})` : ""}
          </button>
        </div>
        <div id="cf-audit-advanced" className={`cf-audit-filters__advanced${filtersOpen ? "" : " is-collapsed"}`}>
          <label className="cf-field" htmlFor="cf-audit-module"><span className="cf-field__label">Módulo</span>
            <select id="cf-audit-module" value={draft.module} onChange={(e) => apply({ module: e.target.value })}>
              <option value="">Todos los módulos</option>
              {modules.map((m) => <option key={m} value={m}>{getAuditModuleLabel(m)}</option>)}
            </select></label>
          <label className="cf-field" htmlFor="cf-audit-action"><span className="cf-field__label">Acción</span>
            <select id="cf-audit-action" value={draft.action} onChange={(e) => apply({ action: e.target.value })}>
              <option value="">Todas las acciones</option>
              {actions.map((a) => <option key={a} value={a}>{getAuditActionLabel(a)}</option>)}
            </select></label>
          <label className="cf-field" htmlFor="cf-audit-result"><span className="cf-field__label">Resultado</span>
            <select id="cf-audit-result" value={draft.result} onChange={(e) => apply({ result: e.target.value })}>
              <option value="">Todos</option>
              <option value="true">Exitosos</option>
              <option value="false">Fallidos</option>
            </select></label>
          <label className="cf-field" htmlFor="cf-audit-from"><span className="cf-field__label">Desde</span>
            <input id="cf-audit-from" type="date" value={draft.from} aria-invalid={dateError ? true : undefined} aria-describedby={dateError ? "cf-audit-date-error" : undefined} onChange={(e) => setDraft({ from: e.target.value })} /></label>
          <label className="cf-field" htmlFor="cf-audit-to"><span className="cf-field__label">Hasta</span>
            <input id="cf-audit-to" type="date" value={draft.to} aria-invalid={dateError ? true : undefined} aria-describedby={dateError ? "cf-audit-date-error" : undefined} onChange={(e) => setDraft({ to: e.target.value })} /></label>
          <div className="cf-audit-filters__actions">
            <button type="submit" className="admin-btn">Aplicar fechas</button>
            {filtered && <button type="button" className="admin-btn admin-btn--tertiary" onClick={clear}>Limpiar filtros</button>}
          </div>
          {dateError && <p id="cf-audit-date-error" className="cf-field-error" role="alert">{dateError}</p>}
        </div>
      </form>

      <section ref={listTop} className="cf-audit" aria-labelledby="cf-audit-title" aria-busy={status === "loading"}>
        <div className="cf-section-head">
          <h2 id="cf-audit-title" className="cf-sr-only">Eventos</h2>
          {status === "ready" && data.total > 0 && <p className="cf-count" role="status">
            {data.total === 1 ? "1 evento" : `${data.total.toLocaleString("es-CO")} eventos`}{filtered ? " con estos filtros" : ""}{data.totalPages > 1 ? ` · ${first}–${last}` : ""}
          </p>}
        </div>

        {status === "error" && <div className="cf-notice cf-notice--error" role="alert">
          <p><strong>No se pudo consultar el historial.</strong> No se muestran eventos porque la consulta falló; no significa que no existan.</p>
          <button type="button" className="admin-btn admin-btn--sm" onClick={loadLogs}><HiOutlineArrowPath aria-hidden="true" />Reintentar historial</button>
        </div>}

        {status === "loading" && !data && <><p role="status" className="cf-sr-only">Cargando historial…</p><div className="cf-skeleton-list" aria-hidden="true"><span /><span /><span /><span /></div></>}

        {status === "ready" && data.total === 0 && (filtered
          ? <div className="cf-empty"><span className="cf-empty__icon" aria-hidden="true"><HiOutlineFunnel /></span><p className="cf-empty__title">Sin coincidencias</p><p className="cf-hint">Ningún evento cumple estos filtros. Prueba con otro rango o módulo.</p><button type="button" className="admin-btn" onClick={clear}>Limpiar filtros</button></div>
          : <div className="cf-empty"><span className="cf-empty__icon" aria-hidden="true"><HiOutlineClipboardDocumentList /></span><p className="cf-empty__title">Aún no hay eventos registrados.</p><p className="cf-hint">Los inicios de sesión y los cambios de la administración aparecerán aquí.</p></div>)}

        {status !== "error" && logs.length > 0 && <div className={`cf-table-wrap${status === "loading" ? " is-stale" : ""}`}>
          <table className="cf-table cf-audit__table">
            <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Usuario</th><th scope="col">Módulo</th><th scope="col">Acción</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
            <tbody>
              {logs.map((log) => {
                const open = expanded === log.id, date = shortDate(log.createdAt), parts = shortParts(log.createdAt), action = getAuditActionLabel(log.action), detailId = `audit-detail-${log.id}`;
                const local = log.userEmail ? log.userEmail.split("@")[0] : "";
                return <Fragment key={log.id}>
                  <tr className={`cf-audit__row${open ? " is-open" : ""}`}>
                    <td className="cf-audit__date">{parts ? <time dateTime={log.createdAt}><span className="cf-audit__day">{parts.day}</span><span className="cf-audit__time">{parts.time}</span></time> : "Sin fecha"}</td>
                    <td className="cf-audit__user">
                      <span className="cf-ellipsis cf-audit__email" title={log.userEmail || undefined}>{log.userEmail || "Sin usuario"}</span>
                      <span className="cf-audit__email-short">{local || "Sin usuario"}</span>
                      <span className="cf-sub cf-audit__role">{getAuditRoleLabel(log.role)}</span>
                    </td>
                    <td className="cf-audit__module">{getAuditModuleLabel(log.module)}</td>
                    <td className="cf-audit__action"><span className="cf-strong">{action}</span>{log.summary && <span className="cf-sub cf-ellipsis cf-audit__summary">{log.summary}</span>}</td>
                    <td className="cf-audit__result"><span className={`cf-chip ${log.success ? "cf-chip--ok" : "cf-chip--danger"}`}>{log.success ? "Exitoso" : "Fallido"}</span></td>
                    <td className="cf-audit__more">
                      <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm cf-audit__toggle" aria-expanded={open} aria-controls={detailId}
                        aria-label={`${open ? "Ocultar" : "Ver"} detalle de ${action}, ${date}`} onClick={() => setExpanded(open ? null : log.id)}>
                        {open ? "Ocultar" : "Ver detalle"}
                      </button>
                    </td>
                  </tr>
                  {open && <tr id={detailId} className="cf-audit__detail"><td colSpan={6}><AuditDetail log={log} /></td></tr>}
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>}

        {status !== "error" && data && data.totalPages > 1 && <nav className="cf-pagination" aria-label="Paginación del historial">
          <button type="button" className="admin-btn admin-btn--sm" disabled={status === "loading" || data.page <= 1} onClick={() => changePage(data.page - 1)}>Anterior</button>
          <span>Página {data.page} de {data.totalPages}</span>
          <button type="button" className="admin-btn admin-btn--sm" disabled={status === "loading" || data.page >= data.totalPages} onClick={() => changePage(data.page + 1)}>Siguiente</button>
        </nav>}
      </section>
    </div>
  );
}
