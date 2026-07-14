import { hasAnalyticsConsent } from "./consent";

// Deduplicación de `purchase` por orderNumber (persistente en localStorage,
// sobrevive recargas). Es una red de seguridad adicional: el disparo real
// de `purchase` ocurre en el momento de creación/confirmación del pedido
// (checkout/page.js), que solo se ejecuta una vez por pedido real — esto
// solo cubre el caso improbable de un reintento/reenvío del mismo pedido.
const FIRED_KEY_PREFIX = "dizor_ga_purchase_fired_";

export function hasPurchaseBeenTracked(orderNumber) {
  if (typeof window === "undefined" || !orderNumber) return true;
  try {
    return window.localStorage.getItem(`${FIRED_KEY_PREFIX}${orderNumber}`) === "1";
  } catch {
    // Si no se puede leer localStorage, es más seguro asumir "ya enviado"
    // (evitar un posible duplicado) que arriesgar un reenvío.
    return true;
  }
}

export function markPurchaseTracked(orderNumber) {
  if (typeof window === "undefined" || !orderNumber) return;
  // Sin consentimiento, trackEvent() ya no envía nada a GA4 — tampoco tiene
  // sentido escribir esta marca local (evita dejar rastro de analítica en
  // localStorage cuando el usuario rechazó analítica).
  if (!hasAnalyticsConsent()) return;
  try {
    window.localStorage.setItem(`${FIRED_KEY_PREFIX}${orderNumber}`, "1");
  } catch {
    // no bloquear el flujo si localStorage falla
  }
}
