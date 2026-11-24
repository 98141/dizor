const PaymentEvent = require("../models/paymentEvent");
const AppError = require("../utils/AppError");
const wompi = require("./wompiService");

const validId = id => typeof id === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(id);
exports.validId = validId;

// These are lookup candidates, never proof of payment. Every candidate must
// still pass the private provider query and the existing payment processor.
exports.knownTransactionIds = async order => {
  await require("./wompiRecoveryWorker").recoverOrderReturn(order._id);
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
  if (!ids.length) {
    const review = await require("../models/wompiRecoveryTask").exists({ environment: wompi.getExpectedEventEnvironment(),
      order: order._id, kind: "buyer_return", status: "review" });
    if (review) throw new AppError("La verificación automática no se pudo completar y requiere revisión de soporte. El pedido conserva su estado; no vuelvas a cobrar al cliente.", 409);
    if (!require("./wompiRecoveryStatus").configuration().webhookUrl) {
      throw new AppError("DIZOR aún no tiene una transacción vinculada a este pedido. Este entorno no declara una URL pública para las notificaciones de Wompi; hay que configurar y comprobar esa conexión. Esperar o reiniciar no sustituye esa configuración. Esto no demuestra que el cliente no haya pagado. No necesitas copiar ningún código.", 409);
    }
    throw new AppError("Aún no hemos recibido la transacción de Wompi. Espera la notificación del pago y vuelve a verificar. No necesitas copiar ningún código.", 409);
  }
  return ids;
};

exports.verifyReturn = async (order, transactionId) => {
  if (order.paymentMethod !== "wompi" || !validId(transactionId)) throw new AppError("Retorno de pago inválido", 409);
  // Persist the lookup hint BEFORE asking Wompi. A timeout or a closed browser
  // must not lose the only transaction ID returned by the provider.
  const task = await require("./wompiRecoveryWorker").rememberReturn(order, transactionId);
  await require("./wompiRecoveryWorker").processOne({ taskId: task._id, force: true, throwOnError: true });
};

exports.verifyCandidate = async (order, transactionId) => {
  if (order.paymentMethod !== "wompi" || !validId(transactionId)) throw Object.assign(new AppError("Retorno de pago inválido", 409), { recoveryReview: true });
  let tx;
  try { tx = await wompi.getTransaction(transactionId); }
  catch (error) {
    if (error.code === "WOMPI_TRANSACTION_ID_INVALID") error.recoveryReject = true;
    throw error;
  }
  // The browser can supply any ID. Reject a foreign link before writing any
  // financial evidence or incident for the requested order.
  if (!order.wompi?.paymentLinkId || tx.payment_link_id !== order.wompi.paymentLinkId) {
    throw Object.assign(new AppError("La transacción no corresponde a este pedido", 409), { recoveryReject: true });
  }
  const receipt = await require("./wompiPaymentService").processTransaction(order._id, tx, {
    environment: wompi.getExpectedEventEnvironment(), reconcile: true,
  });
  if (!receipt?.processedAt) throw new AppError("Verificación de pago pendiente", 503);
  return { providerStatus: tx.status, orderId: order._id, receiptId: receipt._id };
};
