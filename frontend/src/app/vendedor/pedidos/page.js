"use client";

import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import OrdersList from "@/components/admin/OrdersList";

export default function VendedorPedidosPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="vendedor">
        <div className="admin-page">
          <h1 className="admin-page__title">Pedidos</h1>
          <OrdersList basePath="/vendedor/pedidos" />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
