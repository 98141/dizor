"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import TaxonomyManager from "@/components/admin/TaxonomyManager";

function CatalogoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") === "weaves" ? "weave-types" : searchParams.get("tab") || "categories";

  return (
    <div className="admin-page op-tax">
      <Link href="/admin/productos">← Volver a Productos</Link>
      <h1 className="admin-page__title">Configuración del catálogo</h1>
      <p className="admin-page__subtitle">
        Categorías, colores, tallas, tejidos y estilos para armar productos.
      </p>
      <TaxonomyManager key={tab} initialTab={tab} onTabChange={value => { const next = new URLSearchParams(searchParams); next.set("tab", value); router.push(`/admin/catalogo?${next}`); }} />
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
