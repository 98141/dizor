"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const SWIPE_THRESHOLD = 48;

/**
 * Comportamiento común de los visores ampliados (galería de inspiración de
 * la home y fotos de producto):
 * - bloquea el scroll del body sin salto por la barra de desplazamiento;
 * - lleva el foco al elemento inicial (botón cerrar);
 * - Escape cierra; ←/→ navegan (si hay más de una foto);
 * - Tab queda atrapado dentro del diálogo;
 * - deslizamiento táctil horizontal (umbral 48 px) para navegar.
 *
 * Los callbacks se leen de una ref: el efecto se monta una sola vez por
 * apertura y no roba el foco en cada render.
 *
 * @returns {{ onTouchStart: Function, onTouchEnd: Function }}
 */
export default function useLightboxControls({
  dialogRef,
  initialFocusRef,
  onClose,
  onPrev,
  onNext,
  total,
  swipeEnabled = true,
}) {
  const cb = useRef({ onClose, onPrev, onNext, total, swipeEnabled });
  const touchX = useRef(null);

  useLayoutEffect(() => {
    cb.current = { onClose, onPrev, onNext, total, swipeEnabled };
  });

  useEffect(() => {
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    initialFocusRef?.current?.focus();

    const onKeyDown = (e) => {
      const { onClose: close, onPrev: prev, onNext: next, total: n } = cb.current;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" && n > 1) {
        next();
      } else if (e.key === "ArrowLeft" && n > 1) {
        prev();
      } else if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
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
  }, [dialogRef, initialFocusRef]);

  const onTouchStart = (e) => {
    touchX.current = e.touches.length === 1 ? e.touches[0]?.clientX ?? null : null;
  };

  const onTouchEnd = (e) => {
    const { total: n, swipeEnabled: enabled, onPrev: prev, onNext: next } = cb.current;
    if (touchX.current === null || n < 2 || !enabled) {
      touchX.current = null;
      return;
    }
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) (dx < 0 ? next : prev)();
  };

  return { onTouchStart, onTouchEnd };
}
