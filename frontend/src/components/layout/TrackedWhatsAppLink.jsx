"use client";

import { trackWhatsAppClick } from "@/lib/analytics/events";

// Client leaf mínimo para poder reportar whatsapp_click desde componentes
// que en sí son Server Components (ej. SiteFooter). El enlace siempre se
// abre igual, con o sin analítica configurada/consentida.
export default function TrackedWhatsAppLink({
  href,
  children,
  className,
  linkLocation,
  purpose,
  productId,
  productName,
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => trackWhatsAppClick({ linkLocation, purpose, productId, productName })}
    >
      {children}
    </a>
  );
}
