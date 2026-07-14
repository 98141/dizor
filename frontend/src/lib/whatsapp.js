// Origen único del número de WhatsApp comercial de Dizor.
// Antes había 3 valores hardcodeados distintos en el código (uno de ellos
// un placeholder de prueba); todo el sitio debe importar desde aquí.
export const WHATSAPP_NUMBER = "573159162520";

export function getWhatsAppUrl(message) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
