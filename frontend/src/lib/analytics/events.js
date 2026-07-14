import { GA_MEASUREMENT_ID, isAnalyticsConfigured, ANALYTICS_DEBUG } from "./config";
import { hasAnalyticsConsent } from "./consent";
import { sanitizeParams, toSafeNumber, toSafeString } from "./sanitize";

// Único punto del proyecto que debe tocar window.gtag. Ningún componente
// debe llamar window.gtag(...) directamente — usar las funciones nombradas
// de este archivo.
export function trackEvent(eventName, params = {}) {
  try {
    if (typeof window === "undefined") return;
    if (!isAnalyticsConfigured()) return;
    if (!hasAnalyticsConsent()) {
      if (ANALYTICS_DEBUG) {
        console.info("[analytics:consent-denied]", eventName, params);
      }
      return;
    }
    if (typeof window.gtag !== "function") return;

    const clean = sanitizeParams(params);
    if (ANALYTICS_DEBUG) {
      console.info("[analytics:send]", eventName, clean);
    }
    window.gtag("event", eventName, clean);
  } catch {
    // Un fallo de analítica nunca debe interrumpir la acción del usuario.
  }
}

// Llamado únicamente por AnalyticsTracker para inicializar gtag/dataLayer.
export function initGtag() {
  try {
    if (typeof window === "undefined") return;
    if (!isAnalyticsConfigured()) return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
    window.gtag("js", new Date());
    // send_page_view: false — el page_view lo controla AnalyticsTracker de
    // forma explícita (con saneo de ruta/params y exclusión de rutas
    // privadas), para no depender del auto-tracking de Enhanced Measurement.
    window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  } catch {
    // no bloquear el render de la app si gtag falla al inicializar
  }
}

// Cola local + señal de consentimiento por defecto (Google Consent Mode v2).
// Se llama SIEMPRE que hay un ID de GA4 configurado, independientemente del
// consentimiento — es 100% local (solo arma el array `dataLayer` en
// memoria), nunca carga el script remoto ni contacta a Google, así que no
// compromete la política de "sin consentimiento no hay contacto con
// Google" ya establecida en initGtag()/AnalyticsTracker (Sprint 3).
export function initConsentDefaults() {
  try {
    if (typeof window === "undefined") return;
    if (!isAnalyticsConfigured()) return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
  } catch {
    // no bloquear el render de la app si gtag falla al inicializar
  }
}

// Empuja la señal de actualización de Consent Mode v2 cada vez que cambia
// el consentimiento (otorgar o retirar). ad_storage/ad_user_data/
// ad_personalization NUNCA se conceden aquí: no existe ninguna integración
// de anuncios/remarketing en el proyecto (Sprint 4 explícitamente no la
// implementa), solo analytics_storage puede pasar a "granted".
export function updateConsentSignal(analyticsGranted) {
  try {
    if (typeof window === "undefined") return;
    if (!isAnalyticsConfigured()) return;
    if (typeof window.gtag !== "function") return;
    window.gtag("consent", "update", {
      analytics_storage: analyticsGranted ? "granted" : "denied",
    });
  } catch {
    // no bloquear
  }
}

export function trackPageView({ pagePath, pageTitle }) {
  trackEvent("page_view", {
    page_path: toSafeString(pagePath, 300),
    page_title: toSafeString(pageTitle),
  });
}

export function trackViewItem({ items, value, currency = "COP" }) {
  trackEvent("view_item", { currency, value: toSafeNumber(value), items });
}

export function trackViewItemList({ items, itemListId, itemListName }) {
  if (!items?.length) return;
  trackEvent("view_item_list", {
    item_list_id: toSafeString(itemListId),
    item_list_name: toSafeString(itemListName),
    items,
  });
}

export function trackSelectItem({ items, itemListId, itemListName }) {
  trackEvent("select_item", {
    item_list_id: toSafeString(itemListId),
    item_list_name: toSafeString(itemListName),
    items,
  });
}

export function trackAddToCart({ items, value, currency = "COP" }) {
  trackEvent("add_to_cart", { currency, value: toSafeNumber(value), items });
}

export function trackRemoveFromCart({ items, value, currency = "COP" }) {
  trackEvent("remove_from_cart", { currency, value: toSafeNumber(value), items });
}

export function trackViewCart({ items, value, currency = "COP" }) {
  trackEvent("view_cart", { currency, value: toSafeNumber(value), items });
}

export function trackBeginCheckout({ items, value, coupon, currency = "COP" }) {
  trackEvent("begin_checkout", {
    currency,
    value: toSafeNumber(value),
    coupon: toSafeString(coupon),
    items,
  });
}

export function trackAddShippingInfo({ items, value, shippingTier, currency = "COP" }) {
  trackEvent("add_shipping_info", {
    currency,
    value: toSafeNumber(value),
    shipping_tier: toSafeString(shippingTier),
    items,
  });
}

export function trackAddPaymentInfo({ items, value, paymentType, currency = "COP" }) {
  trackEvent("add_payment_info", {
    currency,
    value: toSafeNumber(value),
    payment_type: toSafeString(paymentType),
    items,
  });
}

export function trackPurchase({
  transactionId,
  items,
  value,
  tax,
  shipping,
  coupon,
  currency = "COP",
}) {
  trackEvent("purchase", {
    transaction_id: toSafeString(transactionId),
    currency,
    value: toSafeNumber(value),
    tax: toSafeNumber(tax),
    shipping: toSafeNumber(shipping),
    coupon: toSafeString(coupon),
    items,
  });
}

export function trackSearch(searchTerm) {
  const term = toSafeString(searchTerm);
  if (!term) return;
  trackEvent("search", { search_term: term });
}

export function trackCatalogFilter({ filterName, filterValue, resultsCount }) {
  trackEvent("filter_catalog", {
    filter_name: toSafeString(filterName),
    filter_value: toSafeString(filterValue),
    results_count: toSafeNumber(resultsCount),
  });
}

export function trackWhatsAppClick({ linkLocation, purpose, productId, productName }) {
  trackEvent("whatsapp_click", {
    link_location: toSafeString(linkLocation),
    purpose: toSafeString(purpose),
    product_id: toSafeString(productId),
    product_name: toSafeString(productName),
    page_path:
      typeof window !== "undefined" ? toSafeString(window.location.pathname, 300) : undefined,
  });
}

export function trackCustomizationRequest({ productId, sourcePage }) {
  trackEvent("customization_request", {
    request_type: "customization",
    product_id: toSafeString(productId),
    source_page: toSafeString(sourcePage),
  });
}

export function trackWholesaleRequest({ sourcePage, quantityRange }) {
  trackEvent("wholesale_request", {
    request_type: "wholesale",
    source_page: toSafeString(sourcePage),
    quantity_range: toSafeString(quantityRange),
  });
}
