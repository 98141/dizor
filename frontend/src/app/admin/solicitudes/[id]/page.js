"use client";
import { use, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import SpecialRequestDetail from "@/components/admin/SpecialRequestDetail";
import { getAdminSpecialRequest } from "@/services/specialRequestAdminService";
import { returnToRequests } from "@/lib/adminNavigation.mjs";
function RequestDetail({ id }) {
  const params = useSearchParams();
  const [state, setState] = useState(null), [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    getAdminSpecialRequest(id).then(data => { if (active) setState({ request: data.request }); }).catch(() => { if (active) setState({ error: "No se pudo cargar la solicitud." }); });
    return () => { active = false; };
  }, [id, version]);
  return <div className="admin-page"><Link href={returnToRequests(params.get("returnTo"))} className="admin-muted">← Volver a solicitudes</Link><h1 className="admin-page__title">{state?.request?.requestNumber || "Solicitud"}</h1>{!state ? <p role="status">Cargando solicitud…</p> : state.error ? <p role="alert">{state.error} <button type="button" className="admin-btn" onClick={() => { setState(null); setVersion(v => v + 1); }}>Reintentar solicitud</button></p> : state.request ? <SpecialRequestDetail request={state.request} onUpdated={request => setState({ request })} /> : <p>Solicitud no encontrada.</p>}</div>;
}
export default function AdminSolicitudDetailPage({ params }) {
  const { id } = use(params);
  return <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}><AdminShell><Suspense fallback={<p role="status">Cargando solicitud…</p>}><RequestDetail key={id} id={id} /></Suspense></AdminShell></RoleRoute>;
}
