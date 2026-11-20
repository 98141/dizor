"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/imagePlaceholder";
import ProductLightbox from "@/components/products/ProductLightbox";

// Alt que parecen nombres de archivo («WhatsApp Image 2026-…», «IMG_1234.jpg»)
// no describen nada: se sustituyen solo en pantalla, sin tocar los datos.
const FILENAME_ALT = /whatsapp image|^img[_-]?\d|^dsc[_-]?\d|\.(jpe?g|png|webp|heic)$|\d{4}-\d{2}-\d{2}/i;

export function galleryImages(product) {
  const list = product.images?.length
    ? product.images
    : [{ url: product.mainImage, alt: product.name }];
  const valid = list.filter((img) => img?.url);
  const total = valid.length;
  return valid.map((img, i) => {
    const raw = String(img.alt || "").trim();
    const alt =
      raw && !FILENAME_ALT.test(raw)
        ? raw
        : total > 1
          ? `${product.name} — foto ${i + 1}`
          : product.name;
    return { url: img.url, alt };
  });
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Arrow({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * Galería de la PDP.
 * - Foto completa (contain) en marco 4:5: sin recortar asas, alas ni pompones.
 * - Carrusel deslizable nativo (scroll-snap, sin dependencias) con contador
 *   y flechas accesibles; las miniaturas se conservan para comparar colores
 *   y vistas de un vistazo (≥1280 px: columna vertical a la izquierda).
 * - Clic / Enter abre el visor ampliado; al cerrarlo el foco vuelve a la
 *   foto que se estaba viendo.
 */
export default function ProductGallery({ product }) {
  const images = galleryImages(product);
  const total = images.length;
  const [active, setActive] = useState(0);
  const [lightboxFrom, setLightboxFrom] = useState(null);
  const trackRef = useRef(null);
  const slideBtnRefs = useRef([]);
  const thumbsRef = useRef(null);
  const rafRef = useRef(0);

  const goTo = useCallback(
    (i, { smooth = true } = {}) => {
      const track = trackRef.current;
      const next = (i + total) % total;
      if (track) {
        track.scrollTo({
          left: next * track.clientWidth,
          behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
        });
      }
      setActive(next);
    },
    [total]
  );

  // La foto activa sale de la posición real del carrusel (swipe incluido).
  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const track = trackRef.current;
      if (!track || !track.clientWidth) return;
      const i = Math.round(track.scrollLeft / track.clientWidth);
      setActive((prev) => (prev === i ? prev : Math.min(total - 1, Math.max(0, i))));
    });
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Mantener visible la miniatura activa dentro de su fila/columna.
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[active];
    if (!strip || !thumb) return;
    const s = strip.getBoundingClientRect();
    const t = thumb.getBoundingClientRect();
    if (t.left < s.left || t.right > s.right || t.top < s.top || t.bottom > s.bottom) {
      strip.scrollTo({
        left: strip.scrollLeft + (t.left - s.left) - (s.width - t.width) / 2,
        top: strip.scrollTop + (t.top - s.top) - (s.height - t.height) / 2,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }, [active]);

  const onTrackKeyDown = (e) => {
    if (total < 2) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(active + 1);
      requestAnimationFrame(() => slideBtnRefs.current[(active + 1) % total]?.focus({ preventScroll: true }));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(active - 1);
      requestAnimationFrame(() => slideBtnRefs.current[(active - 1 + total) % total]?.focus({ preventScroll: true }));
    }
  };

  const closeLightbox = useCallback(
    (lastIndex) => {
      setLightboxFrom(null);
      goTo(lastIndex, { smooth: false });
      requestAnimationFrame(() => slideBtnRefs.current[lastIndex]?.focus({ preventScroll: true }));
    },
    [goTo]
  );

  return (
    <div
      className={`pdp-gallery${total > 1 ? " pdp-gallery--multi" : ""}`}
      role="region"
      aria-roledescription="galería"
      aria-label={`Fotografías de ${product.name}`}
    >
      <div className="pdp-gallery__stage">
        <div
          ref={trackRef}
          className="pdp-gallery__track"
          onScroll={onScroll}
          onKeyDown={onTrackKeyDown}
        >
          {images.map((img, i) => (
            <div
              key={img.url}
              className="pdp-gallery__slide"
              role="group"
              aria-roledescription="foto"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={i !== active ? "true" : undefined}
            >
              <button
                type="button"
                ref={(el) => {
                  slideBtnRefs.current[i] = el;
                }}
                className="pdp-gallery__open"
                tabIndex={i === active ? 0 : -1}
                onClick={() => setLightboxFrom(i)}
                aria-haspopup="dialog"
                aria-label={`Ampliar fotografía: ${img.alt}`}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, (max-width: 1279px) 52vw, 600px"
                  className="pdp-gallery__img"
                  preload={i === 0}
                  loading={i === 0 ? "eager" : "lazy"}
                  placeholder={i === 0 ? "blur" : "empty"}
                  blurDataURL={i === 0 ? SHIMMER_BLUR_DATA_URL : undefined}
                  draggable={false}
                />
              </button>
            </div>
          ))}
        </div>

        {total > 1 && (
          <div className="pdp-gallery__controls">
            <p className="pdp-gallery__counter" aria-live="polite">
              <span className="sr-only">Foto </span>
              {active + 1} / {total}
            </p>
            <button
              type="button"
              className="pdp-gallery__arrow"
              onClick={() => goTo(active - 1)}
              aria-label="Foto anterior"
            >
              <Arrow dir="prev" />
            </button>
            <button
              type="button"
              className="pdp-gallery__arrow"
              onClick={() => goTo(active + 1)}
              aria-label="Foto siguiente"
            >
              <Arrow dir="next" />
            </button>
          </div>
        )}
      </div>

      {total > 1 && (
        <div
          ref={thumbsRef}
          className="pdp-gallery__thumbs"
          role="group"
          aria-label="Miniaturas"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              className={`pdp-gallery__thumb${active === i ? " is-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Ver foto ${i + 1} de ${total}`}
              aria-current={active === i ? "true" : undefined}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="80px"
                // Pocas y visibles; además evitan que Next confunda la
                // miniatura (misma URL) con la imagen LCP.
                loading="eager"
                className="pdp-gallery__thumb-img"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxFrom !== null && (
        <ProductLightbox
          images={images}
          startIndex={lightboxFrom}
          productName={product.name}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}
