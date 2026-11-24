"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AuthFormField from "@/components/admin/AdminFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/admin/AdminFeedback";
import ConfirmModal from "@/components/admin/AdminConfirmModal";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import {
  getAdminReviews,
  approveAdminReview,
  rejectAdminReview,
  createBrandReview,
} from "@/services/reviewService";

const VIEWS = [
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
];

function formatWhen(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(date);
}

export default function ReviewsTab() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("reviewView") === "approved" ? "approved" : "pending";
  const size = searchParams.get("reviewSize") === "20" ? 20 : 10;
  const pageRaw = parseInt(searchParams.get("reviewPage") || "1", 10);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const queryKey = `${view}|${page}|${size}`;
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: size });
  const [loading, setLoading] = useState(true);
  const [seenKey, setSeenKey] = useState(queryKey);
  if (seenKey !== queryKey) {
    setSeenKey(queryKey);
    setLoading(true);
  }
  const [saving, setSaving] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const savingLock = useRef(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();
  const [brandForm, setBrandForm] = useState({ authorName: "Dizor", city: "", rating: 5, comment: "", productId: "" });

  const setQuery = useCallback((changes) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get("tab")) params.set("tab", "resenas");
    Object.entries(changes).forEach(([key, value]) => {
      if (value == null || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminReviews({
        aprobado: view === "pending" ? "false" : "true",
        page,
        limit: size,
      });
      setReviews(data.reviews || []);
      setMeta({
        total: Number(data.total ?? data.results ?? 0),
        page: Number(data.page || page),
        pages: Number(data.pages || 1),
        limit: Number(data.limit || size),
      });
      if (data.page && Number(data.page) !== page) setQuery({ reviewPage: Number(data.page) });
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al cargar reseñas", true);
    } finally {
      setLoading(false);
    }
  }, [view, page, size, showMsg, setQuery]);

  useEffect(() => {
    let cancelled = false;
    getAdminReviews({
      aprobado: view === "pending" ? "false" : "true",
      page,
      limit: size,
    }).then((data) => {
      if (cancelled) return;
      setReviews(data.reviews || []);
      setMeta({
        total: Number(data.total ?? data.results ?? 0),
        page: Number(data.page || page),
        pages: Number(data.pages || 1),
        limit: Number(data.limit || size),
      });
      setLoading(false);
      if (data.page && Number(data.page) !== page) setQuery({ reviewPage: Number(data.page) });
    }).catch((err) => {
      if (cancelled) return;
      showMsg(err.response?.data?.message || "Error al cargar reseñas", true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [view, page, size, showMsg, setQuery]);

  const approve = async (id) => {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    try {
      await approveAdminReview(id);
      showMsg("Reseña aprobada");
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo aprobar", true);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  const reject = (id) => {
    setConfirmModal({
      message: "¿Rechazar y eliminar esta reseña? El cliente podrá volver a escribir una si aplica.",
      onConfirm: async () => {
        setConfirmModal(null);
        if (savingLock.current) return;
        savingLock.current = true;
        setSaving(true);
        try {
          await rejectAdminReview(id);
          showMsg("Reseña eliminada");
          await load();
        } catch (err) {
          showMsg(err.response?.data?.message || "No se pudo eliminar", true);
        } finally {
          savingLock.current = false;
          setSaving(false);
        }
      },
    });
  };

  const submitBrand = async (e) => {
    e.preventDefault();
    if (savingLock.current) return;
    savingLock.current = true;
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
      setBrandForm({ authorName: "Dizor", city: "", rating: 5, comment: "", productId: "" });
      setBrandOpen(false);
      setQuery({ reviewView: "approved", reviewPage: 1 });
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo crear", true);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="st-reviews-page">
      <p className="admin-page__subtitle" style={{ marginTop: 0 }}>
        Modera reseñas de clientes (nacen pendientes) y publica voces de marca auto-aprobadas.
      </p>
      <ConfirmModal isOpen={!!confirmModal} message={confirmModal?.message} onConfirm={confirmModal?.onConfirm} onCancel={() => setConfirmModal(null)} />
      <AuthErrorAlert key={flashKey} message={message} variant={error ? "error" : "success"} />

      <div className="st-image-actions" style={{ marginBottom: "0.75rem" }}>
        <nav className="cms-tabs" aria-label="Estado de reseñas">
          {VIEWS.map((item) => (
            <button key={item.id} type="button" className={`st-tab${view === item.id ? " active" : ""}`} onClick={() => { clearMsg(); setQuery({ reviewView: item.id === "approved" ? "approved" : null, reviewPage: 1 }); }}>
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="admin-btn" aria-expanded={brandOpen} aria-controls="brand-review-form" onClick={() => setBrandOpen((open) => !open)}>
          Escribir reseña de marca
        </button>
      </div>

      {brandOpen ? (
        <form id="brand-review-form" className="admin-form product-form__section st-upload" onSubmit={submitBrand}>
          <h2 className="st-span">Reseña de marca</h2>
          <p className="st-hint st-span">Se publica aprobada y queda marcada como voz de marca, distinta de la opinión de un comprador.</p>
          <AuthFormField label="Firma / autor" name="authorName" value={brandForm.authorName} required onChange={(e) => setBrandForm((f) => ({ ...f, authorName: e.target.value }))} />
          <AuthFormField label="Ciudad (opcional)" name="city" value={brandForm.city} onChange={(e) => setBrandForm((f) => ({ ...f, city: e.target.value }))} />
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="brand-rating">Estrellas</label>
            <select id="brand-rating" className="auth-field__input" value={brandForm.rating} onChange={(e) => setBrandForm((f) => ({ ...f, rating: e.target.value }))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="auth-field st-span">
            <label className="auth-field__label" htmlFor="brand-comment">Comentario</label>
            <textarea id="brand-comment" className="auth-field__input" rows={4} required value={brandForm.comment} onChange={(e) => setBrandForm((f) => ({ ...f, comment: e.target.value }))} />
          </div>
          <AuthFormField label="ID producto (opcional)" name="productId" value={brandForm.productId} placeholder="ObjectId del producto" onChange={(e) => setBrandForm((f) => ({ ...f, productId: e.target.value }))} />
          <div className="st-span st-image-actions">
            <AuthSubmitButton loading={saving}>Publicar reseña</AuthSubmitButton>
            <button type="button" className="admin-btn admin-btn--tertiary" onClick={() => setBrandOpen(false)}>Cerrar</button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="auth-loading">Cargando…</p> : reviews.length === 0 ? (
        <p className="st-empty">No hay reseñas en esta pestaña.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="st-reviews">
            <thead>
              <tr><th>Autor</th><th>Producto</th><th>Nota</th><th>Comentario</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const long = String(review.comment || "").length > 140;
                return (
                  <tr key={review.id}>
                    <td data-label="Autor"><strong>{review.authorName}</strong>{review.city ? ` · ${review.city}` : ""}{review.user?.email ? <span className="st-meta" title={review.user.email}>{review.user.email}</span> : null}</td>
                    <td data-label="Producto">{review.product?.name || "Sin producto"}</td>
                    <td data-label="Nota">{review.rating} de 5</td>
                    <td data-label="Comentario">
                      <p className="st-comment">{long ? `${review.comment.slice(0, 140)}…` : review.comment}</p>
                      {long ? <details><summary>Ver comentario</summary><p>{review.comment}</p></details> : null}
                    </td>
                    <td data-label="Fecha">{formatWhen(review.createdAt)}</td>
                    <td data-label="Estado">
                      <span className={review.aprobado ? "st-chip st-chip--on" : "st-chip"}>{review.aprobado ? "Aprobada" : "Pendiente"}</span>
                      {review.isBrandReview ? <span className="st-chip"> Marca</span> : <span className="st-chip"> Comprador</span>}
                    </td>
                    <td data-label="Acciones">
                      <div className="st-row-actions">
                        {!review.aprobado ? (
                          <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" disabled={saving} aria-busy={saving || undefined} onClick={() => approve(review.id)}>Aprobar</button>
                        ) : null}
                        <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" disabled={saving} onClick={() => reject(review.id)} aria-label={`${review.aprobado ? "Eliminar" : "Rechazar"} reseña de ${review.authorName}`}>
                          {review.aprobado ? "Eliminar" : "Rechazar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="st-pager" aria-label="Páginas de reseñas">
        <button type="button" className="admin-btn admin-btn--sm" disabled={loading || meta.page <= 1} onClick={() => setQuery({ reviewPage: meta.page - 1 })}>Anterior</button>
        <span>Página {meta.page} de {meta.pages}</span>
        <span>{meta.total} reseñas</span>
        <button type="button" className="admin-btn admin-btn--sm" disabled={loading || meta.page >= meta.pages} onClick={() => setQuery({ reviewPage: meta.page + 1 })}>Siguiente</button>
        <label className="st-meta" htmlFor="review-size">Por página
          <select id="review-size" value={size} onChange={(e) => setQuery({ reviewSize: e.target.value, reviewPage: 1 })}>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </label>
      </div>
    </div>
  );
}
