// Plazos de entrega informados ANTES de concluir la compra (H-19, H-21).
//
// ESTADO: "pending_definition". El negocio aportó referencias (productos
// disponibles: 4 a 6 días hábiles; por encargo: aproximadamente 15 días
// hábiles), pero no está definido si cubren preparación, despacho o entrega
// total, ni cuándo empieza el cómputo. Publicar esas cifras sería una
// promesa ambigua; por eso NO se muestran ni se registran todavía.
//
// Para activarlo: completar `text` con la redacción confirmada (incluido el
// punto de inicio del cómputo para Wompi y para contraentrega), poner
// status "defined" y SUBIR la versión. El checkout lo mostrará antes de
// confirmar y el pedido guardará una copia (Order.deliveryTerms).
const DELIVERY_TERMS = Object.freeze({
  version: null,
  status: "pending_definition", // "pending_definition" | "defined"
  text: "",
});

const getPublicDeliveryTerms = () =>
  DELIVERY_TERMS.status === "defined" && DELIVERY_TERMS.text
    ? { version: DELIVERY_TERMS.version, text: DELIVERY_TERMS.text }
    : null;

module.exports = { DELIVERY_TERMS, getPublicDeliveryTerms };
