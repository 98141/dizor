"use client";
import { use, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import SpecialRequestDetail from "@/components/admin/SpecialRequestDetail";
import { getAdminSpecialRequest } from "@/services/specialRequestAdminService";
import { returnToRequests } from "@/lib/adminNavigation.mjs";
import { DashboardStateNotice } from "@/components/admin/dashboard/DashboardUI";
import { RequestStatusChip, RequestTypeChip } from "@/components/admin/attention/AttentionUI";

function RequestDetail({ id }) {
  const params = useSearchParams();
  const [state, setState] = useState(null), [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => getAdminSpecialRequest(id)).then((data) => { if (active) setState({ request: data?.request || null }); })
      .catch((err) => { if (active) setState({ error: err?.response?.status === 404 ? "notfound" : "No se pudo cargar la solicitud." }); });
    return () => { active = false; };
  }, [id, version]);
  const request = state?.request;
  return <div className="admin-page dz-page cs-page">
    <Link href={returnToRequests(params.get("returnTo"))} className="cs-back">← Volver a solicitudes</Link>
    <header className="cs-detail-head">
      <p className="dz-eyebrow">Solicitud especial</p>
      <h1>{request?.requestNumber || "Solicitud"}</h1>
      {request && <div className="cs-detail-head__chips"><RequestStatusChip status={request.status} /><RequestTypeChip type={request.type} /></div>}
    </header>
    {!state && <DashboardStateNotice>Cargando solicitud…</DashboardStateNotice>}
    {state?.error === "notfound" || (state && !state.error && !request) ? <DashboardStateNotice tone="error">Solicitud no encontrada. Puede haber sido eliminada o el enlace no es válido.</DashboardStateNotice> : null}
    {state?.error && state.error !== "notfound" && <DashboardStateNotice tone="error" retryLabel="Reintentar solicitud" onRetry={() => { setState(null); setVersion((v) => v + 1); }}>{state.error}</DashboardStateNotice>}
    {request && <SpecialRequestDetail request={request} onUpdated={(next) => setState({ request: next })} />}
  </div>;
}
export default function AdminSolicitudDetailPage({ params }) {
  const { id } = use(params);
  return <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}><AdminShell><Suspense fallback={<p role="status">Cargando solicitud…</p>}><RequestDetail key={id} id={id} /></Suspense></AdminShell></RoleRoute>;
}
