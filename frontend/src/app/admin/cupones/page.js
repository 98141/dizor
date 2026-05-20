"use client";

import { useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { formatCOP } from "@/lib/formatCurrency";
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
} from "@/services/adminCouponService";

const EMPTY_FORM = {
  code: "",
  description: "",
  type: "percentage",
  value: "",
  minOrderAmount: "",
  maxUses: "",
  expiresAt: "",
};

const TYPE_LABELS = { percentage: "Porcentaje (%)", fixed: "Valor fijo ($)" };

function formatValue(coupon) {
  if (coupon.type === "percentage") return `${coupon.value}%`;
  return formatCOP(coupon.value);
}

function formatExpiry(date) {
  if (!date) return "Sin vencimiento";
  return new Date(date).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(date) {
  return date && new Date(date) < new Date();
}

function AdminCuponesContent() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCoupons();
      setCoupons(data.coupons || []);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage("");
    setIsError(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: name === "code" ? value.toUpperCase() : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    const payload = {
      code: form.code.trim(),
      description: form.description.trim(),
      type: form.type,
      value: Number(form.value),
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    };

    try {
      if (editingId) {
        await updateCoupon(editingId, payload);
        setMessage("Cupón actualizado correctamente");
      } else {
        await createCoupon(payload);
        setMessage("Cupón creado correctamente");
      }
      setIsError(false);
      resetForm();
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "No se pudo guardar el cupón");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      type: coupon.type,
      value: String(coupon.value),
      minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : "",
      maxUses: coupon.maxUses != null ? String(coupon.maxUses) : "",
      expiresAt: coupon.expiresAt
        ? new Date(coupon.expiresAt).toISOString().split("T")[0]
        : "",
    });
    setMessage("");
    setIsError(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggle = async (id) => {
    try {
      await toggleCoupon(id);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo actualizar");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCoupon(id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo eliminar");
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Cupones de descuento</h1>
      <p className="admin-page__subtitle">
        Crea y gestiona códigos de descuento para tus clientes.
      </p>

      <div className="admin-grid-2">
        {/* ── Formulario ── */}
        <section className="taxonomy-form-card">
          <h2>{editingId ? "Editar cupón" : "Nuevo cupón"}</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-form__group">
              <label htmlFor="code">Código *</label>
              <input
                id="code"
                name="code"
                className="auth-field__input"
                value={form.code}
                onChange={handleChange}
                placeholder="VERANO20"
                maxLength={32}
                disabled={!!editingId}
                required
              />
              {editingId && (
                <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                  El código no se puede cambiar
                </span>
              )}
            </div>

            <div className="admin-form__group">
              <label htmlFor="description">Descripción interna</label>
              <input
                id="description"
                name="description"
                className="auth-field__input"
                value={form.description}
                onChange={handleChange}
                placeholder="Promo verano 2025"
                maxLength={120}
              />
            </div>

            <div className="admin-form__row">
              <div className="admin-form__group">
                <label htmlFor="type">Tipo *</label>
                <select
                  id="type"
                  name="type"
                  className="auth-field__input"
                  value={form.type}
                  onChange={handleChange}
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Valor fijo ($)</option>
                </select>
              </div>

              <div className="admin-form__group">
                <label htmlFor="value">
                  {form.type === "percentage" ? "Descuento (%) *" : "Descuento ($) *"}
                </label>
                <input
                  id="value"
                  name="value"
                  type="number"
                  min="1"
                  max={form.type === "percentage" ? "100" : undefined}
                  step="1"
                  className="auth-field__input"
                  value={form.value}
                  onChange={handleChange}
                  placeholder={form.type === "percentage" ? "20" : "5000"}
                  required
                />
              </div>
            </div>

            <div className="admin-form__row">
              <div className="admin-form__group">
                <label htmlFor="minOrderAmount">Pedido mínimo ($)</label>
                <input
                  id="minOrderAmount"
                  name="minOrderAmount"
                  type="number"
                  min="0"
                  step="1000"
                  className="auth-field__input"
                  value={form.minOrderAmount}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>

              <div className="admin-form__group">
                <label htmlFor="maxUses">Usos máximos</label>
                <input
                  id="maxUses"
                  name="maxUses"
                  type="number"
                  min="1"
                  step="1"
                  className="auth-field__input"
                  value={form.maxUses}
                  onChange={handleChange}
                  placeholder="Sin límite"
                />
              </div>
            </div>

            <div className="admin-form__group">
              <label htmlFor="expiresAt">Fecha de vencimiento</label>
              <input
                id="expiresAt"
                name="expiresAt"
                type="date"
                className="auth-field__input"
                value={form.expiresAt}
                onChange={handleChange}
              />
            </div>

            <AuthErrorAlert
              message={message}
              variant={isError ? "error" : "success"}
            />

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={saving}
              >
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear cupón"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={resetForm}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ── Lista ── */}
        <section className="taxonomy-list-card">
          <h2>Cupones ({coupons.length})</h2>
          {loading ? (
            <p className="auth-loading">Cargando…</p>
          ) : coupons.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
              No hay cupones todavía.
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descuento</th>
                    <th>Usos</th>
                    <th>Vence</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr
                      key={c._id}
                      style={{ opacity: c.isActive ? 1 : 0.55 }}
                    >
                      <td>
                        <strong style={{ letterSpacing: "0.05em" }}>{c.code}</strong>
                        {c.description && (
                          <>
                            <br />
                            <span className="admin-muted">{c.description}</span>
                          </>
                        )}
                        {c.minOrderAmount > 0 && (
                          <>
                            <br />
                            <span className="admin-muted">
                              Mín. {formatCOP(c.minOrderAmount)}
                            </span>
                          </>
                        )}
                      </td>
                      <td>{formatValue(c)}</td>
                      <td>
                        {c.usedCount}
                        {c.maxUses != null && ` / ${c.maxUses}`}
                      </td>
                      <td
                        style={
                          isExpired(c.expiresAt)
                            ? { color: "var(--color-error)", fontWeight: 600 }
                            : {}
                        }
                      >
                        {formatExpiry(c.expiresAt)}
                        {isExpired(c.expiresAt) && " ✕"}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: c.isActive ? "#d1fae5" : "#f3f4f6",
                            color: c.isActive ? "#065f46" : "#6b7280",
                          }}
                        >
                          {c.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            onClick={() => handleEdit(c)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            onClick={() => handleToggle(c._id)}
                          >
                            {c.isActive ? "Desactivar" : "Activar"}
                          </button>
                          {confirmDelete === c._id ? (
                            <>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger"
                                onClick={() => handleDelete(c._id)}
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger"
                              onClick={() => setConfirmDelete(c._id)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AdminCuponesPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <AdminCuponesContent />
      </AdminShell>
    </RoleRoute>
  );
}
