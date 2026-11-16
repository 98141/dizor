"use client";

import {
  acceptAllPreferences,
  openConsentPanel,
  rejectAllPreferences,
  usePreferences,
} from "@/lib/consentPreferences";
import { isAnalyticsConfigured } from "@/lib/analytics/config";

// Franja discreta, no un modal a pantalla completa. Desaparece en cuanto
// existe una decisión guardada (aceptar, rechazar o configurar) y no vuelve
// a mostrarse salvo que el usuario retire su consentimiento desde el
// enlace "Configurar cookies" del footer.
export default function CookieConsentBanner() {
  const preferences = usePreferences();

  if (preferences != null) return null;
  // Sin ninguna tecnología opcional configurada no hay nada que aceptar ni
  // rechazar: no se muestra un banner "por costumbre" (H-09). El almacenamiento
  // necesario se informa en la Política de Cookies.
  if (!isAnalyticsConfigured()) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Aviso de cookies">
      <p className="cookie-banner__text">
        Usamos cookies necesarias para que la tienda funcione y, solo con tu
        permiso, cookies analíticas para entender cómo se usa el sitio.{" "}
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
