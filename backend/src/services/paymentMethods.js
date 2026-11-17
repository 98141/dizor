// Medios de pago habilitados (decisión del negocio, 2026-11-16):
// solo Wompi y contraentrega. La integración propia de Nequi (cobro directo
// y transferencia manual) queda DESACTIVADA; su código se conserva inactivo.
//
// El backend decide; el frontend solo muestra lo que devuelve
// getEnabledPaymentMethods(). Cualquier otro método se rechaza al crear el
// pedido, aunque lo envíe un cliente antiguo o manipulado.
const { isWompiConfigured } = require("./wompiService");
const { isNequiDirectEnabled, isNequiManualEnabled } = require("./nequiPaymentService");

const getEnabledPaymentMethods = () => [
  ...(isWompiConfigured()
    ? [{ id: "wompi", label: "Tarjeta, PSE y otros medios (Wompi)", description: "Pago en línea a través de Wompi" }]
    : []),
  { id: "contra_entrega", label: "Pago contra entrega", description: "Pagas al recibir tu pedido" },
  ...(isNequiDirectEnabled()
    ? [{ id: "nequi_api", label: "Nequi (pago directo)", description: "Aprueba el pago en tu app Nequi" }]
    : []),
  ...(isNequiManualEnabled()
    ? [{ id: "nequi_manual", label: "Nequi (transferencia manual)", description: "Envía comprobante" }]
    : []),
];

const isPaymentMethodEnabled = (method) =>
  getEnabledPaymentMethods().some((m) => m.id === method);

module.exports = { getEnabledPaymentMethods, isPaymentMethodEnabled };
