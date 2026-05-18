"use client";

import { use } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import ProductForm from "@/components/admin/ProductForm";

export default function AdminProductoEditarPage({ params }) {
  const { id } = use(params);

  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <h1 className="admin-page__title">Editar producto</h1>
          <ProductForm productId={id} />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
