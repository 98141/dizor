// Registro único (y versionado) de la decisión sobre cookies/almacenamiento
// opcional (H-07). Antes existían dos claves independientes
// (`dizor_cookie_preferences` y `dizor_analytics_consent`); al subir la
// versión de la política solo se invalidaba la primera y la analítica seguía
// activa. Ahora la analítica se deriva SIEMPRE de este registro.
//
// Solo se guarda: decisión por categoría, fecha y versión. Ningún dato
// personal.

export const PREFERENCES_KEY = "dizor_cookie_preferences";
export const LEGACY_ANALYTICS_KEY = "dizor_analytics_consent";

// Subir este valor si cambia sustancialmente la política de cookies:
// invalida las decisiones guardadas, desactiva la analítica y vuelve a
// mostrar el banner.
// "3": se añade la categoría de estadísticas propias (contador de visitas).
export const CONSENT_VERSION = "3";

export function readValidRecord() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRecord(record) {
  if (typeof window === "undefined") return;
  try {
    if (record) {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(record));
    } else {
      window.localStorage.removeItem(PREFERENCES_KEY);
    }
  } catch {
    // localStorage no disponible (modo privado, cuotas, etc.) — no bloquear
  }
}

// La clave antigua ya no decide nada; se elimina para no dejar un estado
// "granted" huérfano.
export function removeLegacyKey() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_ANALYTICS_KEY);
  } catch {
    // ignorar
  }
}
