"use client";

import { openConsentPanel } from "@/lib/consentPreferences";

// Client leaf mínimo (mismo patrón que TrackedWhatsAppLink) para poder usar
// onClick dentro de SiteFooter.jsx, que es Server Component. Reabre el
// panel de preferencias — es la única forma de retirar/cambiar el
// consentimiento una vez cerrado el banner inicial.
export default function CookieSettingsLink({ className = "site-footer__link-btn" }) {
  return (
    <button type="button" className={className} onClick={() => openConsentPanel()}>
      Configurar cookies
    </button>
  );
}
