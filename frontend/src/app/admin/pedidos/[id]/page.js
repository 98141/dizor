"use client";

import { useParams } from "next/navigation";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import OrderDetail from "@/components/admin/OrderDetail";

export default function AdminPedidoDetailPage() {
  const { id } = useParams();

  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <OrderDetail orderId={id} backHref="/admin/pedidos" />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
