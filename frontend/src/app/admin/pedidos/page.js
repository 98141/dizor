"use client";

import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import OrdersList from "@/components/admin/OrdersList";

export default function AdminPedidosPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <h1 className="admin-page__title">Pedidos</h1>
          <OrdersList basePath="/admin/pedidos" />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
