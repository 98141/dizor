"use client";

import { HiOutlineLockClosed } from "react-icons/hi2";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuditLogList from "@/components/admin/AuditLogList";

// Sprint 08: read-only history. Same endpoints and roles (superadmin, admin).
export default function AuditoriaPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <div className="admin-page cf-page cf-audit-page">
          <header className="cf-head cf-head--action">
            <div>
              <h1>Historial de auditoría</h1>
              <p className="cf-lead">Consulta los eventos y cambios registrados en la administración.</p>
            </div>
            <span className="cf-chip cf-chip--readonly" title="Los eventos no se pueden editar ni eliminar"><HiOutlineLockClosed aria-hidden="true" />Solo lectura</span>
          </header>
          <AuditLogList />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
