"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineInboxStack, HiOutlineFunnel, HiOutlineShieldCheck, HiOutlineXMark } from "react-icons/hi2";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import {
  adminListCustomerRequests,
  adminGetCustomerRequest,
  adminUpdateCustomerRequestStatus,
} from "@/services/customerRequestService";
import { CATEGORY_LABELS, TYPE_LABELS, STATUS_LABELS } from "@/lib/customerRequestLabels";
import { DashboardEmptyState } from "@/components/admin/dashboard/DashboardUI";
import { AttentionHeader, PqrCategoryChip, PqrStatusChip, formatWhen } from "@/components/admin/attention/AttentionUI";

// Gestión de PQR y solicitudes de titulares (H-22, H-11). Solo administradores: incluye datos
// personales y solicitudes de supresión. Sprint 04: presentation only; same endpoints, payloads,
// generation guard, lock against double submit and history semantics.
const PAGE_SIZE = 30; // backend default limit of /admin/pqr

function PqrAdmin() {
  const [filters, setFilters] = useState({ category: "", status: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ requests: [], total: 0 });
  const [selected, setSelected] = useState(null);
  const [update, setUpdate] = useState({ status: "en_tramite", publicNote: "", internalNote: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(null);
  const [message, setMessage] = useState("");
  const lock = useRef(false), generation = useRef(0), detailTitle = useRef(null);

  const load = useCallback(() => {
    const ticket = ++generation.current;
    const params = { page };
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    return adminListCustomerRequests(params).then(response => {
      if (ticket !== generation.current) return;
      setData(response);
      setError("");
    }).catch(err => {
      if (ticket !== generation.current) return;
      setError(err.response?.data?.message || "No se pudieron cargar las solicitudes");
    }).finally(() => { if (ticket === generation.current) setLoading(false); });
  }, [filters, page]);
  const cancelLoads = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    load();
    return cancelLoads;
  }, [load, cancelLoads]);

  const changeFilter = (key, value) => { setLoading(true); setPage(1); setFilters((f) => ({ ...f, [key]: value })); };
  const open = async (id) => {
    setOpening(id);
    try {
      const res = await adminGetCustomerRequest(id);
      setSelected(res.request);
      setMessage("");
      setUpdate({ status: res.request.status, publicNote: "", internalNote: "" });
      requestAnimationFrame(() => { detailTitle.current?.focus(); detailTitle.current?.scrollIntoView({ block: "start" }); });
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo abrir la solicitud");
    } finally { setOpening(null); }
  };

  const save = async () => {
    if (lock.current || !selected) return;
    lock.current = true;
    setSaving(true); setMessage(""); setError("");
    try {
      const res = await adminUpdateCustomerRequestStatus(selected.id, update);
      setSelected(res.request);
      setUpdate((u) => ({ ...u, publicNote: "", internalNote: "" }));
      setMessage("Cambio de estado guardado y confirmado en el historial.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo actualizar");
    } finally { lock.current = false; setSaving(false); }
  };

  const filtered = !!(filters.category || filters.status);
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const history = selected ? [...(selected.history || [])].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)) : [];
  const personal = selected?.category === "datos_personales";

  return (
    <div className="admin-page dz-page cs-page">
      <section className="cs-section" aria-labelledby="cs-pqr-title">
        <div className="cs-section__head">
          <div>
            <h2 id="cs-pqr-title">PQR y datos personales</h2>
            <p className="cs-section__desc">Peticiones, quejas y reclamos de consumo, y solicitudes de titulares de datos personales. Cada cambio de estado queda en el historial.</p>
          </div>
          {!loading && !error && <p className="cs-count" role="status">{data.total === 1 ? "1 radicado" : `${data.total || 0} radicados`}{totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}</p>}
        </div>

        <div className="cs-toolbar" role="group" aria-label="Filtrar PQR">
          <label className="cs-field"><span className="cs-field__label">Categoría</span>
            <select value={filters.category} onChange={(e) => changeFilter("category", e.target.value)}>
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="cs-field"><span className="cs-field__label">Estado</span>
            <select value={filters.status} onChange={(e) => changeFilter("status", e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {filtered && <div className="cs-toolbar__actions"><button type="button" className="admin-btn admin-btn--tertiary" onClick={() => { setLoading(true); setPage(1); setFilters({ category: "", status: "" }); }}>Limpiar filtros</button></div>}
        </div>

        {error && <div className="admin-feedback admin-feedback--error cs-alert" role="alert"><span>{error}</span><button type="button" className="admin-btn admin-btn--sm" onClick={() => { setLoading(true); load(); }}>Reintentar PQR</button></div>}
        {message && <p role="status" className="admin-feedback admin-feedback--success">{message}</p>}
        {loading && <div className="cs-skeleton" aria-busy="true"><p className="dz-sr-only" role="status">Cargando solicitudes…</p>{[0, 1, 2].map((i) => <span key={i} />)}</div>}

        {!loading && !error && data.requests.length === 0 && (filtered
          ? <div className="cs-empty"><DashboardEmptyState icon={HiOutlineFunnel} title="Sin solicitudes con estos filtros">Cambia la categoría o el estado para ver otros radicados.</DashboardEmptyState><button type="button" className="admin-btn" onClick={() => { setLoading(true); setPage(1); setFilters({ category: "", status: "" }); }}>Limpiar filtros</button></div>
          : <div className="cs-empty"><DashboardEmptyState icon={HiOutlineInboxStack} title="Sin solicitudes.">Aquí aparecerán las PQR y las solicitudes sobre datos personales que radiquen los clientes.</DashboardEmptyState></div>)}

        {!loading && data.requests.length > 0 && <div className="cs-table-wrap">
          <table className="admin-table cs-table cs-table--pqr">
            <caption className="dz-sr-only">Radicados de PQR y datos personales, página {page} de {totalPages}</caption>
            <thead><tr><th scope="col">Radicado</th><th scope="col">Recibida</th><th scope="col">Categoría</th><th scope="col">Motivo</th><th scope="col">Estado</th><th scope="col"><span className="dz-sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {data.requests.map((r) => <tr key={r.id} className={selected?.id === r.id ? "is-selected" : undefined}>
                <td data-label="Radicado" className="cs-cell-ref"><span className="cs-ref">{r.radicado}</span></td>
                <td data-label="Recibida" className="cs-cell-date"><time dateTime={r.receivedAt}>{formatWhen(r.receivedAt)}</time></td>
                <td data-label="Categoría" className="cs-cell-type"><PqrCategoryChip category={r.category} /></td>
                <td data-label="Motivo" className="cs-cell-client"><span className="cs-strong">{TYPE_LABELS[r.type] || r.type}</span></td>
                <td data-label="Estado" className="cs-cell-status"><PqrStatusChip status={r.status} /></td>
                <td className="cs-cell-action"><button type="button" className="admin-btn admin-btn--sm" aria-label={`Ver ${r.radicado}`} aria-expanded={selected?.id === r.id} aria-busy={opening === r.id} disabled={!!opening} onClick={() => open(r.id)}>Ver</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>}

        {!loading && !error && totalPages > 1 && <nav className="cs-pagination" aria-label="Paginación de PQR">
          <button type="button" className="admin-btn admin-btn--sm" disabled={page <= 1} onClick={() => { setLoading(true); setPage((p) => p - 1); }}>Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" className="admin-btn admin-btn--sm" disabled={page >= totalPages} onClick={() => { setLoading(true); setPage((p) => p + 1); }}>Siguiente</button>
        </nav>}
      </section>

      {selected && (
        <section className={`dz-card cs-card cs-pqr-detail ${personal ? "cs-pqr-detail--data" : ""}`} aria-labelledby="cs-pqr-detail-title">
          <header className="cs-pqr-detail__head">
            <div>
              <p className="dz-eyebrow">{CATEGORY_LABELS[selected.category]}</p>
              <h2 id="cs-pqr-detail-title" ref={detailTitle} tabIndex={-1}>{selected.radicado}</h2>
              <div className="cs-detail-head__chips"><PqrStatusChip status={selected.status} /><PqrCategoryChip category={selected.category} /><span className="dz-chip dz-chip--neutral">{TYPE_LABELS[selected.type] || selected.type}</span></div>
            </div>
            <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm" onClick={() => setSelected(null)}><HiOutlineXMark aria-hidden="true" />Cerrar detalle</button>
          </header>
          {personal && <p className="cs-data-note"><HiOutlineShieldCheck aria-hidden="true" />Solicitud de titular de datos personales. Contiene datos de contacto e información privada; trátala solo con personal autorizado.</p>}
          <div className="cs-pqr-detail__grid">
            <div>
              <dl className="cs-rows cs-rows--stack">
                <div className="cs-row"><dt>Recibida</dt><dd>{formatWhen(selected.receivedAt)}</dd></div>
                <div className="cs-row"><dt>Solicitante</dt><dd>{selected.contact?.name}</dd></div>
                <div className="cs-row"><dt>Correo</dt><dd className="cs-break">{selected.contact?.email}</dd></div>
                {selected.contact?.phone ? <div className="cs-row"><dt>Teléfono</dt><dd>{selected.contact.phone}</dd></div> : null}
                {selected.orderNumber ? <div className="cs-row"><dt>Pedido</dt><dd className="cs-break">{selected.orderNumber}</dd></div> : null}
              </dl>
              <h3 className="cs-subtitle">Descripción</h3>
              <p className="cs-longtext">{selected.description}</p>
              <h3 className="cs-subtitle">Historial</h3>
              <ol className="cs-timeline">{history.map((h, i) => <li key={`${h.changedAt}-${i}`}>
                <span className="cs-timeline__dot" aria-hidden="true" />
                <div><p className="cs-timeline__title"><strong>{STATUS_LABELS[h.status] || h.status}</strong> <time dateTime={h.changedAt}>{formatWhen(h.changedAt)}</time></p>
                  {h.publicNote ? <p className="cs-timeline__note"><span className="cs-visibility cs-visibility--public">Nota al solicitante</span> {h.publicNote}</p> : null}
                  {h.internalNote ? <p className="cs-timeline__note"><span className="cs-visibility">Nota interna</span> {h.internalNote}</p> : null}</div>
              </li>)}</ol>
            </div>
            <div className="cs-pqr-detail__form">
              <h3 className="cs-subtitle">Actualizar estado</h3>
              <fieldset disabled={saving} aria-busy={saving} className="cs-fieldset"><legend>Registro del cambio</legend>
                <label>Nuevo estado<select value={update.status} onChange={(e) => setUpdate((u) => ({ ...u, status: e.target.value }))}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
                <label>Nota visible para el solicitante (opcional)<textarea rows={3} placeholder="Se mostrará en el seguimiento del radicado." value={update.publicNote} onChange={(e) => setUpdate((u) => ({ ...u, publicNote: e.target.value }))} /></label>
                <label>Nota interna (no visible para el solicitante)<textarea rows={2} placeholder="Solo para el equipo." value={update.internalNote} onChange={(e) => setUpdate((u) => ({ ...u, internalNote: e.target.value }))} /></label>
                <button type="button" className="admin-btn admin-btn--primary" disabled={saving} aria-busy={saving} onClick={save}>{saving ? "Guardando cambio…" : "Guardar cambio de estado"}</button>
              </fieldset>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function AdminPqrPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin" pageHeader={<AttentionHeader />}>
        <PqrAdmin />
      </AdminShell>
    </RoleRoute>
  );
}
