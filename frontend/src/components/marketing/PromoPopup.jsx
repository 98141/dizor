"use client";

import { useEffect, useState } from "react";
import { getMarketingConfig } from "@/services/marketingService";
import NewsletterSignup from "./NewsletterSignup";
import { PENDING_POPUP_COUPON_KEY } from "@/context/CartContext";

const STORAGE_KEY = "dizor_promo_popup_seen";

export default function PromoPopup() {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMarketingConfig()
      .then((d) => setConfig(d.config))
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!config?.popup?.enabled) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const delay = (config.popup.delaySeconds ?? 4) * 1000;
    const timer = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(timer);
  }, [config]);

  // El código se deja "pendiente" en cuanto el popup con cupón se muestra,
  // para que el carrito lo aplique automáticamente al validarlo contra el backend.
  useEffect(() => {
    if (!open) return;
    if (config?.popup?.variant !== "coupon" || !config?.popup?.couponCode) return;
    if (typeof window === "undefined") return;
    localStorage.setItem(PENDING_POPUP_COUPON_KEY, config.popup.couponCode);
  }, [open, config]);

  const close = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const copyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible, el código sigue visible para copiar a mano */
    }
  };

  if (!open || !config?.popup?.enabled) return null;

  const popup = config.popup;

  return (
    <div className="promo-popup" role="dialog" aria-modal="true">
      <button
        type="button"
        className="promo-popup__backdrop"
        aria-label="Cerrar"
        onClick={close}
      />
      <div className="promo-popup__panel">
        <button type="button" className="promo-popup__close" onClick={close}>
          ×
        </button>
        {popup.imageUrl && (
          <img
            src={popup.imageUrl}
            alt=""
            className="promo-popup__image"
          />
        )}
        <h2 className="promo-popup__title">{popup.title}</h2>
        <p className="promo-popup__text">{popup.text}</p>
        {popup.variant === "coupon" && popup.couponCode ? (
          <>
            <div className="promo-popup__coupon">
              <span className="promo-popup__coupon-code">{popup.couponCode}</span>
              <button
                type="button"
                className="promo-popup__coupon-copy"
                onClick={() => copyCoupon(popup.couponCode)}
              >
                {copied ? "¡Copiado!" : "Copiar código"}
              </button>
            </div>
            <p className="promo-popup__coupon-hint">
              Se aplicará solo al llegar al carrito, o puedes pegarlo ahí manualmente.
            </p>
          </>
        ) : popup.variant === "info" ? (
          popup.ctaHref ? (
            <a href={popup.ctaHref} className="promo-popup__cta" onClick={close}>
              {popup.ctaLabel || "Ver más"}
            </a>
          ) : null
        ) : popup.showNewsletterForm !== false ? (
          <NewsletterSignup
            source="popup"
            compact
            successMessage={config.newsletter?.successMessage}
            onSuccess={close}
          />
        ) : popup.ctaHref ? (
          <a href={popup.ctaHref} className="promo-popup__cta" onClick={close}>
            {popup.ctaLabel || "Ver más"}
          </a>
        ) : null}
      </div>
    </div>
  );
}
