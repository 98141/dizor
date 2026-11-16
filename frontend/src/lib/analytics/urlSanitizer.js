// Rutas privadas/administrativas o con identificadores sensibles: nunca se
// envía ningún evento de analítica desde ellas (H-08).
const EXCLUDED_PREFIXES = [
  "/admin",
  "/vendedor",
  "/restablecer",
  "/favoritos",
  "/cuenta",
  "/pedido",
  "/baja",
  "/pqr",
];

// Solo estos query params aportan valor analítico real (coinciden con el
// allowlist de filtros del catálogo). Cualquier otro param se descarta.
const ALLOWED_PARAM_KEYS = new Set([
  "term",
  "category",
  "weaveType",
  "style",
  "size",
  "color",
  "sort",
  "page",
  "featured",
  "isNew",
  "onPromotion",
  "minPrice",
  "maxPrice",
]);

// Defensa adicional: aunque una clave estuviera en el allowlist por error,
// nunca se envía un valor que "huela" a token/credencial.
const SENSITIVE_KEY_PATTERN = /token|code|key|signature|secret|password|auth/i;
const MAX_PARAM_VALUE_LENGTH = 60;

export function isExcludedPath(pathname) {
  if (!pathname) return false;
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Devuelve null si la ruta no debe reportarse (privada/administrativa), o
// la ruta+query saneada lista para enviar como page_path.
// URL completa saneada para `page_location` (H-06, H-08). gtag.js envía por
// defecto document.location completo; se sustituye por esta versión sin
// parámetros no permitidos. Devuelve null en rutas excluidas.
export function sanitizedPageLocation() {
  if (typeof window === "undefined") return null;
  const { origin, pathname, search } = window.location;
  const path = sanitizePageView(pathname, new URLSearchParams(search));
  return path ? `${origin}${path}` : null;
}

export function sanitizePageView(pathname, searchParams) {
  if (isExcludedPath(pathname)) return null;

  const cleanParams = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      if (!ALLOWED_PARAM_KEYS.has(key)) continue;
      if (SENSITIVE_KEY_PATTERN.test(key)) continue;
      if (!value || value.length > MAX_PARAM_VALUE_LENGTH) continue;
      cleanParams.set(key, value);
    }
  }

  const query = cleanParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
