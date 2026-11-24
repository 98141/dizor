const AppError = require("../utils/AppError");
const PaymentEvent = require("../models/paymentEvent");
const service = require("./wompiService");
const payments = require("./wompiPaymentService");

const review = (message, status = 409) => Object.assign(new AppError(message, status), { recoveryReview: true });

async function closeOriginal(eventId, completedId, orderId, tx) {
  await require("./transactionService").inTransaction(async session => {
    const original = await PaymentEvent.findById(eventId).session(session);
    const verified = await PaymentEvent.findById(completedId).session(session);
    if (!original || !verified?.processedAt || verified.processingState !== "processed"
        || original.transactionId !== tx.id || verified.transactionId !== tx.id || verified.environment !== original.environment
        || String(verified.order) !== String(orderId)) throw new AppError("Procesamiento del recibo aún no verificable", 503);
    if (original.administrativeArchive?.active) throw review("Evento archivado; recuperación suspendida");
    original.processedAt ||= new Date(); original.processingState = "processed";
    if (String(original._id) !== String(verified._id)) {
      if (original.associationError !== "provider_binding_mismatch") original.associationError = "superseded_by_provider_state";
      original.lastError = `Sustituido por recibo ${verified._id}: ${verified.status}`;
    } else original.lastError = "";
    await original.save({ session });
  });
}

// Shared by the administrator and the recovery worker. Original receipt
// identity, timestamp and contradictory evidence remain intact.
exports.reprocess = async (eventId, { automatic = false } = {}) => {
  const event = await PaymentEvent.findById(eventId);
  if (!event) throw review("Evento no encontrado", 404);
  if (event.administrativeArchive?.active) throw review("Reabre el evento antes de reprocesarlo");
  if (event.environment !== service.getExpectedEventEnvironment()) throw review("Evento de otro ambiente");

  // A previously validated signed VOIDED of the applied charge must still
  // block fulfillment when the private API is unavailable or temporarily stale.
  if (automatic && event.source === "webhook" && event.checksum && event.status === "VOIDED") {
    const signed = { id: event.transactionId, status: event.status, amount_in_cents: event.amountInCents,
      currency: event.currency, payment_link_id: event.paymentLinkId, reference: event.reference };
    const association = await payments.findAssociation(signed);
    if (association.appliedVoid) {
      const completed = await payments.processTransaction(null, signed, { environment: event.environment,
        checksum: event.checksum, timestamp: event.providerTimestamp });
      if (!completed?.processedAt) throw new AppError("Aplicación de anulación pendiente", 503);
      await closeOriginal(event._id, completed._id, association.order._id, signed);
      return { providerStatus: "VOIDED" };
    }
  }

  let tx;
  try { tx = await service.getTransaction(event.transactionId); }
  catch { throw new AppError("Consulta Wompi no disponible; evidencia conservada", 503); }
  if (tx.id !== event.transactionId) throw review("La consulta no corresponde al recibo original");
  if (!payments.canAdvanceTransactionStatus(event.status, tx.status) || event.amountInCents !== tx.amount_in_cents) {
    await payments.deferProviderDiscrepancy(event._id, tx);
    // A stale PENDING query may catch up. A contradictory terminal observation
    // needs an explicit administrative decision; never auto-archive it.
    const error = new AppError("Estado o importe consultado discrepante; recibo conservado para recuperación", 503);
    error.recoveryReview = tx.status !== "PENDING";
    throw error;
  }
  if (automatic && (event.associationError === "provider_binding_mismatch"
      || (event.currency && event.currency !== tx.currency)
      || (event.paymentLinkId && event.paymentLinkId !== tx.payment_link_id))) {
    await payments.deferProviderDiscrepancy(event._id, tx, "Vínculo o moneda contradictorios; revisión administrativa requerida");
    throw review("La evidencia contradictoria requiere revisión administrativa");
  }
  const association = await payments.findAssociation(tx);
  if (!association.order) throw new AppError("Wompi aún no aporta asociación inequívoca", 409);
  if (event.order && String(event.order) !== String(association.order._id)) throw review("La consulta corresponde a otro pedido");
  // Recheck archive after the network round trip.
  if (await PaymentEvent.exists({ _id: event._id, "administrativeArchive.active": true })) throw review("Evento archivado; recuperación suspendida");
  const completed = await payments.processTransaction(association.order._id, tx, { environment: event.environment, reconcile: true });
  if (!completed?.processedAt) throw new AppError("El reproceso no se ha completado", 503);
  await closeOriginal(event._id, completed._id, association.order._id, tx);
  return { providerStatus: tx.status, orderId: association.order._id, receiptId: completed._id };
};
