"use client";

import { useCallback, useEffect, useState } from "react";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import {
  getAdminReviews,
  approveAdminReview,
  rejectAdminReview,
  createBrandReview,
} from "@/services/reviewService";

const SUB_TABS = [
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
  { id: "brand", label: "Escribir reseña de marca" },
];

export default function ReviewsTab() {
  const [subTab, setSubTab] = useState("pending");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();

  const [brandForm, setBrandForm] = useState({
    authorName: "Dizor",
    city: "",
    rating: 5,
    comment: "",
    productId: "",
  });

  const load = useCallback(async () => {
    if (subTab === "brand") {
      setLoading(false);
      return;
    }
    setLoading(true);
    clearMsg();
    try {
      const params = { aprobado: subTab === "pending" ? "false" : "true" };
      const data = await getAdminReviews(params);
      setReviews(data.reviews || []);
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al cargar reseñas", true);
    } finally {
      setLoading(false);
    }
  }, [subTab, clearMsg, showMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    setSaving(true);
    try {
      await approveAdminReview(id);
      showMsg("Reseña aprobada");
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo aprobar", true);
    } finally {
      setSaving(false);
    }
  };

  const reject = (id) => {
    setConfirmModal({
      message:
        "¿Rechazar y eliminar esta reseña? El cliente podrá volver a escribir una si aplica.",
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        try {
          await rejectAdminReview(id);
          showMsg("Reseña eliminada");
          await load();
        } catch (err) {
          showMsg(err.response?.data?.message || "No se pudo eliminar", true);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const submitBrand = async (e) => {
    e.preventDefault();
    setSaving(true);
    clearMsg();
    try {
      await createBrandReview({
        authorName: brandForm.authorName,
        city: brandForm.city,
        rating: Number(brandForm.rating),
        comment: brandForm.comment,
        productId: brandForm.productId || undefined,
      });
      showMsg("Reseña de marca publicada");
      setBrandForm({
        authorName: "Dizor",
        city: "",
        rating: 5,
        comment: "",
        productId: "",
      });
      setSubTab("approved");
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo crear", true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="admin-page__subtitle" style={{ marginTop: 0 }}>
        Modera reseñas de clientes (nacen pendientes) y publica voces de marca
        auto-aprobadas.
      </p>

      <ConfirmModal
        isOpen={!!confirmModal}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      <AuthErrorAlert
        key={flashKey}
        message={message}
        variant={error ? "error" : "success"}
      />

      <nav className="cms-tabs" style={{ marginBottom: "1rem" }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={subTab === t.id ? "active" : ""}
            onClick={() => {
              setSubTab(t.id);
              clearMsg();
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {subTab === "brand" ? (
        <form className="admin-form product-form__section" onSubmit={submitBrand}>
          <h2>Reseña de marca</h2>
          <AuthFormField
            label="Firma / autor"
            name="authorName"
            value={brandForm.authorName}
            required
            onChange={(e) =>
              setBrandForm((f) => ({ ...f, authorName: e.target.value }))
            }
          />
          <AuthFormField
            label="Ciudad (opcional)"
            name="city"
            value={brandForm.city}
            onChange={(e) =>
              setBrandForm((f) => ({ ...f, city: e.target.value }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Estrellas</label>
            <select
              className="auth-field__input"
              value={brandForm.rating}
              onChange={(e) =>
                setBrandForm((f) => ({ ...f, rating: e.target.value }))
              }
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-field__label">Comentario</label>
            <textarea
              className="auth-field__input"
              rows={4}
              required
              value={brandForm.comment}
              onChange={(e) =>
                setBrandForm((f) => ({ ...f, comment: e.target.value }))
              }
            />
          </div>
          <AuthFormField
            label="ID producto (opcional)"
            name="productId"
            value={brandForm.productId}
            placeholder="ObjectId del producto"
            onChange={(e) =>
              setBrandForm((f) => ({ ...f, productId: e.target.value }))
            }
          />
          <AuthSubmitButton loading={saving}>Publicar reseña</AuthSubmitButton>
        </form>
      ) : loading ? (
        <p className="auth-loading">Cargando…</p>
      ) : reviews.length === 0 ? (
        <p className="admin-page__subtitle">No hay reseñas en esta pestaña.</p>
      ) : (
        <div className="admin-grid-2">
          {reviews.map((review) => (
            <article key={review.id} className="taxonomy-form-card">
              <p style={{ margin: 0, color: "var(--color-accent)" }}>
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </p>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
                &ldquo;{review.comment}&rdquo;
              </p>
              <p style={{ fontSize: "0.85rem", margin: 0 }}>
                <strong>{review.authorName}</strong>
                {review.city ? ` · ${review.city}` : ""}
                {review.isBrandReview ? " · Marca" : ""}
              </p>
              {review.product?.name ? (
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  Producto: {review.product.name}
                </p>
              ) : null}
              {review.user?.email ? (
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  Usuario: {review.user.email}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                {!review.aprobado && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--primary"
                    disabled={saving}
                    onClick={() => approve(review.id)}
                  >
                    Aprobar
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger"
                  disabled={saving}
                  onClick={() => reject(review.id)}
                >
                  {review.aprobado ? "Eliminar" : "Rechazar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
