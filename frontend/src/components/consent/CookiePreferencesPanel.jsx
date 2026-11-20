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
import { getOptionalCategories } from "@/lib/optionalTechnologies";

// Panel de preferencias. Las categorías opcionales salen del inventario
// central (lib/optionalTechnologies.js): solo las activas se pueden marcar.
const draftFrom = (preferences) => ({
  statistics: Boolean(preferences?.statistics),
  analytics: Boolean(preferences?.analytics),
});

export default function CookiePreferencesPanel() {
  const isOpen = useConsentPanelOpen();
  const preferences = usePreferences();
  const [draft, setDraft] = useState(() => draftFrom(preferences));

  // Sincroniza el borrador con la última decisión guardada cada vez que el
  // panel pasa de cerrado a abierto (patrón de React "adjusting state on prop
  // change", sin efecto).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setDraft(draftFrom(preferences));
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

  const categories = getOptionalCategories();

  const handleSave = () => {
    savePreferences(draft);
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
          Elige qué categorías quieres permitir. Puedes cambiar tu
          decisión cuando quieras desde &quot;Configurar cookies&quot; en el
          pie de página.
        </p>

        <div className="cookie-category">
          <div className="cookie-category__info">
            <p className="cookie-category__title">Necesarias</p>
            <p className="cookie-category__desc">
              Imprescindibles para el funcionamiento del sitio: carrito de
              compras, sesión, confirmación del pedido y esta misma
              preferencia. No se pueden desactivar.
            </p>
          </div>
          <label className="cookie-toggle">
            <input type="checkbox" checked disabled readOnly aria-label="Necesarias (siempre activas)" />
            <span className="cookie-toggle__track" />
          </label>
        </div>

        {categories.map((c) => {
          const selectable = c.active && c.id in draft;
          return (
            <div className="cookie-category" key={c.id}>
              <div className="cookie-category__info">
                <p className="cookie-category__title">{c.title}</p>
                <p className="cookie-category__desc">{c.description}</p>
                {!c.active && c.inactiveNote && (
                  <p className="cookie-category__note">{c.inactiveNote}</p>
                )}
              </div>
              <label className="cookie-toggle">
                <input
                  type="checkbox"
                  aria-label={c.title}
                  data-category={c.id}
                  checked={selectable ? draft[c.id] : false}
                  disabled={!selectable}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [c.id]: e.target.checked }))
                  }
                />
                <span className="cookie-toggle__track" />
              </label>
            </div>
          );
        })}

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
