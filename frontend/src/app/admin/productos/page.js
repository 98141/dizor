"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import { useAuth } from "@/context/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  deleteAdminProduct,
  getAdminProducts,
  getInventory,
  updateAdminProduct,
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

function getStockStatus(total) {
  if (total <= 0) return "out";
  if (total <= 5) return "low";
  return "healthy";
}

function VariantRow({ variant }) {
  const sizeName = variant.size?.name || "";
  const colorName = variant.color?.name || "";
  const status = getStockStatus(variant.stock ?? 0);

  return (
    <tr>
      <td>{sizeName || "—"}</td>
      <td>{colorName || "—"}</td>
      <td style={{ fontFamily: "monospace", fontSize: "0.77rem" }}>{variant.sku || "—"}</td>
      <td>
        <span className={`stock-badge ${stockClass[status]}`}>{variant.stock ?? 0}</span>
      </td>
      <td>{variant.price ? formatCOP(variant.price) : "—"}</td>
      <td>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: variant.isActive !== false ? "#166534" : "#991b1b" }}>
          {variant.isActive !== false ? "Activa" : "Inactiva"}
        </span>
      </td>
    </tr>
  );
}

function ProductRow({ p, isAdmin, canViewCosts, onDelete, onToggleActive }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const variants = p.variants || [];
  const colSpan = 5 + (canViewCosts ? 1 : 0) + (isAdmin ? 1 : 0);
  const stockStatus = getStockStatus(p.totalStock);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggleActive(p.id, !p.isActive);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <tr>
        <td className="product-thumb-cell">
          {p.mainImage ? (
            <img src={p.mainImage} alt={p.name} className="product-thumb" />
          ) : (
            <div className="product-thumb product-thumb--empty" />
          )}
        </td>
        <td>
          <Link
            href={p.slug ? `/producto/${encodeURIComponent(p.slug)}` : `/admin/productos/${p.id}/editar`}
            target="_blank"
            rel="noreferrer"
            className="product-name-link"
          >
            {p.name}
          </Link>
          {p.totalStock <= 5 && p.totalStock > 0 && (
            <span className="product-low-stock-hint"> · stock bajo</span>
          )}
        </td>
        <td>{formatCOP(p.effectivePrice)}</td>
        {canViewCosts && (
          <td>{p.internalCost != null ? formatCOP(p.internalCost) : "—"}</td>
        )}
        <td>
          <span className={`stock-badge ${stockClass[stockStatus]}`}>{p.totalStock}</span>
        </td>
        <td>
          {isAdmin ? (
            <button
              type="button"
              className={`toggle-active-btn ${p.isActive ? "toggle-active-btn--on" : "toggle-active-btn--off"}`}
              onClick={handleToggle}
              disabled={toggling}
              title={p.isActive ? "Clic para desactivar" : "Clic para activar"}
            >
              {toggling ? "…" : p.isActive ? "Activo" : "Inactivo"}
            </button>
          ) : (
            <span style={{ fontSize: "0.85rem" }}>{p.isActive ? "Activo" : "Inactivo"}</span>
          )}
        </td>
        {isAdmin && (
          <td>
            <div className="admin-table__actions">
              {variants.length > 0 && (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  onClick={() => setExpanded((v) => !v)}
                  title="Ver tallas, colores y stock por variante"
                >
                  {expanded ? "▲" : "▼"} {variants.length} var.
                </button>
              )}
              <Link href={`/admin/productos/${p.id}/editar`} className="admin-btn admin-btn--sm">
                Editar
              </Link>
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--danger"
                onClick={() => onDelete(p.id, p.name)}
              >
                Eliminar
              </button>
            </div>
          </td>
        )}
      </tr>
      {expanded && variants.length > 0 && (
        <tr className="product-variants-expanded-row">
          <td colSpan={colSpan} style={{ padding: 0 }}>
            <div className="variants-panel">
              <p className="variants-panel__title">Variantes de {p.name}</p>
              <table className="variants-mini-table">
                <thead>
                  <tr>
                    <th>Talla</th>
                    <th>Color</th>
                    <th>SKU</th>
                    <th>Stock</th>
                    <th>Precio variante</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <VariantRow key={v.id} variant={v} />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AdminProductosContent() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [confirmModal, setConfirmModal] = useState(null);
  const [pageError, setPageError] = useState("");

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

  const handleDelete = (id, name) => {
    setConfirmModal({
      message: `¿Estás seguro de que deseas eliminar "${name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setPageError("");
        try {
          await deleteAdminProduct(id);
          await load();
        } catch (err) {
          setPageError(err.response?.data?.message || "No se pudo eliminar el producto");
        }
      },
    });
  };

  const handleToggleActive = async (id, newValue) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: newValue } : p)));
    try {
      await updateAdminProduct(id, { isActive: newValue });
    } catch (err) {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !newValue } : p)));
      alert(err.response?.data?.message || "No se pudo cambiar el estado");
    }
  };

  return (
    <div className="admin-page">
      <ConfirmModal
        isOpen={!!confirmModal}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      {pageError && (
        <p style={{ color: "var(--color-error)", marginBottom: "1rem" }}>{pageError}</p>
      )}
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
                  <td>
                    <span className={`stock-badge ${stockClass[item.stockStatus]}`}>
                      {item.totalStock}
                    </span>
                  </td>
                  <td>
                    <span className={`stock-badge ${stockClass[item.stockStatus]}`}>
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
          <table className="admin-table product-list-table">
            <thead>
              <tr>
                <th style={{ width: "48px" }}></th>
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
                <ProductRow
                  key={p.id}
                  p={p}
                  isAdmin={isAdmin}
                  canViewCosts={canViewCosts}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
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
