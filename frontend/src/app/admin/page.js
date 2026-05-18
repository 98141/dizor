"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import { getOrderStats } from "@/services/orderAdminService";
import { getSpecialRequestStats } from "@/services/specialRequestAdminService";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [reqStats, setReqStats] = useState(null);

  useEffect(() => {
    getOrderStats()
      .then((d) => setStats(d.stats))
      .catch(() => setStats(null));
    getSpecialRequestStats()
      .then((d) => setReqStats(d.stats))
      .catch(() => setReqStats(null));
  }, []);

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        Panel administrativo Dizor
      </p>

      {stats && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.total}</p>
            <p className="admin-stat-card__label">Pedidos totales</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.pendingPayment}</p>
            <p className="admin-stat-card__label">Pagos pendientes</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.toPrepare}</p>
            <p className="admin-stat-card__label">Por preparar</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.shippedToday}</p>
            <p className="admin-stat-card__label">Enviados hoy</p>
          </div>
        </div>
      )}

      {reqStats && (
        <div className="admin-stats" style={{ marginTop: "1rem" }}>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{reqStats.pending}</p>
            <p className="admin-stat-card__label">Solicitudes pendientes</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{reqStats.inReview}</p>
            <p className="admin-stat-card__label">En revisión</p>
          </div>
        </div>
      )}

      <div className="admin-page__actions" style={{ marginTop: "1.5rem" }}>
        <Link href="/admin/pedidos" className="admin-btn admin-btn--primary">
          Gestionar pedidos
        </Link>
        <Link href="/admin/solicitudes" className="admin-btn admin-btn--primary">
          Solicitudes especiales
        </Link>
        <Link href="/admin/contenido" className="admin-btn">
          Editar contenido
        </Link>
        <Link href="/admin/marketing" className="admin-btn">
          Marketing
        </Link>
        <Link href="/admin/productos" className="admin-btn">
          Ver productos
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <AdminDashboard />
      </AdminShell>
    </RoleRoute>
  );
}
