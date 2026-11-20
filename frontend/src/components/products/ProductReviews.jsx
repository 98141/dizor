"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProductReviews,
  createCustomerReview,
} from "@/services/reviewService";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";

const PAGE_SIZE = 4;
const MIN_COMMENT = 10;
const RATING_LABELS = { 1: "Mala", 2: "Regular", 3: "Buena", 4: "Muy buena", 5: "Excelente" };
const STAR_PATH =
  "M12 2.8l2.76 5.6 6.18.9-4.47 4.36 1.05 6.15L12 16.9l-5.52 2.9 1.05-6.15L3.06 9.3l6.18-.9L12 2.8z";

const formatAverage = (n) =>
  n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const reviewsWord = (n) => (n === 1 ? "reseña" : "reseñas");

export default function ProductReviews({ productId, productName }) {
  const { user, loadingAuth } = useAuth();
  const pathname = usePathname();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const itemRefs = useRef([]);
  const listTopRef = useRef(null);
  const moreBtnRef = useRef(null);
  const focusAfterRender = useRef(null);

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

  // Foco tras "Ver más" (primera reseña nueva) o "Ver menos" (botón).
  useEffect(() => {
    const target = focusAfterRender.current;
    if (target == null) return;
    focusAfterRender.current = null;
    if (target === "more-button") {
      moreBtnRef.current?.focus({ preventScroll: true });
    } else {
      itemRefs.current[target]?.focus();
    }
  }, [visible]);

  // Visitantes: solo la lista, y solo si hay reseñas publicadas.
  // Con sesión: lista (o mensaje de vacío) + formulario.
  if (loadingAuth || (!user && (loading || reviews.length === 0))) return null;

  // Resumen calculado solo con las reseñas publicadas que devuelve la API
  // (máx. 50, las más recientes).
  const count = reviews.length;
  const average = count
    ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count
    : 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    n: reviews.filter((r) => Number(r.rating) === stars).length,
  }));

  const shown = reviews.slice(0, visible);
  const hasMore = visible < count;
  const canCollapse = count > PAGE_SIZE && !hasMore;

  const showMore = () => {
    focusAfterRender.current = visible;
    setVisible((v) => Math.min(count, v + PAGE_SIZE));
  };

  const showLess = () => {
    focusAfterRender.current = "more-button";
    setVisible(PAGE_SIZE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listTopRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <section className="pdp-reviews" aria-labelledby="pdp-reviews-title">
      <header className="pdp-reviews__header">
        <p className="pdp-reviews__eyebrow">Opiniones</p>
        <h2 id="pdp-reviews-title" className="pdp-reviews__title">
          Reseñas de nuestros clientes
        </h2>
        <p className="pdp-reviews__lead">
          Cada reseña se publica después de una revisión de nuestro equipo.
        </p>
      </header>

      {loading ? (
        <p className="pdp-reviews__empty" role="status">
          Cargando reseñas…
        </p>
      ) : count === 0 ? (
        <p className="pdp-reviews__empty">
          Aún no hay reseñas publicadas para {productName || "este producto"}.
        </p>
      ) : (
        <div className="pdp-reviews__body">
          <div className="pdp-reviews__summary">
            <p className="sr-only">
              Calificación media: {formatAverage(average)} de 5, basada en {count}{" "}
              {reviewsWord(count)}
              {count >= 50 ? " (las 50 más recientes)" : ""}.
            </p>
            <div className="pdp-reviews__score" aria-hidden="true">
              <span className="pdp-reviews__score-value">{formatAverage(average)}</span>
              <div className="pdp-reviews__score-meta">
                <StarsDisplay value={average} size={20} />
                <span className="pdp-reviews__score-count">
                  {count} {reviewsWord(count)}
                  {count >= 50 ? " (las 50 más recientes)" : ""}
                </span>
              </div>
            </div>
            <ul className="pdp-reviews__dist" aria-label="Distribución de calificaciones">
              {distribution.map(({ stars, n }) => (
                <li key={stars} className="pdp-reviews__dist-row">
                  <span className="pdp-reviews__dist-label" aria-hidden="true">
                    {stars}
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
                      <path d={STAR_PATH} />
                    </svg>
                  </span>
                  <span className="pdp-reviews__dist-bar" aria-hidden="true">
                    <span style={{ width: `${count ? (n / count) * 100 : 0}%` }} />
                  </span>
                  <span className="pdp-reviews__dist-n">
                    <span className="sr-only">
                      {stars} {stars === 1 ? "estrella" : "estrellas"}:{" "}
                    </span>
                    {n}
                    <span className="sr-only"> {reviewsWord(n)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {!user ? (
              <p className="pdp-reviews__login">
                ¿Compraste esta pieza?{" "}
                <Link href={`/login?next=${encodeURIComponent(`${pathname}#escribir-resena`)}`}>
                  Inicia sesión para escribir tu reseña
                </Link>
              </p>
            ) : null}
          </div>

          <div className="pdp-reviews__listwrap" ref={listTopRef}>
            <ul className="pdp-reviews__list" id="pdp-reviews-list">
              {shown.map((r, i) => (
                <li
                  key={r.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  tabIndex={-1}
                  className="pdp-reviews__item"
                >
                  <article className="pdp-review">
                    <StarsDisplay value={r.rating} size={16} />
                    <span className="sr-only">Calificación: {r.rating} de 5.</span>
                    <blockquote className="pdp-review__comment">
                      <p>{r.comment}</p>
                    </blockquote>
                    <footer className="pdp-review__author">
                      <span className="pdp-review__monogram" aria-hidden="true">
                        {(String(r.authorName || "").match(/\p{L}/u)?.[0] || "·").toUpperCase()}
                      </span>
                      <span className="pdp-review__who">
                        <strong>{r.authorName}</strong>
                        {r.city ? <span className="pdp-review__city">{r.city}</span> : null}
                      </span>
                      {r.isBrandReview ? (
                        <span className="pdp-review__brand">Publicada por la tienda</span>
                      ) : null}
                    </footer>
                  </article>
                </li>
              ))}
            </ul>

            {count > PAGE_SIZE ? (
              <div className="pdp-reviews__more">
                <p className="pdp-reviews__progress" aria-live="polite">
                  Mostrando {shown.length} de {count} {reviewsWord(count)}
                </p>
                {hasMore ? (
                  <button
                    ref={moreBtnRef}
                    type="button"
                    className="pdp-reviews__more-btn"
                    onClick={showMore}
                    aria-controls="pdp-reviews-list"
                  >
                    Ver más reseñas
                  </button>
                ) : null}
                {canCollapse ? (
                  <button
                    type="button"
                    className="pdp-reviews__more-btn"
                    onClick={showLess}
                    aria-controls="pdp-reviews-list"
                  >
                    Ver menos
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {user ? (
        <ReviewForm productId={productId} productName={productName} user={user} />
      ) : null}
    </section>
  );
}

/* ───────────────────────── Formulario ───────────────────────── */

function ReviewForm({ productId, productName, user }) {
  const uid = useId();
  const ids = {
    rating: `${uid}-rating`,
    ratingErr: `${uid}-rating-err`,
    city: `${uid}-city`,
    cityHint: `${uid}-city-hint`,
    comment: `${uid}-comment`,
    commentHint: `${uid}-comment-hint`,
    commentErr: `${uid}-comment-err`,
    submitHint: `${uid}-submit-hint`,
  };
  const [rating, setRating] = useState(0);
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  // Autorización para publicar nombre y ciudad (H-14, H-03). Nunca premarcada.
  const [publicationAuthorization, setPublicationAuthorization] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();
  const firstStarRef = useRef(null);
  const commentRef = useRef(null);

  const noticeReady = isNoticeReady(notices, "review_publication");
  const submitDisabled = status === "loading" || !noticeReady || !publicationAuthorization;
  const commentLength = comment.trim().length;

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!rating) nextErrors.rating = "Elige una calificación de 1 a 5 estrellas.";
    if (commentLength < MIN_COMMENT)
      nextErrors.comment = `Escribe al menos ${MIN_COMMENT} caracteres.`;
    setErrors(nextErrors);
    if (nextErrors.rating) {
      firstStarRef.current?.focus();
      return;
    }
    if (nextErrors.comment) {
      commentRef.current?.focus();
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      await createCustomerReview({
        productId,
        rating: Number(rating),
        comment,
        city,
        authorName: user?.name,
        publicationAuthorization: publicationAuthorization === true,
      });
      setStatus("success");
      setMessage("Reseña enviada. Se publicará cuando sea aprobada.");
      setComment("");
      setCity("");
      setRating(0);
      setPublicationAuthorization(false);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "No se pudo enviar la reseña");
    }
  };

  return (
    <div className="pdp-review-form" id="escribir-resena">
      <form
        className="pdp-review-form__main"
        onSubmit={submit}
        noValidate
        aria-labelledby={`${uid}-title`}
      >
        <h3 id={`${uid}-title`} className="pdp-review-form__title">
          Escribe tu reseña
        </h3>
        <p className="pdp-review-form__intro">
          Cuéntanos cómo te ha ido con {productName || "tu pieza"}.
        </p>
        {user?.name ? (
          <p className="pdp-review-form__as">
            Se publicará con el nombre de tu cuenta: <strong>{user.name}</strong>
          </p>
        ) : null}

        <StarRatingInput
          name={ids.rating}
          value={rating}
          onChange={(v) => {
            setRating(v);
            if (errors.rating) setErrors((er) => ({ ...er, rating: undefined }));
          }}
          firstRef={firstStarRef}
          errorId={errors.rating ? ids.ratingErr : undefined}
          error={errors.rating}
        />

        <div className="pdp-review-form__field">
          <label htmlFor={ids.city} className="pdp-review-form__label">
            Ciudad <span className="pdp-review-form__optional">(opcional)</span>
          </label>
          <input
            id={ids.city}
            type="text"
            autoComplete="address-level2"
            className="pdp-review-form__input"
            aria-describedby={ids.cityHint}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <p id={ids.cityHint} className="pdp-review-form__hint">
            Se mostrará públicamente junto a tu nombre.
          </p>
        </div>

        <div className="pdp-review-form__field">
          <label htmlFor={ids.comment} className="pdp-review-form__label">
            Tu comentario
          </label>
          <textarea
            id={ids.comment}
            ref={commentRef}
            rows={5}
            required
            minLength={MIN_COMMENT}
            className="pdp-review-form__input pdp-review-form__textarea"
            aria-invalid={errors.comment ? "true" : undefined}
            aria-describedby={`${ids.commentHint}${errors.comment ? ` ${ids.commentErr}` : ""}`}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (errors.comment && e.target.value.trim().length >= MIN_COMMENT)
                setErrors((er) => ({ ...er, comment: undefined }));
            }}
          />
          <p id={ids.commentHint} className="pdp-review-form__hint pdp-review-form__hint--row">
            <span>Mínimo {MIN_COMMENT} caracteres.</span>
            <span
              className={`pdp-review-form__counter${commentLength >= MIN_COMMENT ? " is-ok" : ""}`}
            >
              {commentLength} {commentLength === 1 ? "carácter" : "caracteres"}
            </span>
          </p>
          {errors.comment ? (
            <p id={ids.commentErr} className="pdp-review-form__error" role="alert">
              {errors.comment}
            </p>
          ) : null}
        </div>

        <div className="pdp-review-form__consent">
          <ConsentCheckbox
            notices={notices}
            noticesError={noticesError}
            purpose="review_publication"
            checked={publicationAuthorization}
            onChange={setPublicationAuthorization}
            compact
          />
        </div>

        <div className="pdp-review-form__actions">
          <button
            type="submit"
            className="pdp-review-form__submit"
            disabled={submitDisabled}
            aria-busy={status === "loading" || undefined}
            aria-describedby={!publicationAuthorization && noticeReady ? ids.submitHint : undefined}
          >
            {status === "loading" ? "Enviando…" : "Enviar reseña"}
          </button>
          {!publicationAuthorization && noticeReady ? (
            <p id={ids.submitHint} className="pdp-review-form__hint">
              Marca la autorización para poder enviar.
            </p>
          ) : null}
        </div>

        <div className="pdp-review-form__status" role="status" aria-live="polite">
          {message && status === "success" ? (
            <p className="pdp-review-form__msg is-success">{message}</p>
          ) : null}
        </div>
        {message && status === "error" ? (
          <p className="pdp-review-form__msg is-error" role="alert">
            {message}
          </p>
        ) : null}
      </form>

      <aside className="pdp-review-form__aside" aria-label="Antes de escribir">
        <p className="pdp-review-form__aside-eyebrow">Tu experiencia</p>
        <p className="pdp-review-form__aside-title">
          Tu opinión ayuda a otras personas a elegir su pieza.
        </p>
        <ul className="pdp-review-form__points">
          <li>
            <AsideIcon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.3 2.3 4.7-5" />
            Se publica después de una revisión de nuestro equipo.
          </li>
          <li>
            <AsideIcon d="M6 8h12l-1 12H7L6 8zM9 8V6.5a3 3 0 0 1 6 0V8" />
            Disponible para productos de tus compras verificadas.
          </li>
          <li>
            <AsideIcon d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            La ciudad es opcional y se muestra junto a tu nombre.
          </li>
        </ul>
      </aside>
    </div>
  );
}

function AsideIcon({ d }) {
  return (
    <svg
      className="pdp-review-form__point-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/* ───────────────────── Estrellas: entrada ───────────────────── */

/**
 * 5 estrellas interactivas sobre radios nativos (mismo `name`):
 * - teclado: Tab entra al grupo, ←/→ (o ↑/↓) cambian la calificación;
 * - lector de pantalla: «N estrellas, botón de opción, N de 5»;
 * - ratón: previsualización al pasar el cursor; clic fija la selección.
 */
function StarRatingInput({ name, value, onChange, firstRef, error, errorId }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <fieldset
      className={`pdp-stars-input${error ? " has-error" : ""}`}
      aria-describedby={errorId}
    >
      <legend className="pdp-review-form__label">Tu calificación</legend>
      <div className="pdp-stars-input__row">
        <div className="pdp-stars-input__stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const id = `${name}-${n}`;
            const filled = n <= display;
            return (
              <span key={n} className="pdp-stars-input__item">
                <input
                  ref={n === 1 ? firstRef : undefined}
                  id={id}
                  type="radio"
                  name={name}
                  value={n}
                  checked={value === n}
                  onChange={() => onChange(n)}
                  className="pdp-stars-input__radio"
                />
                <label
                  htmlFor={id}
                  className={`pdp-stars-input__star${filled ? " is-filled" : ""}${hover && n <= hover ? " is-preview" : ""}`}
                  onMouseEnter={() => setHover(n)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d={STAR_PATH} />
                  </svg>
                  <span className="sr-only">
                    {n} {n === 1 ? "estrella" : "estrellas"} ({RATING_LABELS[n]})
                  </span>
                </label>
              </span>
            );
          })}
        </div>
        <p className="pdp-stars-input__value" aria-hidden="true">
          {display ? (
            <>
              <strong>{display} de 5</strong> · {RATING_LABELS[display]}
            </>
          ) : (
            "Selecciona de 1 a 5"
          )}
        </p>
      </div>
      {error ? (
        <p id={errorId} className="pdp-review-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/* ───────────────────── Estrellas: lectura ───────────────────── */

/** Estrellas decorativas (la cifra va siempre en texto accesible aparte). */
function StarsDisplay({ value, size = 16 }) {
  const pct = Math.max(0, Math.min(5, Number(value) || 0)) * 20;
  const row = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </>
  );
  return (
    <span className="pdp-stars" aria-hidden="true" style={{ "--star-size": `${size}px` }}>
      <span className="pdp-stars__empty">{row}</span>
      <span className="pdp-stars__fill" style={{ width: `${pct}%` }}>
        {row}
      </span>
    </span>
  );
}
