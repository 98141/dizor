"use client";

import { useParams } from "next/navigation";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import OrderDetail from "@/components/admin/OrderDetail";

export default function VendedorPedidoDetailPage() {
  const { id } = useParams();

  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="vendedor">
        <div className="admin-page">
          <OrderDetail orderId={id} backHref="/vendedor/pedidos" />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
