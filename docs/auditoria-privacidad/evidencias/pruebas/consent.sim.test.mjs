// Prueba con ADAPTADORES SIMULADOS (no es una prueba en navegador real):
// window/localStorage/document.cookie falsos + gtag espía. Verifica la lógica
// de consentimiento del frontend (H-07, H-08, H-06, H-09).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const SRC = process.env.DIZOR_FRONTEND_SRC;
const requireFromFrontend = createRequire(`${SRC.replace(/\\/g, "/")}/../package.json`);
globalThis.__react = requireFromFrontend("react");

// ── Navegador simulado ─────────────────────────────────────────────────────
function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _map: m,
  };
}
const cookieJar = new Map();
const cookieWrites = [];
let reloads = 0;
let gtagScriptPresent = false;
const gtagCalls = [];

globalThis.window = {
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  location: {
    origin: "https://tienda.example.test",
    pathname: "/catalogo",
    search: "?category=x&email=persona%40example.test&term=sombrero",
    hostname: "tienda.example.test",
    reload: () => { reloads += 1; },
  },
};
globalThis.window.gtag = (...args) => gtagCalls.push(args);
globalThis.document = {
  get cookie() { return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; "); },
  set cookie(str) {
    cookieWrites.push(str);
    const [pair] = str.split(";");
    const [k, v] = pair.split("=");
    if (/expires=Thu, 01 Jan 1970/.test(str)) cookieJar.delete(k.trim());
    else cookieJar.set(k.trim(), v);
  },
  querySelector: (sel) => (sel.includes("googletagmanager") && gtagScriptPresent ? {} : null),
};

// Estado previo de una versión anterior: decisión v1 aceptando analítica y
// la clave antigua "granted".
window.localStorage.setItem("dizor_cookie_preferences", JSON.stringify({ analytics: true, version: "2" }));
window.localStorage.setItem("dizor_analytics_consent", "granted");

process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST000000";

const consent = await import("@/lib/analytics/consent");
const prefs = await import("@/lib/consentPreferences");
const events = await import("@/lib/analytics/events");
const sanitizer = await import("@/lib/analytics/urlSanitizer");

test("H-07: decisión de versión anterior + clave antigua 'granted' → analítica DENEGADA", () => {
  assert.equal(consent.hasAnalyticsConsent(), false);
  assert.equal(prefs.getStoredPreferences(), null, "el banner volverá a pedir decisión");
  assert.equal(window.localStorage.getItem("dizor_analytics_consent"), null, "clave antigua eliminada");
});

test("sin consentimiento no se envía ningún evento", () => {
  gtagCalls.length = 0;
  events.trackSearch("sombrero");
  assert.equal(gtagCalls.length, 0);
});

test("aceptar → consentimiento y registro versionado v3; eventos con page_location saneado", () => {
  prefs.acceptAllPreferences();
  assert.equal(consent.hasAnalyticsConsent(), true);
  const rec = JSON.parse(window.localStorage.getItem("dizor_cookie_preferences"));
  assert.equal(rec.version, "3");
  assert.equal(rec.analytics, true);

  gtagCalls.length = 0;
  events.trackSearch("sombrero");
  assert.equal(gtagCalls.length, 1);
  const params = gtagCalls[0][2];
  assert.equal(params.page_location, "https://tienda.example.test/catalogo?category=x&term=sombrero");
  assert.ok(!JSON.stringify(gtagCalls).includes("persona"), "el correo de la URL no llega a GA");
});

test("H-06/H-08: rutas excluidas no envían eventos", () => {
  window.location.pathname = "/pedido/confirmacion";
  window.location.search = "?order=DZ-1&email=persona%40example.test";
  gtagCalls.length = 0;
  events.trackSearch("x");
  assert.equal(gtagCalls.length, 0);
  assert.equal(sanitizer.sanitizedPageLocation(), null);
  window.location.pathname = "/catalogo";
  window.location.search = "";
});

test("H-08: retirar/rechazar borra cookies _ga* y marcas de compra, y recarga si gtag cargó", () => {
  cookieJar.set("_ga", "GA1.1.123");
  cookieJar.set("_ga_TEST000000", "GS1.1.456");
  cookieJar.set("otra_cookie", "se-conserva");
  window.localStorage.setItem("dizor_ga_purchase_fired_DZ-1", "1");
  window.localStorage.setItem("dizor_cart_v1", "[]");
  gtagScriptPresent = true;

  prefs.rejectAllPreferences();

  assert.equal(consent.hasAnalyticsConsent(), false);
  assert.ok(!cookieJar.has("_ga") && !cookieJar.has("_ga_TEST000000"), "cookies GA eliminadas");
  assert.ok(cookieJar.has("otra_cookie"), "no se borra todo indiscriminadamente");
  assert.equal(window.localStorage.getItem("dizor_ga_purchase_fired_DZ-1"), null);
  assert.equal(window.localStorage.getItem("dizor_cart_v1"), "[]", "el carrito se conserva");
  assert.equal(reloads, 1, "recarga para descargar gtag.js");
  assert.ok(cookieWrites.some((w) => w.includes("domain=.example.test")), "también en el dominio padre");
});

test("retirada completa vuelve a mostrar el banner", () => {
  prefs.acceptAllPreferences();
  prefs.withdrawConsent();
  assert.equal(prefs.getStoredPreferences(), null);
  assert.equal(consent.hasAnalyticsConsent(), false);
});
