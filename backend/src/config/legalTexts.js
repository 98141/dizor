// Fuente única de los textos de aviso/autorización que se muestran junto a
// los formularios y de su versión. El servidor —nunca el cliente— decide qué
// versión queda registrada como evidencia (ver services/consentService.js).
//
// Estados de un texto:
//   - "draft": versión de trabajo de la fase 1 (se mostraba con la marca
//     "Texto en revisión"). Lo registrado con ella NO cuenta como
//     autorización comercial y NO se regulariza retroactivamente.
//   - "published": redacción definitiva preparada con los datos confirmados
//     por el propietario (2026-11-16), apta para mostrarse sin marcas. La
//     revisión jurídica externa sigue pendiente (`legalReview: "pending"`,
//     ver docs/auditoria-privacidad/07-guia-revision-juridica.md). No se
//     muestra al público como "pendiente": es el texto que el titular ve.
//   - "approved": confirmado tras la revisión jurídica.
//   - "missing": no existe texto (no se muestra casilla ni se registra nada).
//
// Reglas de versión:
//   - La versión identifica el texto EXACTO que vio el titular. Si cambia una
//     sola palabra, se SUBE la versión.
//   - Pasar de "published" a "approved" sin cambiar el texto no exige nueva
//     versión; la evidencia previa conserva el estado con que se registró.
//   - El texto que se muestra y el que se registra salen de este archivo; los
//     formularios del frontend los reciben de /api/consents/notices.

const { BUSINESS } = require("./businessInfo");

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

const RESPONSIBLE = `${BUSINESS.legalName} (${BUSINESS.brand})`;

const TEXTS = Object.freeze({
  [PURPOSES.ORDER_PROCESSING]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: true,
    label:
      `Autorizo a ${RESPONSIBLE} a tratar mis datos de identificación y contacto (nombre, correo, teléfono y dirección) para gestionar mi pedido: confirmación, pago, facturación, envío, atención, garantía y solicitudes relacionadas, conforme a la Política de Tratamiento de Datos Personales.`,
  },
  [PURPOSES.ACCOUNT]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: true,
    label:
      `Autorizo a ${RESPONSIBLE} a tratar mis datos para crear y administrar mi cuenta (inicio de sesión, direcciones, historial de pedidos y favoritos), conforme a la Política de Tratamiento de Datos Personales.`,
  },
  [PURPOSES.SPECIAL_REQUEST]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: true,
    label:
      `Autorizo a ${RESPONSIBLE} a tratar mis datos de contacto y la información de mi solicitud para responderla y cotizarla, conforme a la Política de Tratamiento de Datos Personales.`,
  },
  [PURPOSES.REVIEW_PUBLICATION]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: true,
    label:
      "Autorizo que, si mi reseña se aprueba, se publiquen en este sitio el nombre que indique, la ciudad (si la indico), la calificación y el comentario. No se publican fotografías mías sin una autorización aparte.",
  },
  [PURPOSES.CUSTOMER_REQUEST]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: true,
    label:
      `Autorizo a ${RESPONSIBLE} a tratar mis datos para registrar, tramitar y responder esta solicitud, conforme a la Política de Tratamiento de Datos Personales.`,
  },
  [PURPOSES.MARKETING_NEWSLETTER]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: false,
    label:
      `Quiero recibir por correo electrónico novedades y ofertas de ${BUSINESS.brand}. Es opcional, no condiciona ninguna compra y puedo darme de baja en cualquier momento desde el enlace incluido en cada correo.`,
  },
  [PURPOSES.MARKETING_CART_REMINDER]: {
    version: "2",
    status: "published",
    legalReview: "pending",
    required: false,
    label:
      `Quiero recibir por correo electrónico un recordatorio de los productos de este carrito. Es opcional y puedo darme de baja desde el enlace incluido en el correo.`,
  },
  [PURPOSES.TERMS]: {
    version: "1",
    status: "published",
    legalReview: "pending",
    required: true,
    path: TERMS_PATH,
    label:
      "He leído y acepto los Términos y condiciones de compra, incluida la información sobre garantía, derecho de retracto, reversión del pago y cambios.",
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
