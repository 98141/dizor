"use client";

import { useEffect, useState } from "react";
import {
  acceptAllPreferences,
  closeConsentPanel,
  rejectAllPreferences,
  savePreferences,
  useConsentPanelOpen,
  usePreferences,
} from "@/lib/consentPreferences";
import { isAnalyticsConfigured } from "@/lib/analytics/config";

export default function CookiePreferencesPanel() {
  const isOpen = useConsentPanelOpen();
  const preferences = usePreferences();
  const [analyticsDraft, setAnalyticsDraft] = useState(() => preferences?.analytics ?? false);

  // Sincroniza el borrador con la última decisión guardada cada vez que el
  // panel pasa de cerrado a abierto (para que "Configurar cookies" desde el
  // footer muestre lo que ya está activo, no valores en blanco). Ajustar
  // estado durante el render al detectar el cambio, en vez de en un efecto
  // (patrón recomendado por React para "adjusting state on prop change").
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setAnalyticsDraft(preferences?.analytics ?? false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const analyticsAvailable = isAnalyticsConfigured();

  const handleSave = () => {
    savePreferences({ analytics: analyticsDraft });
    closeConsentPanel();
  };

  const handleAcceptAll = () => {
    acceptAllPreferences();
    closeConsentPanel();
  };

  const handleRejectAll = () => {
    rejectAllPreferences();
    closeConsentPanel();
  };

  return (
    <div
      className="cookie-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Preferencias de cookies"
    >
      <button
        type="button"
        className="cookie-panel__backdrop"
        aria-label="Cerrar"
        onClick={() => closeConsentPanel()}
      />
      <div className="cookie-panel__panel">
        <button
          type="button"
          className="cookie-panel__close"
          onClick={() => closeConsentPanel()}
          aria-label="Cerrar"
        >
          ×
        </button>

        <h2 className="cookie-panel__title">Preferencias de cookies</h2>
        <p className="cookie-panel__intro">
          Elige qué categorías de cookies quieres permitir. Puedes cambiar tu
          decisión cuando quieras desde &quot;Configurar cookies&quot; en el
          pie de página.
        </p>

        <div className="cookie-category">
          <div className="cookie-category__info">
            <p className="cookie-category__title">Necesarias</p>
            <p className="cookie-category__desc">
              Imprescindibles para el funcionamiento del sitio: carrito de
              compras, sesión, checkout como invitado y esta misma
              preferencia de cookies. No se pueden desactivar.
            </p>
          </div>
          <label className="cookie-toggle">
            <input type="checkbox" checked disabled readOnly />
            <span className="cookie-toggle__track" />
          </label>
        </div>

        <div className="cookie-category">
          <div className="cookie-category__info">
            <p className="cookie-category__title">Analíticas</p>
            <p className="cookie-category__desc">
              Medirían cómo se usa el sitio (páginas vistas, productos
              populares) mediante Google Analytics, solo con tu permiso.
            </p>
            {!analyticsAvailable && (
              <p className="cookie-category__note">
                Actualmente no utilizamos cookies analíticas.
              </p>
            )}
          </div>
          <label className="cookie-toggle">
            <input
              type="checkbox"
              checked={analyticsAvailable && analyticsDraft}
              disabled={!analyticsAvailable}
              onChange={(e) => setAnalyticsDraft(e.target.checked)}
            />
            <span className="cookie-toggle__track" />
          </label>
        </div>

        <div className="cookie-category">
          <div className="cookie-category__info">
            <p className="cookie-category__title">Marketing</p>
            <p className="cookie-category__desc">
              Para anuncios personalizados y remarketing.
            </p>
            <p className="cookie-category__note">
              Aún no utilizamos cookies de marketing.
            </p>
          </div>
          <label className="cookie-toggle">
            <input type="checkbox" checked={false} disabled readOnly />
            <span className="cookie-toggle__track" />
          </label>
        </div>

        <div className="cookie-panel__actions">
          <button
            type="button"
            className="cookie-banner__btn"
            onClick={handleRejectAll}
          >
            Rechazar todo
          </button>
          <button
            type="button"
            className="cookie-banner__btn"
            onClick={handleSave}
          >
            Guardar preferencias
          </button>
          <button
            type="button"
            className="cookie-banner__btn cookie-banner__btn--primary"
            onClick={handleAcceptAll}
          >
            Aceptar todo
          </button>
        </div>
      </div>
    </div>
  );
}
