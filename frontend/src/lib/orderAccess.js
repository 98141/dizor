// Token de acceso a la confirmación del pedido (H-06).
//
// Sustituye al correo y al nombre en la URL y en sessionStorage. Se guarda
// solo en sessionStorage (se borra al cerrar la pestaña) y únicamente para
// el pedido recién creado. El servidor guarda solo su hash y lo caduca.
const KEY = "dizor_order_access";

// Claves antiguas que contenían datos personales (correo y nombre).
const LEGACY_KEYS = ["dizor_guest_email", "dizor_guest_name"];

export function saveOrderAccess(orderNumber, token) {
  if (typeof window === "undefined" || !orderNumber || !token) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ orderNumber, token }));
  } catch {
    // sessionStorage no disponible: la confirmación mostrará el modo limitado
  }
}

export function readOrderAccess(orderNumber) {
  if (typeof window === "undefined" || !orderNumber) return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
    return parsed?.orderNumber === orderNumber ? parsed.token : null;
  } catch {
    return null;
  }
}

export function clearOrderAccess() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignorar
  }
}

// Limpia datos personales dejados por versiones anteriores del sitio.
export function clearLegacyGuestData() {
  if (typeof window === "undefined") return;
  try {
    LEGACY_KEYS.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // ignorar
  }
}

export function confirmationPath(orderNumber) {
  return `/pedido/confirmacion?order=${encodeURIComponent(orderNumber)}`;
}
