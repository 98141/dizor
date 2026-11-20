"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/imagePlaceholder";
import {
  DEFAULT_INSPIRATION_RATIO,
  focusPosition,
  inspirationLayout,
  shapeOf,
} from "@/lib/inspirationLayout";

const SWIPE_THRESHOLD = 48;

function Icon({ path }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

const ICON_CLOSE = "M6 6l12 12M18 6L6 18";
const ICON_PREV = "M15 5l-7 7 7 7";
const ICON_NEXT = "M9 5l7 7-7 7";
const ICON_EXTERNAL = "M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4";

/**
 * Galería Inspiración (reglas en lib/inspirationLayout). Marcos de
 * proporción fija que la foto llena (cover) según su punto de enfoque.
 * El orden del DOM es el orden editorial en todos los tamaños.
 * @param {{ images: { id: string, url: string, alt: string, linkHref: string, ratio: number|null, focalX: number|null, focalY: number|null }[] }} props
 */
export default function InspirationGallery({ images = [] }) {
  const [ratios, setRatios] = useState(() =>
    images.map((img) => img.ratio || DEFAULT_INSPIRATION_RATIO)
  );
  const [openIndex, setOpenIndex] = useState(null);
  const tileRefs = useRef([]);

  /** Respaldo: si el servidor no obtuvo la proporción, se mide al cargar. */
  const handleLoad = useCallback(
    (idx, event) => {
      if (images[idx]?.ratio) return;
      const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
      if (!w || !h) return;
      setRatios((prev) => {
        if (Math.abs(prev[idx] - w / h) < 0.01) return prev;
        const next = [...prev];
        next[idx] = w / h;
        return next;
      });
    },
    [images]
  );

  const openIndexRef = useRef(null);
  useEffect(() => {
    openIndexRef.current = openIndex;
  }, [openIndex]);

  const close = useCallback(() => {
    const current = openIndexRef.current;
    setOpenIndex(null);
    // Devolver el foco a la foto que se estaba viendo.
    if (current !== null) {
      requestAnimationFrame(() => tileRefs.current[current]?.focus());
    }
  }, []);

  if (!images.length) return null;

  const count = images.length;
  const layout = inspirationLayout(ratios);

  const renderItem = (img, idx) => {
    const { mobile, sizes } = layout[idx];
    const itemClass = [
      "home-inspire__item",
      idx === 0 ? "is-lead" : "",
      mobile.kind === "wide" ? "is-m-wide" : "",
      mobile.kind === "center" ? "is-m-center" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div
        key={img.id}
        className={itemClass}
        style={{
          "--m-ar": mobile.css,
          "--focus": focusPosition(img.focalX, img.focalY),
        }}
      >
        <button
          type="button"
          ref={(el) => {
            tileRefs.current[idx] = el;
          }}
          className="home-inspire__tile"
          onClick={() => setOpenIndex(idx)}
          aria-haspopup="dialog"
          aria-label={`Ampliar fotografía: ${img.alt}`}
        >
          <Image
            src={img.url}
            alt=""
            fill
            sizes={sizes}
            className="home-inspire__photo"
            placeholder="blur"
            blurDataURL={SHIMMER_BLUR_DATA_URL}
            onLoad={(e) => handleLoad(idx, e)}
          />
        </button>
      </div>
    );
  };

  return (
    <>
      <div
        className="home-inspire__gallery"
        data-count={count}
        data-shape={count === 1 ? shapeOf(ratios[0]) : undefined}
        role="region"
        aria-label="Fotografías de inspiración"
      >
        {images.map((img, idx) => renderItem(img, idx))}
      </div>

      {openIndex !== null ? (
        <InspirationLightbox
          images={images}
          ratios={ratios}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function InspirationLightbox({ images, ratios, index, onIndexChange, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const touchX = useRef(null);
  const total = images.length;
  const img = images[index];

  const go = useCallback(
    (delta) => onIndexChange((i) => (i + delta + total) % total),
    [onIndexChange, total]
  );

  // Bloqueo de scroll (sin salto por la barra), foco inicial y teclado.
  useEffect(() => {
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" && total > 1) {
        go(1);
      } else if (e.key === "ArrowLeft" && total > 1) {
        go(-1);
      } else if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll(
          'button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [onClose, go, total]);

  const onTouchStart = (e) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    if (touchX.current === null || total < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="home-inspire-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de inspiración"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={closeRef}
        type="button"
        className="home-inspire-lightbox__btn home-inspire-lightbox__close"
        onClick={onClose}
        aria-label="Cerrar galería"
      >
        <Icon path={ICON_CLOSE} />
      </button>

      <div
        className="home-inspire-lightbox__stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <figure
          key={img.id}
          className="home-inspire-lightbox__frame"
          style={{ "--ar": ratios[index].toFixed(4) }}
        >
          <Image
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 767px) 100vw, 80vw"
            className="home-inspire-lightbox__img"
            placeholder="blur"
            blurDataURL={SHIMMER_BLUR_DATA_URL}
          />
        </figure>
      </div>

      {total > 1 ? (
        <>
          <button
            type="button"
            className="home-inspire-lightbox__btn home-inspire-lightbox__nav home-inspire-lightbox__nav--prev"
            onClick={() => go(-1)}
            aria-label="Fotografía anterior"
          >
            <Icon path={ICON_PREV} />
          </button>
          <button
            type="button"
            className="home-inspire-lightbox__btn home-inspire-lightbox__nav home-inspire-lightbox__nav--next"
            onClick={() => go(1)}
            aria-label="Fotografía siguiente"
          >
            <Icon path={ICON_NEXT} />
          </button>
        </>
      ) : null}

      <div className="home-inspire-lightbox__footer">
        <p className="home-inspire-lightbox__counter" aria-live="polite">
          {index + 1} / {total}
        </p>
        {img.linkHref ? (
          <a
            href={img.linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="home-inspire-lightbox__link"
          >
            Ver publicación
            <Icon path={ICON_EXTERNAL} />
          </a>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
