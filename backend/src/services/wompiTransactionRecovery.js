const PaymentEvent = require("../models/paymentEvent");
const AppError = require("../utils/AppError");
const wompi = require("./wompiService");

const validId = id => typeof id === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(id);
exports.validId = validId;

// These are lookup candidates, never proof of payment. Every candidate must
// still pass the private provider query and the existing payment processor.
exports.knownTransactionIds = async order => {
  const links = [{ order: order._id }];
  if (order.wompi?.paymentLinkId) links.push(
    { paymentLinkId: order.wompi.paymentLinkId },
    { "providerObservation.paymentLinkId": order.wompi.paymentLinkId }
  );
  const rows = await PaymentEvent.aggregate([
    { $match: { environment: wompi.getExpectedEventEnvironment(), $or: links } },
    { $group: { _id: "$transactionId" } },
    { $sort: { _id: 1 } }, { $limit: 21 },
  ]);
  const ids = [...new Set([order.wompi?.transactionId, ...rows.map(row => row._id)].filter(validId))];
  if (ids.length > 20) throw new AppError("Hay demasiados intentos de pago para una verificación automática. Solicita revisión de soporte.", 409);
  if (!ids.length) throw new AppError("Aún no hemos recibido la transacción de Wompi. Espera la notificación del pago y vuelve a verificar. No necesitas copiar ningún código.", 409);
  return ids;
};

exports.verifyReturn = async (order, transactionId) => {
  if (order.paymentMethod !== "wompi" || !validId(transactionId)) throw new AppError("Retorno de pago inválido", 409);
  const tx = await wompi.getTransaction(transactionId);
  // The browser can supply any ID. Reject a foreign link before writing any
  // financial evidence or incident for the requested order.
  if (!order.wompi?.paymentLinkId || tx.payment_link_id !== order.wompi.paymentLinkId) {
    throw new AppError("La transacción no corresponde a este pedido", 409);
  }
  const receipt = await require("./wompiPaymentService").processTransaction(order._id, tx, {
    environment: wompi.getExpectedEventEnvironment(), reconcile: true,
  });
  if (!receipt?.processedAt) throw new AppError("Verificación de pago pendiente", 503);
};
