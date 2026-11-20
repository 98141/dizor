// Fuente única de los textos de aviso/autorización que se muestran junto a
// los formularios y de su versión. El servidor —nunca el cliente— decide qué
// versión queda registrada como evidencia (ver services/consentService.js).
//
// Estados de un texto:
//   - "draft": versión de trabajo de la fase 1 (se mostraba con la marca
//     "Texto en revisión"). Lo registrado con ella NO cuenta como
//     autorización comercial y NO se regulariza retroactivamente.
//   - "published": redacción definitiva con los datos confirmados por el
//     propietario, que la dio por vigente el 2026-11-20. Si más adelante
//     cambia, se edita aquí y se sube la versión.
//   - "approved": reservado por si se valida con asesoría externa.
//   - "missing": no existe texto (no se muestra casilla ni se registra nada).
//
// Reglas de versión:
//   - Textos cortos y directos (decisión del propietario, 2026-11-20); el
//     detalle y la razón social están en la política enlazada.
//   - La versión identifica el texto EXACTO que vio el titular. Si cambia una
//     sola palabra, se SUBE la versión.
//   - Pasar de "published" a "approved" sin cambiar el texto no exige nueva
//     versión; la evidencia previa conserva el estado con que se registró.
//   - El texto que se muestra y el que se registra salen de este archivo; los
//     formularios del frontend los reciben de /api/consents/notices.

const PURPOSES = Object.freeze({
  ORDER_PROCESSING: "order_processing",
  ACCOUNT: "account",
  SPECIAL_REQUEST: "special_request",
  REVIEW_PUBLICATION: "review_publication",
  CUSTOMER_REQUEST: "customer_request",
  MARKETING_NEWSLETTER: "marketing_newsletter",
  MARKETING_CART_REMINDER: "marketing_cart_reminder",
  TERMS: "terms",
});

const MARKETING_PURPOSES = Object.freeze([
  PURPOSES.MARKETING_NEWSLETTER,
  PURPOSES.MARKETING_CART_REMINDER,
]);

const PRIVACY_POLICY_PATH = "/politica-de-privacidad";
const TERMS_PATH = "/terminos-y-condiciones";

const TEXTS = Object.freeze({
  [PURPOSES.ORDER_PROCESSING]: {
    version: "3",
    status: "published",
    required: true,
    label: "Autorizo a DIZOR a usar mis datos para gestionar mi pedido.",
  },
  [PURPOSES.ACCOUNT]: {
    version: "3",
    status: "published",
    required: true,
    label: "Autorizo a DIZOR a usar mis datos para crear y administrar mi cuenta.",
  },
  [PURPOSES.SPECIAL_REQUEST]: {
    version: "3",
    status: "published",
    required: true,
    label: "Autorizo a DIZOR a usar mis datos para responder y cotizar mi solicitud.",
  },
  [PURPOSES.REVIEW_PUBLICATION]: {
    version: "3",
    status: "published",
    required: true,
    label: "Autorizo publicar mi nombre, ciudad, calificación y comentario si la reseña se aprueba.",
  },
  [PURPOSES.CUSTOMER_REQUEST]: {
    version: "3",
    status: "published",
    required: true,
    label: "Autorizo a DIZOR a usar mis datos para atender esta solicitud.",
  },
  [PURPOSES.MARKETING_NEWSLETTER]: {
    version: "4",
    status: "published",
    required: false,
    label: "Quiero recibir novedades y ofertas de DIZOR por correo.",
  },
  [PURPOSES.MARKETING_CART_REMINDER]: {
    version: "4",
    status: "published",
    required: false,
    label: "Quiero recibir un recordatorio de este carrito por correo.",
  },
  [PURPOSES.TERMS]: {
    version: "2",
    status: "published",
    required: true,
    path: TERMS_PATH,
    label: "Acepto los Términos y condiciones de compra.",
  },
});

// Versiones anteriores (solo referencia para interpretar la evidencia
// histórica; no se muestran ni se registran).
const HISTORY = Object.freeze({
  "2026-11-16-draft-1": {
    status: "draft",
    note: "Fase 1. Se mostraba con la marca 'Texto en revisión'. No cuenta como autorización comercial.",
  },
});

const getText = (purpose) => TEXTS[purpose] || null;

const isMarketingPurpose = (purpose) => MARKETING_PURPOSES.includes(purpose);

// Estados con los que un texto puede mostrarse al público sin marcas.
const PUBLISHABLE_STATUSES = Object.freeze(["published", "approved"]);

// Vista pública: solo lo que el formulario necesita para mostrarse.
const getPublicNotices = () =>
  Object.fromEntries(
    Object.entries(TEXTS).map(([purpose, t]) => [
      purpose,
      {
        version: t.version,
        status: t.status,
        required: t.required,
        label: t.label,
        policyPath: t.path || PRIVACY_POLICY_PATH,
      },
    ])
  );

module.exports = {
  PURPOSES,
  MARKETING_PURPOSES,
  PUBLISHABLE_STATUSES,
  PRIVACY_POLICY_PATH,
  TERMS_PATH,
  TEXTS,
  HISTORY,
  getText,
  getPublicNotices,
  isMarketingPurpose,
};
