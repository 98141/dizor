// Redacta valores sensibles de la query string antes de escribir URLs en
// logs (H-06). Aunque el frontend corregido ya no pone datos personales en
// URLs, clientes antiguos, enlaces guardados o terceros pueden seguir
// enviándolos: el log no debe conservarlos.
//
// Se conservan solo los parámetros de una lista permitida (filtros del
// catálogo, paginación); cualquier otro valor se sustituye por "[redactado]".

const ALLOWED_KEYS = new Set([
  "page",
  "limit",
  "sort",
  "category",
  "weaveType",
  "style",
  "size",
  "color",
  "featured",
  "isNew",
  "onPromotion",
  "minPrice",
  "maxPrice",
  "status",
  "type",
  "range",
  "period",
  "from",
  "to",
  "payment",
]);

const redactUrl = (rawUrl) => {
  if (typeof rawUrl !== "string") return rawUrl;
  const qIndex = rawUrl.indexOf("?");
  if (qIndex === -1) return rawUrl;
  const path = rawUrl.slice(0, qIndex);
  const query = rawUrl.slice(qIndex + 1);
  const redacted = query
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      const key = eq === -1 ? pair : pair.slice(0, eq);
      let decodedKey = key;
      try {
        decodedKey = decodeURIComponent(key);
      } catch {
        // clave mal codificada: se redacta
      }
      return ALLOWED_KEYS.has(decodedKey) ? pair : `${key}=[redactado]`;
    })
    .join("&");
  return `${path}?${redacted}`;
};

module.exports = { redactUrl };
