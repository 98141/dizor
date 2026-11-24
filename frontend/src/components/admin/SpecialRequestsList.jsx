"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HiOutlineMagnifyingGlass, HiOutlineInboxStack, HiOutlineFunnel, HiOutlineArrowRight } from "react-icons/hi2";
import { useAuth } from "@/context/AuthContext";
import { getAdminSpecialRequests } from "@/services/specialRequestAdminService";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/specialRequestLabels";
import { formatCOP } from "@/lib/formatCurrency";
import { DashboardEmptyState, DashboardStateNotice } from "@/components/admin/dashboard/DashboardUI";
import { RequestStatusChip, formatWhen } from "@/components/admin/attention/AttentionUI";

const PAGE_SIZE = 15;
const FILTER_KEYS = ["q", "type", "status"];

export default function SpecialRequestsList(props) {
  return <Suspense fallback={<p role="status">Cargando solicitudes…</p>}><RequestsWorkspace {...props} /></Suspense>;
}

function RequestFilters({ query, onApply, onClear }) {
  const params = new URLSearchParams(query);
  const [filters, setFilters] = useState({ q: params.get("q") || "", type: params.get("type") || "", status: params.get("status") || "" });
  const active = FILTER_KEYS.some((k) => params.get(k));
  return <form className="cs-toolbar" role="search" aria-label="Filtrar solicitudes" onSubmit={(e) => { e.preventDefault(); onApply(filters); }}>
    <label className="cs-field cs-field--search">
      <span className="dz-sr-only">Buscar solicitudes</span>
      <HiOutlineMagnifyingGlass aria-hidden="true" />
      <input className="orders-filters__search" aria-label="Buscar solicitudes" placeholder="Número, nombre, correo o producto" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
    </label>
    <label className="cs-field"><span className="cs-field__label">Tipo</span>
      <select aria-label="Tipo de solicitud" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
        <option value="">Todos los tipos</option>
        {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <label className="cs-field"><span className="cs-field__label">Estado</span>
      <select aria-label="Estado de solicitud" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
        <option value="">Todos los estados</option>
        {Object.entries(REQUEST_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <div className="cs-toolbar__actions">
      <button type="submit" className="admin-btn admin-btn--primary">Buscar</button>
      {active && <button type="button" className="admin-btn admin-btn--tertiary" onClick={onClear}>Limpiar filtros</button>}
    </div>
  </form>;
}

function RequestsWorkspace({ basePath = "/admin/solicitudes" }) {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter(), query = params.toString();
  const { user } = useAuth();
  const vendor = user?.role === "vendedor";
  const [state, setState] = useState(null), [version, setVersion] = useState(0);
  const page = Math.max(1, Number(params.get("page")) || 1), requestKey = query + ":" + version;
  useEffect(() => {
    let active = true;
    const filters = new URLSearchParams(query);
    Promise.resolve().then(() => getAdminSpecialRequests({ q: filters.get("q") || "", type: filters.get("type") || "", status: filters.get("status") || "", page, limit: PAGE_SIZE }))
      .then((data) => { if (!Array.isArray(data?.requests)) throw new Error("Respuesta incompleta"); if (active) setState({ key: requestKey, data }); })
      .catch(() => { if (active) setState({ key: requestKey, error: "No se pudieron cargar las solicitudes. Los filtros se conservaron." }); });
    return () => { active = false; };
  // query is the stable identity of all URL parameters used by this request.
  }, [query, page, requestKey]);
  const loading = state?.key !== requestKey, error = state?.key === requestKey && state.error;
  const data = !loading && !error ? state.data : null;
  const requests = data?.requests || [], totalPages = data?.totalPages || 1, total = data?.total ?? requests.length;
  const filtered = FILTER_KEYS.some((k) => params.get(k));
  const href = (changes) => { const next = new URLSearchParams(query); Object.entries(changes).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key)); return pathname + (next.size ? "?" + next : ""); };
  const clear = () => router.push(href({ q: "", type: "", status: "", page: "" }));
  const returnTo = pathname + (query ? "?" + query : "");
  const detailHref = (r) => `${basePath}/${r.id}?returnTo=${encodeURIComponent(returnTo)}`;

  return <section className="cs-section" aria-labelledby="cs-requests-title">
    <div className="cs-section__head">
      <div>
        <h2 id="cs-requests-title" className={vendor ? "dz-sr-only" : undefined}>Solicitudes especiales</h2>
        {!vendor && <p className="cs-section__desc">Personalizaciones y pedidos al por mayor.</p>}
      </div>
      {data && <p className="cs-count" role="status">{total === 1 ? "1 solicitud" : `${total} solicitudes`}{totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}</p>}
    </div>
    <RequestFilters key={query} query={query} onApply={(filters) => router.push(href({ ...filters, page: 1 }))} onClear={clear} />

    {error && <DashboardStateNotice tone="error" onRetry={() => setVersion((v) => v + 1)} retryLabel="Reintentar solicitudes">{error}</DashboardStateNotice>}
    {loading && <div className="cs-skeleton" aria-busy="true"><p className="dz-sr-only" role="status">Cargando solicitudes…</p>{[0, 1, 2, 3].map((i) => <span key={i} />)}</div>}
    {data && requests.length === 0 && (filtered
      ? <div className="cs-empty"><DashboardEmptyState icon={HiOutlineFunnel} title="No hay solicitudes con estos filtros">Prueba con otro tipo, estado o término de búsqueda.</DashboardEmptyState><button type="button" className="admin-btn" onClick={clear}>Limpiar filtros</button></div>
      : <div className="cs-empty"><DashboardEmptyState icon={HiOutlineInboxStack} title="Aún no hay solicitudes especiales">Cuando un cliente pida una personalización o un pedido al por mayor desde la tienda, aparecerá aquí.</DashboardEmptyState></div>)}

    {data && requests.length > 0 && <div className="cs-table-wrap">
      <table className="admin-table cs-table">
        <caption className="dz-sr-only">Solicitudes especiales{filtered ? " filtradas" : ""}, página {page} de {totalPages}</caption>
        <thead><tr><th scope="col">Número</th><th scope="col">Tipo</th><th scope="col">Cliente</th><th scope="col">Estado</th><th scope="col">Fecha</th><th scope="col"><span className="dz-sr-only">Acción</span></th></tr></thead>
        <tbody>
          {requests.map((r) => <tr key={r.id}>
            <td data-label="Número" className="cs-cell-ref"><Link href={detailHref(r)} className="cs-ref">{r.requestNumber}</Link></td>
            <td data-label="Tipo" className="cs-cell-type"><span className="cs-strong">{REQUEST_TYPE_LABELS[r.type] || r.type}</span>
              {(r.productName || r.estimatedQuantity) && <span className="cs-sub">{r.productName || `≈ ${r.estimatedQuantity} unidades`}</span>}</td>
            <td data-label="Cliente" className="cs-cell-client"><span className="cs-strong">{r.contact?.name}</span><span className="cs-sub cs-email">{r.contact?.email}</span></td>
            <td data-label="Estado" className="cs-cell-status"><RequestStatusChip status={r.status} />{r.quotedAmount != null && <span className="cs-sub">Cotizado {formatCOP(r.quotedAmount)}</span>}</td>
            <td data-label="Fecha" className="cs-cell-date"><time dateTime={r.createdAt}>{formatWhen(r.createdAt, false)}</time></td>
            <td className="cs-cell-action"><Link href={detailHref(r)} className="admin-btn admin-btn--sm" aria-label={`Ver solicitud ${r.requestNumber}`}>Ver solicitud<HiOutlineArrowRight aria-hidden="true" /></Link></td>
          </tr>)}
        </tbody>
      </table>
    </div>}

    {data && totalPages > 1 && <nav className="cs-pagination" aria-label="Paginación de solicitudes">
      <button type="button" className="admin-btn admin-btn--sm" disabled={page <= 1} onClick={() => router.push(href({ page: page - 1 }))}>Anterior</button>
      <span>Página {page} de {totalPages}</span>
      <button type="button" className="admin-btn admin-btn--sm" disabled={page >= totalPages} onClick={() => router.push(href({ page: page + 1 }))}>Siguiente</button>
    </nav>}
  </section>;
}
