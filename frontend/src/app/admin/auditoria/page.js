"use client";

import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuditLogList from "@/components/admin/AuditLogList";

export default function AuditoriaPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <div className="admin-page__header-row">
            <div>
              <h1 className="admin-page__title">Historial de auditoría</h1>
              <p className="admin-page__subtitle">
                Registro de acciones en pedidos, catálogo, usuarios, configuración
                y autenticación. Solo visible para administradores.
              </p>
            </div>
            <Link href="/admin" className="admin-btn">
              ← Dashboard
            </Link>
          </div>
          <AuditLogList />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
