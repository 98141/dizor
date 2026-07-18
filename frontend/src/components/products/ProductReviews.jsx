"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getProductReviews,
  createCustomerReview,
} from "@/services/reviewService";

export default function ProductReviews({ productId, productName }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    rating: 5,
    comment: "",
    city: "",
    authorName: "",
  });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getProductReviews(productId);
        if (!cancelled) setReviews(data.reviews || []);
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (user?.name) {
      setForm((f) => ({ ...f, authorName: user.name }));
    }
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      await createCustomerReview({
        productId,
        rating: Number(form.rating),
        comment: form.comment,
        city: form.city,
        authorName: form.authorName || user?.name,
      });
      setStatus("success");
      setMessage("Reseña enviada. Se publicará cuando sea aprobada.");
      setForm((f) => ({ ...f, comment: "", city: "" }));
    } catch (err) {
      setStatus("error");
      setMessage(
        err.response?.data?.message || "No se pudo enviar la reseña"
      );
    }
  };

  return (
    <section className="product-reviews">
      <h2 className="product-reviews__title">Reseñas</h2>

      {loading ? (
        <p className="product-reviews__empty">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <p className="product-reviews__empty">
          Aún no hay reseñas públicas para este producto.
        </p>
      ) : (
        <ul className="product-reviews__list">
          {reviews.map((r) => (
            <li key={r.id} className="product-reviews__item">
              <span className="product-reviews__stars" aria-hidden="true">
                {"★".repeat(r.rating)}
              </span>
              <p>&ldquo;{r.comment}&rdquo;</p>
              <footer>
                <strong>{r.authorName}</strong>
                {r.city ? ` · ${r.city}` : ""}
              </footer>
            </li>
          ))}
        </ul>
      )}

      <div className="product-reviews__form-wrap">
        <h3>Escribe tu reseña</h3>
        {!user ? (
          <p>
            <Link href="/login">Inicia sesión</Link> para reseñar{" "}
            {productName || "este producto"} (solo con compra verificada).
          </p>
        ) : (
          <form className="product-reviews__form" onSubmit={submit}>
            <label>
              Estrellas
              <select
                value={form.rating}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating: e.target.value }))
                }
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ciudad (opcional)
              <input
                type="text"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </label>
            <label>
              Comentario
              <textarea
                required
                minLength={10}
                rows={4}
                value={form.comment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comment: e.target.value }))
                }
              />
            </label>
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Enviando…" : "Enviar reseña"}
            </button>
            {message ? (
              <p
                className={
                  status === "error"
                    ? "product-reviews__msg product-reviews__msg--error"
                    : "product-reviews__msg"
                }
              >
                {message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
