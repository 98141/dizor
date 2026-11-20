"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import useLightboxControls from "@/hooks/useLightboxControls";

const ZOOM = 2;
// La foto servida debe tener al menos 1,5× los píxeles mostrados para que
// el 2× no se vea borroso; si no, no se ofrece zoom.
const MIN_ZOOM_RESOLUTION = 1.5;

function Icon({ d }) {
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
      <path d={d} />
    </svg>
  );
}

const ICON_CLOSE = "M6 6l12 12M18 6L6 18";
const ICON_PREV = "M15 5l-7 7 7 7";
const ICON_NEXT = "M9 5l7 7-7 7";
const ICON_ZOOM_IN = "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zM21 21l-5.2-5.2M10.5 7.5v6M7.5 10.5h6";
const ICON_ZOOM_OUT = "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zM21 21l-5.2-5.2M7.5 10.5h6";

/**
 * Visor ampliado de fotos de producto. Misma arquitectura que el de la
 * galería de inspiración (hooks/useLightboxControls) + zoom moderado:
 * clic / doble toque para acercar en el punto elegido, mover el puntero o
 * el dedo para recorrer la foto, botón accesible para acercar/alejar.
 */
export default function ProductLightbox({ images, startIndex = 0, productName, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const stageRef = useRef(null);
  const lastTap = useRef(0);
  const total = images.length;
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [zoomable, setZoomable] = useState({});
  const img = images[index];

  const go = useCallback(
    (delta) => {
      setZoomed(false);
      setIndex((i) => (i + delta + total) % total);
    },
    [total]
  );

  const close = useCallback(() => onClose(index), [onClose, index]);

  const { onTouchStart, onTouchEnd } = useLightboxControls({
    dialogRef,
    initialFocusRef: closeRef,
    onClose: close,
    onPrev: () => go(-1),
    onNext: () => go(1),
    total,
    swipeEnabled: !zoomed,
  });

  const pointToOrigin = (clientX, clientY) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    setOrigin({
      x: Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100)),
    });
  };

  const handleLoad = (e) => {
    const el = e.currentTarget;
    const box = stageRef.current?.getBoundingClientRect();
    if (!box || !el.naturalWidth) return;
    const ratio = el.naturalWidth / el.naturalHeight;
    const shownW = Math.min(box.width, box.height * ratio);
    setZoomable((z) => ({
      ...z,
      [img.url]: el.naturalWidth >= shownW * MIN_ZOOM_RESOLUTION,
    }));
  };

  const canZoom = !!zoomable[img.url];

  const toggleZoomAt = (clientX, clientY) => {
    if (!canZoom) return;
    if (!zoomed && clientX != null) pointToOrigin(clientX, clientY);
    if (!zoomed && clientX == null) setOrigin({ x: 50, y: 50 });
    setZoomed((z) => !z);
  };

  return createPortal(
    <div
      ref={dialogRef}
      className={`pdp-lightbox${zoomed ? " is-zoomed" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotografías de ${productName}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={closeRef}
        type="button"
        className="pdp-lightbox__btn pdp-lightbox__close"
        onClick={close}
        aria-label="Cerrar visor"
      >
        <Icon d={ICON_CLOSE} />
      </button>

      <div
        className="pdp-lightbox__stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <figure
          ref={stageRef}
          className="pdp-lightbox__frame"
          onClick={(e) => {
            // Ratón / teclado: un clic acerca en el punto o aleja.
            if (e.detail === 0 || e.nativeEvent.pointerType !== "touch") {
              toggleZoomAt(e.clientX, e.clientY);
            }
          }}
          onMouseMove={(e) => {
            if (zoomed) pointToOrigin(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return;
            const now = Date.now();
            const t = e.touches[0];
            if (now - lastTap.current < 300) {
              toggleZoomAt(t.clientX, t.clientY);
              lastTap.current = 0;
            } else {
              lastTap.current = now;
            }
          }}
          onTouchMove={(e) => {
            if (!zoomed || e.touches.length !== 1) return;
            const t = e.touches[0];
            pointToOrigin(t.clientX, t.clientY);
          }}
          style={{ cursor: canZoom ? (zoomed ? "zoom-out" : "zoom-in") : "default" }}
        >
          <div
            className="pdp-lightbox__zoom"
            style={{
              transform: zoomed ? `scale(${ZOOM})` : "none",
              transformOrigin: `${origin.x}% ${origin.y}%`,
            }}
          >
            <Image
              key={img.url}
              src={img.url}
              alt={img.alt}
              fill
              sizes="(max-width: 767px) 100vw, 80vw"
              className="pdp-lightbox__img"
              onLoad={handleLoad}
              draggable={false}
            />
          </div>
        </figure>
      </div>

      {total > 1 ? (
        <>
          <button
            type="button"
            className="pdp-lightbox__btn pdp-lightbox__nav pdp-lightbox__nav--prev"
            onClick={() => go(-1)}
            aria-label="Fotografía anterior"
          >
            <Icon d={ICON_PREV} />
          </button>
          <button
            type="button"
            className="pdp-lightbox__btn pdp-lightbox__nav pdp-lightbox__nav--next"
            onClick={() => go(1)}
            aria-label="Fotografía siguiente"
          >
            <Icon d={ICON_NEXT} />
          </button>
        </>
      ) : null}

      <div className="pdp-lightbox__footer">
        <p className="pdp-lightbox__counter" aria-live="polite">
          <span className="sr-only">Foto </span>
          {index + 1} / {total}
        </p>
        {canZoom ? (
          <button
            type="button"
            className="pdp-lightbox__zoom-btn"
            onClick={() => toggleZoomAt()}
            aria-pressed={zoomed}
          >
            <Icon d={zoomed ? ICON_ZOOM_OUT : ICON_ZOOM_IN} />
            {zoomed ? "Alejar" : "Acercar"}
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
