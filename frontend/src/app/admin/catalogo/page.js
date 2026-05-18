"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import TaxonomyManager from "@/components/admin/TaxonomyManager";

function CatalogoContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "categories";

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Catálogo base</h1>
      <p className="admin-page__subtitle">
        Categorías, colores, tallas, tejidos y estilos para armar productos.
      </p>
      <TaxonomyManager initialTab={tab} />
    </div>
  );
}

export default function AdminCatalogoPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <Suspense fallback={<p className="auth-loading">Cargando…</p>}>
          <CatalogoContent />
        </Suspense>
      </AdminShell>
    </RoleRoute>
  );
}
