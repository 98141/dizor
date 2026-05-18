"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import { getOrderStats } from "@/services/orderAdminService";

function VendedorDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getOrderStats()
      .then((d) => setStats(d.stats))
      .catch(() => setStats(null));
  }, []);

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Panel vendedor</h1>

      {stats && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.pendingPayment}</p>
            <p className="admin-stat-card__label">Pagos por confirmar</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.toPrepare}</p>
            <p className="admin-stat-card__label">Por preparar</p>
          </div>
        </div>
      )}

      <Link href="/vendedor/pedidos" className="admin-btn admin-btn--primary">
        Ver todos los pedidos
      </Link>
    </div>
  );
}

export default function VendedorPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="vendedor">
        <VendedorDashboard />
      </AdminShell>
    </RoleRoute>
  );
}
