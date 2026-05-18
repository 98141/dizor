"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import SpecialRequestDetail from "@/components/admin/SpecialRequestDetail";
import { getAdminSpecialRequest } from "@/services/specialRequestAdminService";

export default function AdminSolicitudDetailPage({ params }) {
  const { id } = use(params);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminSpecialRequest(id)
      .then((d) => setRequest(d.request))
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <Link href="/admin/solicitudes" className="admin-muted">
            ← Volver a solicitudes
          </Link>
          <h1 className="admin-page__title" style={{ marginTop: "0.75rem" }}>
            {request?.requestNumber || "Solicitud"}
          </h1>
          {loading ? (
            <p className="auth-loading">Cargando…</p>
          ) : request ? (
            <SpecialRequestDetail
              request={request}
              onUpdated={setRequest}
            />
          ) : (
            <p>Solicitud no encontrada</p>
          )}
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
