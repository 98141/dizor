"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import { useAuth } from "@/context/AuthContext";
import {
  deleteAdminProduct,
  getAdminProducts,
  getInventory,
} from "@/services/adminCatalogService";
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

  const isAdmin = ["superadmin", "admin"].includes(user?.role);
  const canViewCosts = isAdmin;

  const load = async () => {
    setLoading(true);
    try {
      const [prodData, invData] = await Promise.all([
        getAdminProducts({ limit: 100 }),
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

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await deleteAdminProduct(id);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo eliminar");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title">Productos</h1>
        {isAdmin && (
          <div className="admin-page__actions">
            <Link href="/admin/productos/nuevo" className="admin-btn admin-btn--primary">
              + Nuevo producto
            </Link>
            <Link href="/admin/catalogo" className="admin-btn">
              Catálogo base
            </Link>
            <Link href="/admin/inventario" className="admin-btn">
              Historial inventario
            </Link>
          </div>
        )}
      </div>

      {canViewCosts && (
        <p className="admin-page__subtitle">
          Puedes ver costos y márgenes. Los vendedores solo consultan inventario.
        </p>
      )}

      <div className="admin-view-tabs">
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
        <p className="auth-loading">Cargando…</p>
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
                  {canViewCosts && <td>{formatCOP(item.salePrice)}</td>}
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
                {isAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={
                        p.slug
                          ? `/producto/${encodeURIComponent(p.slug)}`
                          : `/admin/productos/${p.id}/editar`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td>{formatCOP(p.effectivePrice)}</td>
                  {canViewCosts && (
                    <td>
                      {p.internalCost != null ? formatCOP(p.internalCost) : "—"}
                    </td>
                  )}
                  <td>{p.totalStock}</td>
                  <td>{p.isActive ? "Activo" : "Inactivo"}</td>
                  {isAdmin && (
                    <td className="admin-table__actions">
                      <Link
                        href={`/admin/productos/${p.id}/editar`}
                        className="admin-btn admin-btn--sm"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--danger"
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminProductosPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin">
        <AdminProductosContent />
      </AdminShell>
    </RoleRoute>
  );
}
