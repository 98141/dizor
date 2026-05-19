"use client";

import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import ProductHistoryList from "@/components/admin/ProductHistoryList";

export default function InventarioPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <div className="admin-page__header-row">
            <div>
              <h1 className="admin-page__title">Control de inventario</h1>
              <p className="admin-page__subtitle">
                Historial de productos: registros nuevos, modificaciones, ventas
                y movimientos de stock por variante (talla / color).
              </p>
            </div>
            <div className="admin-page__actions" style={{ margin: 0 }}>
              <Link href="/admin/productos" className="admin-btn">
                Productos
              </Link>
              <Link href="/admin" className="admin-btn">
                Dashboard
              </Link>
            </div>
          </div>
          <ProductHistoryList />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
