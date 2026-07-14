const MAX_STRING_LENGTH = 100;

export function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function toSafeString(value, maxLength = MAX_STRING_LENGTH) {
  if (value == null) return undefined;
  const str = String(value);
  if (!str) return undefined;
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function isPlainSerializable(value) {
  const type = typeof value;
  if (type === "string" || type === "boolean") return true;
  if (type === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainSerializable);
  if (type === "object") {
    return Object.values(value).every(isPlainSerializable);
  }
  return false;
}

// Elimina claves con undefined/NaN/funciones/objetos no serializables antes
// de enviar cualquier payload a GA4. No transforma valores válidos.
export function sanitizeParams(params) {
  if (!params || typeof params !== "object") return {};
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    if (!isPlainSerializable(value)) continue;
    clean[key] = value;
  }
  return clean;
}
