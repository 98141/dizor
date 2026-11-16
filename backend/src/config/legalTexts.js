// Fuente única de los textos de aviso/autorización que se muestran junto a
// los formularios y de su versión. El servidor —nunca el cliente— decide qué
// versión queda registrada como evidencia (ver services/consentService.js).
//
// ESTADO: todos los textos están en "draft". Faltan datos del propietario
// (informe de auditoría 2026-11-16, sección E):
//   - E-1: identidad legal del responsable del tratamiento.
//   - E-2: canal oficial para ejercer derechos.
//   - E-5: finalidades que el negocio decide mantener.
// y revisión jurídica del texto final (sección F.3).
//
// Mientras un texto esté en "draft":
//   - Se puede mostrar y registrar en entornos locales/pruebas.
//   - La evidencia queda marcada con textStatus "draft": NO cuenta como
//     autorización válida (consentService la trata como evidencia
//     provisional).
//   - El plan de despliegue bloquea su publicación.
//
// Para aprobar un texto: completar el contenido definitivo, cambiar
// status a "approved" y SUBIR la versión. Nunca reutilizar una versión con
// un texto distinto: la versión identifica el texto exacto que vio el
// titular.

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

const TEXTS = Object.freeze({
  [PURPOSES.ORDER_PROCESSING]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: true,
    label:
      "Autorizo el tratamiento de mis datos (nombre, correo, teléfono y dirección) para gestionar mi pedido: confirmación, pago, envío, atención y garantía, conforme a la Política de Privacidad.",
    missing: ["E-1", "E-2", "revisión jurídica"],
  },
  [PURPOSES.ACCOUNT]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: true,
    label:
      "Autorizo el tratamiento de mis datos para crear y administrar mi cuenta (inicio de sesión, direcciones, historial de pedidos y favoritos), conforme a la Política de Privacidad.",
    missing: ["E-1", "E-2", "revisión jurídica"],
  },
  [PURPOSES.SPECIAL_REQUEST]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: true,
    label:
      "Autorizo el tratamiento de mis datos de contacto y de la información de mi solicitud para responderla y cotizarla, conforme a la Política de Privacidad.",
    missing: ["E-1", "E-2", "revisión jurídica"],
  },
  [PURPOSES.REVIEW_PUBLICATION]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: true,
    label:
      "Entiendo que, si mi reseña se aprueba, se publicarán el nombre visible, la ciudad (si la indico), la calificación y el comentario, y autorizo esa publicación.",
    missing: ["E-1", "E-5", "revisión jurídica"],
  },
  [PURPOSES.CUSTOMER_REQUEST]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: true,
    label:
      "Autorizo el tratamiento de mis datos para registrar, tramitar y responder esta solicitud, conforme a la Política de Privacidad.",
    missing: ["E-1", "E-2", "revisión jurídica"],
  },
  [PURPOSES.MARKETING_NEWSLETTER]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: false,
    label:
      "Quiero recibir por correo novedades y ofertas. Es opcional y puedo darme de baja en cualquier momento desde el enlace incluido en cada correo.",
    missing: ["E-1", "E-5", "E-8", "revisión jurídica (Ley 2300/2023)"],
  },
  [PURPOSES.MARKETING_CART_REMINDER]: {
    version: "2026-11-16-draft-1",
    status: "draft",
    required: false,
    label:
      "Quiero recibir por correo un recordatorio de los productos de este carrito. Es opcional y puedo darme de baja desde el enlace incluido en el correo.",
    missing: ["E-1", "E-5", "E-8", "revisión jurídica (Ley 2300/2023)"],
  },
  [PURPOSES.TERMS]: {
    // No existen términos y condiciones aprobados (H-17). Sin texto no se
    // muestra casilla ni se registra aceptación.
    version: null,
    status: "missing",
    required: false,
    label: "",
    missing: ["E-1", "E-10", "revisión jurídica"],
  },
});

const getText = (purpose) => TEXTS[purpose] || null;

const isMarketingPurpose = (purpose) => MARKETING_PURPOSES.includes(purpose);

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
        policyPath: PRIVACY_POLICY_PATH,
      },
    ])
  );

module.exports = {
  PURPOSES,
  MARKETING_PURPOSES,
  TEXTS,
  getText,
  getPublicNotices,
  isMarketingPurpose,
};
