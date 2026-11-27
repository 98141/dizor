"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthErrorAlert from "@/components/admin/AdminFeedback";
import { formatCOP } from "@/lib/formatCurrency";
import { CONTENT_TABS, contentHref } from "@/lib/adminNavigation.mjs";
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
  const lock = useRef(false);
  const [loadError, setLoadError] = useState("");
  // Form on demand (2026-11-26): open when there are no coupons, when editing or on request.
  // It always stays mounted (hidden when closed), so its fields and tests keep working.
  const [formOpen, setFormOpen] = useState(null);
  const [scope, setScope] = useState("page");
  const [focusField, setFocusField] = useState(null);

  const load = useCallback(() => getCoupons().then(data => {
    setCoupons(data.coupons || []); setLoadError("");
  }).catch(() => setLoadError("No se pudieron cargar los cupones. Reintenta para consultar la lista real.")).finally(() => setLoading(false)), []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!focusField) return;
    const el = document.getElementById(focusField.id);
    el?.scrollIntoView({ block: "center" }); el?.focus({ preventScroll: true });
  }, [focusField]);

  const resetForm = (keepMessage = false) => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    if (keepMessage !== true) { setMessage(""); setIsError(false); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: name === "code" ? value.toUpperCase() : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setFormOpen(true); // a submitted form always shows its own progress and result
    if (lock.current) return;
    lock.current = true;
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
      setScope("page");
      resetForm(true);
      formEl.reset();
      setFormOpen(false);
      await load();
    } catch (err) {
      setScope("form");
      setMessage(err.response?.data?.message || "No se pudo guardar el cupón");
      setIsError(true);
    } finally {
      lock.current = false;
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
    setFormOpen(true);
    setFocusField((prev) => ({ id: "description", n: (prev?.n || 0) + 1 })); // the code is locked while editing
  };

  const handleToggle = async (id) => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setScope("page");
    try {
      await toggleCoupon(id);
      setIsError(false); setMessage("Estado del cupón actualizado");
      await load();
    } catch (err) {
      setIsError(true); setMessage(err.response?.data?.message || "No se pudo actualizar");
    } finally { lock.current = false; setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setScope("page");
    try {
      await deleteCoupon(id);
      setConfirmDelete(null);
      setIsError(false); setMessage("Cupón eliminado");
      await load();
    } catch (err) {
      setIsError(true); setMessage(err.response?.data?.message || "No se pudo eliminar");
    } finally { lock.current = false; setSaving(false);
    }
  };

  const showForm = formOpen ?? (!loading && !loadError && coupons.length === 0);
  const openNew = () => {
    if (showForm && !editingId) { resetForm(); setFormOpen(false); return; }
    resetForm(); setFormOpen(true);
    setFocusField((prev) => ({ id: "code", n: (prev?.n || 0) + 1 }));
  };
  const closeForm = () => { resetForm(); setFormOpen(false); };
  const pageMessage = scope === "page" || !isError ? message : "";
  const formMessage = scope === "form" && isError ? message : "";

  return (
    <div className="admin-page mk-page mk-coupons">
      <nav className="cms-tabs mk-tabs" aria-label="Secciones de Marketing">
        <Link href="/admin/cupones" className="mk-tab active" aria-current="page">Cupones</Link>
        {CONTENT_TABS.filter((t) => t.area === "marketing").map((t) => <Link key={t.id} href={contentHref(t.id)} className="mk-tab">{t.label}</Link>)}
      </nav>
      <div className="mk-toolbar">
        <div>
          <h1 className="admin-page__title">Cupones de descuento</h1>
          <p className="admin-page__subtitle">Crea y gestiona códigos de descuento para tus clientes.</p>
          {!loading && !loadError && <p className="mk-hint">{coupons.length} {coupons.length === 1 ? "cupón" : "cupones"}</p>}
        </div>
        <button type="button" className="admin-btn admin-btn--primary" aria-expanded={showForm} aria-controls="mk-coupon-form" onClick={openNew}>{coupons.length ? "Nuevo cupón" : "Crear primer cupón"}</button>
      </div>

      {loadError && <><AuthErrorAlert message={loadError} /><button type="button" className="admin-btn" onClick={() => { setLoading(true); load(); }}>Reintentar cupones</button></>}
      <AuthErrorAlert message={pageMessage} variant={isError ? "error" : "success"} />
      <div className="mk-stack">
        <section id="mk-coupon-form" className="taxonomy-form-card mk-composer" hidden={!showForm}
          onKeyDown={(e) => { if (e.key === "Escape" && !saving && !e.target.closest?.("select")) { e.preventDefault(); closeForm(); } }}>
          <h2>{editingId ? "Editar cupón" : "Nuevo cupón"}</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-form__row">
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
                <span className="mk-field-note">El código no se puede cambiar</span>
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

            <AuthErrorAlert message={formMessage} variant="error" />

            <div className="mk-form-actions">
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={saving}
              >
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear cupón"}
              </button>
              <button type="button" className="admin-btn admin-btn--tertiary" disabled={saving} onClick={closeForm}>
                Cancelar
              </button>
            </div>
          </form>
        </section>

        {/* ── Lista ── */}
        <section className="taxonomy-list-card" aria-label="Listado de cupones">
          {loading ? (
            <p className="auth-loading">Cargando…</p>
          ) : coupons.length === 0 ? (
            <p className="mk-empty">No hay cupones creados.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table mk-coupon-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descuento</th>
                    <th>Usos</th>
                    <th>Vence</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c._id} className={c.isActive ? undefined : "is-inactive"}>
                      <td data-label="Código" className="cp-code">
                        <strong className="cp-code__value">{c.code}</strong>
                        {c.description && <span className="admin-muted cp-line">{c.description}</span>}
                        {c.minOrderAmount > 0 && <span className="admin-muted cp-line">Mín. {formatCOP(c.minOrderAmount)}</span>}
                      </td>
                      <td data-label="Descuento" className="cp-value">{formatValue(c)}<span className="cp-unit"> de descuento</span></td>
                      <td data-label="Usos" className="cp-uses">
                        {c.usedCount}
                        {c.maxUses != null && ` / ${c.maxUses}`}
                        <span className="cp-unit"> {c.usedCount === 1 && c.maxUses == null ? "uso" : "usos"}</span>
                      </td>
                      <td data-label="Vence" className={`cp-expiry${isExpired(c.expiresAt) ? " is-expired" : ""}`}>
                        {c.expiresAt && <span className="cp-unit">Vence </span>}
                        {formatExpiry(c.expiresAt)}
                        {isExpired(c.expiresAt) && " · vencido"}
                      </td>
                      <td data-label="Estado" className="cp-status">
                        <span className={c.isActive ? "st-chip st-chip--on" : "st-chip"}>{c.isActive ? "Activo" : "Inactivo"}</span>
                      </td>
                      <td data-label="Acciones" className="cp-actions">
                        <div className="cp-actions__row">
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            aria-label={`Editar cupón ${c.code}`}
                            onClick={() => handleEdit(c)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            disabled={saving || !!loadError}
                            aria-label={`${c.isActive ? "Desactivar" : "Activar"} cupón ${c.code}`}
                            onClick={() => handleToggle(c._id)}
                          >
                            {c.isActive ? "Desactivar" : "Activar"}
                          </button>
                          {confirmDelete === c._id ? (
                            <>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--danger"
                                disabled={saving || !!loadError}
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
                              aria-label={`Eliminar cupón ${c.code}`}
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
