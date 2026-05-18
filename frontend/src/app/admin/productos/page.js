"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import { useAuth } from "@/context/AuthContext";
import { getAdminProducts, getInventory } from "@/services/adminCatalogService";
import { formatCOP } from "@/lib/formatCurrency";

const stockClass = {
  healthy: "stock-badge--healthy",
  low: "stock-badge--low",
  out: "stock-badge--out",
};

const stockLabel = {
  healthy: "OK",
  low: "Bajo",
  out: "Agotado",
};

function AdminProductosContent() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");

  const canViewCosts = ["superadmin", "admin"].includes(user?.role);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodData, invData] = await Promise.all([
          getAdminProducts({ limit: 50 }),
          getInventory(),
        ]);
        setProducts(prodData.products || []);
        setInventory(invData.inventory || []);
      } catch {
        setProducts([]);
        setInventory([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title">Productos</h1>
        {canViewCosts && (
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            Puedes ver costos y márgenes
          </span>
        )}
      </div>

      <nav className="admin-nav">
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/productos" className="active">
          Productos
        </Link>
        <Link href="/vendedor">Panel vendedor</Link>
      </nav>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          className={`admin-btn${view === "list" ? " admin-btn--primary" : ""}`}
          onClick={() => setView("list")}
        >
          Lista
        </button>
        <button
          type="button"
          className={`admin-btn${view === "inventory" ? " admin-btn--primary" : ""}`}
          onClick={() => setView("inventory")}
        >
          Inventario
        </button>
      </div>

      {loading ? (
        <p className="auth-loading">Cargando...</p>
      ) : view === "inventory" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock</th>
                <th>Estado</th>
                {canViewCosts && <th>Precio</th>}
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.totalStock}</td>
                  <td>
                    <span
                      className={`stock-badge ${stockClass[item.stockStatus]}`}
                    >
                      {stockLabel[item.stockStatus]}
                    </span>
                  </td>
                  {canViewCosts && (
                    <td>{formatCOP(item.salePrice)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Precio</th>
                {canViewCosts && <th>Costo</th>}
                <th>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/producto/${p.slug}`}>{p.name}</Link>
                  </td>
                  <td>{formatCOP(p.effectivePrice)}</td>
                  {canViewCosts && (
                    <td>
                      {p.internalCost != null
                        ? formatCOP(p.internalCost)
                        : "—"}
                    </td>
                  )}
                  <td>{p.totalStock}</td>
                  <td>{p.isActive ? "Activo" : "Inactivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: "1.5rem", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
        El formulario completo de creación/edición de productos llegará en la
        siguiente iteración. Por ahora usa la API admin o el seed de catálogo.
      </p>
    </div>
  );
}

export default function AdminProductosPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminProductosContent />
    </RoleRoute>
  );
}
