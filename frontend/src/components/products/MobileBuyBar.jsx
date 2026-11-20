"use client";

import { useEffect, useRef, useState } from "react";
import { setWhatsAppContext } from "@/lib/whatsappContext";

const MOBILE_QUERY = "(max-width: 767px)";
const FORM_FIELD = "input, textarea, select, [contenteditable='true']";

/**
 * Barra de compra fija en móvil (< 768 px). Sin lógica propia de compra:
 * recibe el estado y las acciones del panel principal (ProductoClient).
 *
 * Aparece solo cuando el botón principal ha salido por arriba de la
 * pantalla y se oculta cuando:
 * - el botón principal vuelve a verse;
 * - el footer entra en pantalla (no lo tapa);
 * - hay un campo de formulario con foco o el teclado reduce el viewport;
 * - el banner de cookies está abierto.
 * Mientras está visible, WhatsApp sube por encima (no se tapan).
 */
export default function MobileBuyBar({
  anchorRef,
  productName,
  priceLabel,
  summary,
  ctaLabel,
  ctaDisabled,
  needsSelection,
  status,
  onAdd,
  onChoose,
}) {
  const barRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const vv = window.visualViewport;
    const footer = document.querySelector(".site-footer");
    let raf = 0;

    // Medición directa (no IntersectionObserver): un salto o un "fling"
    // puede llevar el botón de debajo a encima de la pantalla sin cruzarla,
    // y el observador no avisaría.
    const evaluate = () => {
      raf = 0;
      const anchorPassed = anchor.getBoundingClientRect().bottom < 0;
      const footerInView = footer
        ? footer.getBoundingClientRect().top < window.innerHeight
        : false;
      const field = document.activeElement?.matches?.(FORM_FIELD);
      const keyboard = vv ? vv.height < window.innerHeight * 0.75 : false;
      const cookieBanner = !!document.querySelector(".cookie-banner");
      const next =
        mq.matches && anchorPassed && !footerInView && !field && !keyboard && !cookieBanner;
      setVisible((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(evaluate);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // Banner de cookies que aparece/desaparece.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    vv?.addEventListener("resize", schedule);
    mq.addEventListener("change", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mo.disconnect();
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      vv?.removeEventListener("resize", schedule);
      mq.removeEventListener("change", schedule);
    };
  }, [anchorRef]);

  // WhatsApp por encima de la barra mientras esté visible.
  useEffect(() => {
    if (!visible) {
      setWhatsAppContext({ offset: 0 });
      return;
    }
    const h = barRef.current?.getBoundingClientRect().height || 0;
    setWhatsAppContext({ offset: Math.round(h) + 8 });
    return () => setWhatsAppContext({ offset: 0 });
  }, [visible]);

  return (
    <div
      ref={barRef}
      className={`pdp-buybar${visible ? " is-visible" : ""}`}
      role="region"
      aria-label="Compra rápida"
      aria-hidden={visible ? undefined : "true"}
      inert={visible ? undefined : true}
    >
      <div className="pdp-buybar__info">
        <p className="pdp-buybar__name">{productName}</p>
        <p className="pdp-buybar__meta">
          <span className="pdp-buybar__price">{priceLabel}</span>
          {status ? (
            <span className={`pdp-buybar__status${status.kind === "error" ? " is-error" : ""}`}>
              {status.kind === "success" ? "Agregado al carrito" : "Sin más unidades"}
            </span>
          ) : summary ? (
            <span className="pdp-buybar__summary">{summary}</span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        className="pdp-buybar__btn"
        disabled={ctaDisabled && !needsSelection}
        onClick={needsSelection ? onChoose : onAdd}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
