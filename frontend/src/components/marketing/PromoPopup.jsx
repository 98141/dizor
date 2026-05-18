"use client";

import { useEffect, useState } from "react";
import { getMarketingConfig } from "@/services/marketingService";
import NewsletterSignup from "./NewsletterSignup";

const STORAGE_KEY = "dizor_promo_popup_seen";

export default function PromoPopup() {
  const [config, setConfig] = useState(null);
  const [open, setOpen] = useState(false);

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

  const close = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
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
        {popup.showNewsletterForm !== false ? (
          <NewsletterSignup
            title=""
            description=""
            source="popup"
            compact
            successMessage={config.newsletter?.successMessage}
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
