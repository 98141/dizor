"use client";

import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import FinanceDashboard from "@/components/admin/FinanceDashboard";

export default function FinanzasPage() {
  return (
    <RoleRoute allowedRoles={["superadmin"]}>
      <AdminShell variant="admin">
        <div className="admin-page">
          <div className="admin-page__header-row">
            <div>
              <h1 className="admin-page__title">Panel financiero</h1>
              <p className="admin-page__subtitle">
                Ganancias estimadas, inversión en inventario, márgenes y
                rendimiento de la tienda. Acceso exclusivo superadmin.
              </p>
            </div>
            <Link href="/admin" className="admin-btn">
              ← Dashboard
            </Link>
          </div>
          <FinanceDashboard />
        </div>
      </AdminShell>
    </RoleRoute>
  );
}
