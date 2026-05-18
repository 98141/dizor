"use client";

import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import SpecialRequestsList from "@/components/admin/SpecialRequestsList";

export default function AdminSolicitudesPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <h1 className="admin-page__title">Solicitudes especiales</h1>
          <p className="admin-page__subtitle">
            Personalizaciones y pedidos al por mayor.
          </p>
          <SpecialRequestsList />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
