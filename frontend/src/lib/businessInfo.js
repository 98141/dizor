// Identificación del vendedor (confirmada por el propietario, 2026-11-16).
// Espejo de backend/src/config/businessInfo.js: si cambia un dato, cambiarlo
// en ambos. "DIZOR" es la marca; vende y factura la sociedad.
import { WHATSAPP_NUMBER } from "./whatsapp";

export const BUSINESS = Object.freeze({
  brand: "DIZOR",
  legalName: "COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS",
  nit: "901.027.825-5",
  // Domicilio registrado en el RUT. No es necesariamente punto de recogida,
  // bodega ni dirección para devoluciones.
  registeredAddress: "CR 5 02 50 BRR NARANJAL, Sandoná, Nariño, Colombia",
  email: "dizorsandona@gmail.com",
  whatsapp: WHATSAPP_NUMBER,
  whatsappDisplay: "+57 315 916 2520",
  attentionHours: "lunes a viernes, en horario laboral",
  country: "Colombia",
});

// Versión vigente de los documentos públicos (coincide con
// backend/src/config/legalTexts.js para los textos de formularios). La fecha
// de entrada en vigor se fija al publicar (NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE);
// si no está definida no se muestra ninguna fecha.
export const LEGAL_DOCS = Object.freeze({
  privacy: { version: "4" },
  cookies: { version: "4" },
  terms: { version: "1" },
  guarantees: { version: "1" },
  shipping: { version: "1" },
});

export function getLegalEffectiveDate() {
  const raw = process.env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE;
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}
