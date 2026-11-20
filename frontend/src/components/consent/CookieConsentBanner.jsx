"use client";

import {
  acceptAllPreferences,
  openConsentPanel,
  rejectAllPreferences,
  usePreferences,
} from "@/lib/consentPreferences";
import { isCategoryActive, hasActiveOptionalCategory } from "@/lib/optionalTechnologies";

// Franja discreta, no un modal a pantalla completa. Desaparece en cuanto
// existe una decisión guardada (aceptar, rechazar o configurar) y no vuelve
// a mostrarse salvo que el usuario retire su consentimiento desde el
// enlace "Configurar cookies" del footer.
export default function CookieConsentBanner() {
  const preferences = usePreferences();

  if (preferences != null) return null;
  // Se muestra si existe al menos una tecnología opcional activa según el
  // inventario central (no solo Google Analytics). Sin ninguna, no hay nada
  // que aceptar o rechazar y no se muestra "por costumbre" (H-09).
  if (!hasActiveOptionalCategory()) return null;

  const optionalParts = [
    isCategoryActive("statistics") && "un contador de visitas propio",
    isCategoryActive("analytics") && "cookies analíticas de Google Analytics",
  ].filter(Boolean);

  return (
    <div className="cookie-banner" role="region" aria-label="Aviso de cookies">
      <p className="cookie-banner__text">
        Usamos cookies necesarias y, si aceptas,{" "}
        {optionalParts.join(" y ")}.{" "}
        <a href="/politica-de-cookies">Política de cookies</a>
      </p>
      <div className="cookie-banner__actions">
        <button
          type="button"
          className="cookie-banner__btn"
          onClick={() => openConsentPanel()}
        >
          Configurar
        </button>
        <button
          type="button"
          className="cookie-banner__btn"
          onClick={() => rejectAllPreferences()}
        >
          Rechazar
        </button>
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--primary"
          onClick={() => acceptAllPreferences()}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
