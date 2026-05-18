"use client";

import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import ProductForm from "@/components/admin/ProductForm";

export default function AdminProductoNuevoPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <h1 className="admin-page__title">Nuevo producto</h1>
          <ProductForm />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
