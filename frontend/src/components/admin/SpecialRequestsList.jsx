"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAdminSpecialRequests } from "@/services/specialRequestAdminService";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  getRequestBadgeClass,
} from "@/lib/specialRequestLabels";

export default function SpecialRequestsList(props) {
  return <Suspense fallback={<p role="status">Cargando solicitudes…</p>}><RequestsWorkspace {...props} /></Suspense>;
}
function RequestFilters({ query, onApply }) {
  const params = new URLSearchParams(query), [filters, setFilters] = useState({ q: params.get("q") || "", type: params.get("type") || "", status: params.get("status") || "" });
  return <form className="orders-filters" onSubmit={e => { e.preventDefault(); onApply(filters); }}>
    <input className="orders-filters__search" aria-label="Buscar solicitudes" placeholder="Número, nombre o correo" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
    <select aria-label="Tipo de solicitud" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}><option value="">Todos los tipos</option><option value="customization">Personalización</option><option value="wholesale">Por mayor</option></select>
    <select aria-label="Estado de solicitud" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}><option value="">Todos los estados</option>{Object.entries(REQUEST_STATUS_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
    <button type="submit" className="admin-btn">Buscar</button>
  </form>;
}
function RequestsWorkspace({ basePath = "/admin/solicitudes" }) {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter(), query = params.toString();
  const [state, setState] = useState(null), [version, setVersion] = useState(0);
  const page = Math.max(1, Number(params.get("page")) || 1), requestKey = query + ":" + version;
  useEffect(() => {
    let active = true;
    const filters = new URLSearchParams(query);
    getAdminSpecialRequests({ q: filters.get("q") || "", type: filters.get("type") || "", status: filters.get("status") || "", page, limit: 15 })
      .then(data => { if (active) setState({ key: requestKey, data }); })
      .catch(() => { if (active) setState({ key: requestKey, error: "No se pudieron cargar las solicitudes." }); });
    return () => { active = false; };
  // query is the stable identity of all URL parameters used by this request.
  }, [query, page, requestKey]);
  const loading = state?.key !== requestKey, error = state?.key === requestKey && state.error;
  const requests = !loading && !error ? state.data.requests || [] : [], totalPages = state?.data?.totalPages || 1;
  const href = changes => { const next = new URLSearchParams(query); Object.entries(changes).forEach(([key,value]) => value ? next.set(key,String(value)) : next.delete(key)); return pathname + (next.size ? "?" + next : ""); };
  const returnTo = pathname + (query ? "?" + query : "");

  return (
    <div>
      <RequestFilters key={query} query={query} onApply={filters => router.push(href({ ...filters, page: 1 }))} />

      {error ? <p role="alert">{error} <button type="button" className="admin-btn" onClick={() => setVersion(v => v + 1)}>Reintentar solicitudes</button></p> : loading ? (
        <p className="auth-loading" role="status">Cargando solicitudes…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td data-label="Número">
                    <Link href={`${basePath}/${r.id}?returnTo=${encodeURIComponent(returnTo)}`}>{r.requestNumber}</Link>
                  </td>
                  <td data-label="Tipo">{REQUEST_TYPE_LABELS[r.type]}</td>
                  <td data-label="Cliente">
                    {r.contact.name}
                    <br />
                    <span className="admin-muted">{r.contact.email}</span>
                  </td>
                  <td data-label="Estado">
                    <span
                      className={`request-badge ${getRequestBadgeClass(r.status)}`}
                    >
                      {REQUEST_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td data-label="Fecha">
                    {new Date(r.createdAt).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && requests.length === 0 && <p>No hay solicitudes con estos filtros.</p>}
      {!loading && !error && totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            type="button"
            className="admin-btn"
            disabled={page <= 1}
            onClick={() => router.push(href({ page: page - 1 }))}
          >
            Anterior
          </button>
          <span style={{ alignSelf: "center", fontSize: "0.9rem" }}>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="admin-btn"
            disabled={page >= totalPages}
            onClick={() => router.push(href({ page: page + 1 }))}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
