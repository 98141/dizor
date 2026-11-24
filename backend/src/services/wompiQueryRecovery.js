const PaymentEvent = require("../models/paymentEvent");
const { mutateOrder, history } = require("./orderOperations");

// Only technical query failures can be closed automatically, after a private
// observation for this order's own primary transaction has been processed.
// Financial, inventory and coupon incidents retain their existing decisions.
exports.resolve = async (orderId, receiptId) => {
  if (!await require("../models/order").exists({ _id: orderId,
    incidents: { $elemMatch: { code: "reconciliation_query_failed", resolvedAt: null } } })) return;
  return mutateOrder(orderId, async (order, session) => {
    const failures = order.incidents.filter(i => i.code === "reconciliation_query_failed" && !i.resolvedAt);
    if (!failures.length) return;
    const receipt = await PaymentEvent.findById(receiptId).session(session);
    const observation = receipt?.providerObservation;
    const expectedAmount = Math.round(order.total * 100);
    const privateProof = receipt?.source === "provider_query" || (observation?.checkedAt
      && observation.status === receipt.status && observation.paymentLinkId === order.wompi?.paymentLinkId
      && observation.amountInCents === expectedAmount && observation.currency === "COP");
    if (!privateProof || !receipt.processedAt || receipt.processingState !== "processed"
        || String(receipt.order) !== String(order._id) || receipt.environment !== require("./wompiService").getExpectedEventEnvironment()
        || receipt.transactionId !== order.wompi?.transactionId || receipt.amountInCents !== expectedAmount || receipt.currency !== "COP") return;
    const now = new Date();
    for (const incident of failures) {
      incident.resolvedAt = now;
      incident.resolution = { decision: "reconciled_with_provider", reason: "Consulta privada recuperada automáticamente",
        evidence: { transactionId: receipt.transactionId, recordedAt: now } };
    }
    order.requiresReview = order.incidents.some(i => !i.resolvedAt);
    history(order, `Fallos de consulta superados automáticamente: ${failures.length}. Transacción: ${receipt.transactionId}`);
    await require("../models/AuditLog").create([{ role: "system", action: "wompi_query_failures_resolved", module: "orders",
      entityId: order._id, entityType: "order", success: true, previousData: { incidents: failures.map(i => ({ id: i._id, detail: i.detail })) },
      newData: { transactionId: receipt.transactionId, receipt: receipt._id, status: receipt.status, automatic: true },
      summary: "Fallos técnicos de consulta superados con evidencia privada; incidencias financieras conservadas" }], { session });
  });
};
