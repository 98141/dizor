const crypto = require("crypto");
const Order = require("../models/order");
const PaymentEvent = require("../models/paymentEvent");
const Coupon = require("../models/coupon");
const { inTransaction } = require("./transactionService");
const { moveStock } = require("./inventoryService");
const { addIncident, history } = require("./orderOperations");
const AppError = require("../utils/AppError");

// Payment Links generate reference themselves. No fallback to reference or sku.
exports.findAssociation = async (tx, session = null) => {
  if (tx.status === "VOIDED") {
    const applied = await Order.find({ paymentMethod: "wompi", "wompi.transactionId": tx.id }).limit(2).session(session);
    if (applied.length === 1) return { order: applied[0], appliedVoid: true };
    if (applied.length > 1) return { error: "ambiguous_transaction_identity" };
  }
  if (typeof tx.payment_link_id !== "string" || !tx.payment_link_id) return { error: "missing_payment_link" };
  const orders = await Order.find({ paymentMethod: "wompi", "wompi.paymentLinkId": tx.payment_link_id }).limit(2).session(session);
  if (orders.length !== 1) return { error: orders.length ? "ambiguous_payment_link" : "unknown_payment_link" };
  const order = orders[0];
  if (typeof tx.reference === "string" && tx.reference && await Order.exists({ orderNumber: tx.reference, _id: { $ne: order._id } }).session(session)) return { error: "contradictory_reference" };
  if (await PaymentEvent.exists({ environment: require("./wompiService").getExpectedEventEnvironment(), transactionId: tx.id,
    order: { $ne: null, $nin: [order._id] } }).session(session)) return { error: "transaction_already_associated" };
  return { order };
};

// Financial checks precede recognition; repeat under the order lock in both phases.
const recognize = async (order, tx, session) => {
  if (tx.payment_link_id !== order.wompi.paymentLinkId) throw new AppError("Vínculo Wompi inválido", 409);
  let blocked = false;
  const voided = await PaymentEvent.exists({ environment: require("./wompiService").getExpectedEventEnvironment(), transactionId: tx.id,
    status: "VOIDED", $or: [{ order: order._id }, { paymentLinkId: order.wompi.paymentLinkId }] }).session(session);
  if (tx.status === "APPROVED") {
    if (voided) {
      addIncident(order, "payment_voided", tx.id);
      if (!order.wompi.transactionId || order.wompi.transactionId === tx.id) {
        order.wompi.transactionId = tx.id; order.wompi.status = "VOIDED";
        if (order.paymentStatus !== "reembolsado") order.paymentStatus = "rechazado";
      }
      return true;
    }
    if (order.paymentStatus === "reembolsado") { addIncident(order, "approval_on_refunded_order", tx.id); blocked = true; }
    if (order.paymentStatus === "pagado" && order.wompi.transactionId !== tx.id) { addIncident(order, "additional_approved_payment", tx.id); blocked = true; }
    if (tx.currency !== "COP" || !Number.isSafeInteger(tx.amount_in_cents) || tx.amount_in_cents !== Math.round(order.total * 100)) {
      addIncident(order, "payment_amount_or_currency_mismatch", `${tx.id}: ${tx.amount_in_cents} ${tx.currency}`); blocked = true;
    }
    if (!blocked) {
      order.paymentStatus = "pagado"; order.paymentConfirmedAt ||= new Date();
      order.wompi.transactionId = tx.id; order.wompi.reference = tx.reference || ""; order.wompi.status = "APPROVED";
    }
    if (["cancelado", "devuelto", "rechazado"].includes(order.orderStatus)) { addIncident(order, "approved_after_cancellation", tx.id); blocked = true; }
  } else if (tx.status === "VOIDED") {
    if (order.wompi.transactionId === tx.id || !["pagado", "reembolsado"].includes(order.paymentStatus)) {
      order.wompi.transactionId = tx.id; order.wompi.reference = tx.reference || ""; order.wompi.status = "VOIDED";
      if (order.paymentStatus !== "reembolsado") order.paymentStatus = "rechazado";
      addIncident(order, "payment_voided", tx.id);
    } else addIncident(order, "additional_payment_voided", tx.id);
    blocked = true;
  } else if (!["pagado", "reembolsado"].includes(order.paymentStatus) && !voided && order.wompi.status !== "VOIDED") {
    order.wompi.transactionId = tx.id; order.wompi.reference = tx.reference || ""; order.wompi.status = tx.status;
    if (["DECLINED", "ERROR"].includes(tx.status)) order.paymentStatus = "rechazado";
  }
  return blocked;
};

exports.processTransaction = async (orderId, tx, evidence = {}) => {
  if (evidence.environment !== require("./wompiService").getExpectedEventEnvironment() || typeof tx?.id !== "string" || !tx.id
      || !["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"].includes(tx.status)) throw new AppError("Evidencia Wompi inválida", 409);
  const key = crypto.createHash("sha256").update(JSON.stringify([evidence.environment, tx.id, tx.status, tx.amount_in_cents, tx.currency])).digest("hex");
  let event;
  try {
    event = await PaymentEvent.findOneAndUpdate({ key }, { $setOnInsert: {
      key, transactionId: tx.id, status: tx.status,
      amountInCents: tx.amount_in_cents, currency: tx.currency, reference: tx.reference,
      environment: evidence.environment, checksum: evidence.checksum, providerTimestamp: evidence.timestamp,
      paymentLinkId: typeof tx.payment_link_id === "string" ? tx.payment_link_id : "", source: evidence.reconcile ? "provider_query" : "webhook",
    } }, { upsert: true, returnDocument: "after", writeConcern: { w: "majority" } });
  } catch (err) {
    if (err.code !== 11000) throw err;
    event = await PaymentEvent.findOne({ key });
  }
  if (event.processedAt && !evidence.reconcile) return;
  const initialAssociation = await exports.findAssociation(tx);
  // A signed VOIDED of the unique applied ID is sufficient to BLOCK that charge,
  // even if unsigned link/reference fields are missing or contradictory.
  // Keep those original fields in the receipt; this never recognizes new money.
  if (initialAssociation.appliedVoid) tx = { ...tx, payment_link_id: initialAssociation.order.wompi.paymentLinkId, reference: initialAssociation.order.wompi.reference };
  // Wompi's checksum may omit link/currency. An authenticated server query
  // anchors those fields before a candidate association can affect an order.
  if (!evidence.reconcile && evidence.checksum && initialAssociation.order && !initialAssociation.appliedVoid) {
    let trusted;
    try { trusted = await require("./wompiService").getTransaction(tx.id); }
    catch {
      await inTransaction(async session => {
        const receipt = await PaymentEvent.findById(event._id).session(session);
        receipt.processingState = "failed"; receipt.lastError = "Consulta autenticada pendiente";
        await require("./notificationEvents").paymentEventReview(receipt, session); await receipt.save({ session });
      });
      throw new AppError("Verificación Wompi pendiente; evidencia conservada", 503);
    }
    await PaymentEvent.updateOne({ _id: event._id }, { $set: { providerObservation: {
      status: trusted.status, paymentLinkId: trusted.payment_link_id, amountInCents: trusted.amount_in_cents,
      currency: trusted.currency, checkedAt: new Date(),
    } } }, { writeConcern: { w: "majority" } });
    if (trusted.payment_link_id !== tx.payment_link_id || trusted.currency !== tx.currency || trusted.amount_in_cents !== tx.amount_in_cents) {
      await inTransaction(async session => {
        const receipt = await PaymentEvent.findById(event._id).session(session);
        receipt.processingState = "unassociated"; receipt.associationError = "provider_binding_mismatch";
        await require("./notificationEvents").paymentEventReview(receipt, session); await receipt.save({ session });
      });
      return;
    }
    if (trusted.status !== tx.status && tx.status !== "VOIDED") {
      // Apply the current authenticated state; retain the signed observation too.
      await exports.processTransaction(orderId, trusted, { environment: evidence.environment, reconcile: true });
      await PaymentEvent.updateOne({ _id: event._id }, { $set: { processingState: "processed", processedAt: new Date(), associationError: "superseded_by_provider_state" } });
      return;
    }
  }
  const association = await exports.findAssociation(tx);
  if (!association.order || (orderId && String(association.order._id) !== String(orderId))
      || (event.order && String(event.order) !== String(association.order?._id))) {
    await inTransaction(async (session) => {
      const receipt = await PaymentEvent.findById(event._id).session(session);
      if (receipt.processedAt) return;
      receipt.processingState = "unassociated"; receipt.associationError = association.error || "requested_order_mismatch";
      await require("./notificationEvents").paymentEventReview(receipt, session);
      await receipt.save({ session });
    });
    if (orderId) throw new AppError("La transacción no tiene vínculo inequívoco con este pedido", 409);
    return;
  }
  orderId = association.order._id;
  // A reconciler may still see APPROVED for a charge whose manual refund was
  // audited separately. Re-querying the same observation must not reopen it.
  if (event.processedAt && association.order.incidents.some(i => i.resolvedAt
      && i.resolution?.evidence?.transactionId === tx.id
      && ["manual_refund_confirmed", "record_void_review"].includes(i.resolution.decision))) return;
  try {
    // Validated money survives a later inventory failure, without pre-validating outside a transaction.
    await inTransaction(async (session) => {
      const receipt = await PaymentEvent.findById(event._id).session(session);
      if (receipt.processedAt && !evidence.reconcile) return;
      const current = await exports.findAssociation(tx, session);
      if (!current.order || String(current.order._id) !== String(orderId) || (receipt.order && String(receipt.order) !== String(orderId))) throw new AppError("Asociación contradictoria", 409);
      receipt.order = orderId; receipt.processingState = "associated"; receipt.associationError = "";
      if (evidence.reconcile) receipt.providerObservation = { status: tx.status, paymentLinkId: tx.payment_link_id,
        amountInCents: tx.amount_in_cents, currency: tx.currency, checkedAt: new Date() };
      await recognize(current.order, tx, session);
      if (["APPROVED", "VOIDED"].includes(tx.status)) current.order.requiresReview = true;
      await current.order.save({ session, validateModifiedOnly: true });
      await receipt.save({ session });
    });
    await inTransaction(async (session) => {
      const receipt = await PaymentEvent.findById(event._id).session(session);
      if (receipt.processedAt && !evidence.reconcile) return;
      const order = await Order.findById(orderId).session(session);
      if (!order || order.paymentMethod !== "wompi") throw new Error("Invalid Wompi order");
      let blocked = await recognize(order, tx, session);
      if (tx.status === "APPROVED") {
        if (!blocked && !order.stockDeducted) {
          // Preflight ALL lines; a stock shortage leaves money recognized and no partial sale.
          const Product = require("../models/product");
          const totals = new Map();
          for (const item of order.items) {
            const k = `${item.product}:${item.variantId}`;
            totals.set(k, { item, quantity: (totals.get(k)?.quantity || 0) + item.quantity });
          }
          for (const { item, quantity } of totals.values()) {
            const exists = await Product.exists({ _id: item.product, isActive: true, variants: { $elemMatch: { _id: item.variantId, isActive: true, stock: { $gte: quantity } } } }).session(session);
            if (!exists) { addIncident(order, "approved_without_stock", tx.id); blocked = true; break; }
          }
          if (!blocked) {
            await moveStock(order.items, -1, { orderId: order._id, orderNumber: order.orderNumber }, session);
            order.stockDeducted = true;
          }
        }
        if (!blocked && ["pendiente", "pago_pendiente"].includes(order.orderStatus)) order.orderStatus = "pagado";
        if (!blocked) for (const incident of order.incidents) {
          if ((["payment_processing_failed", "approved_without_stock"].includes(incident.code) && incident.detail === tx.id)
              || incident.code === "cancellation_verification_pending") incident.resolvedAt ||= new Date();
        }
        order.requiresReview = blocked || order.incidents.some((i) => !i.resolvedAt);
        history(order, `Wompi APPROVED verificado: ${tx.id}${blocked ? "; requiere conciliación" : ""}`);
        if (!blocked && order.couponCode && !order.couponConsumed && !order.incidents.some(i => i.code === "coupon_reconciliation" && i.resolvedAt && i.resolution?.decision === "accept_discount")) {
          const consumed = await Coupon.findOneAndUpdate({ code: order.couponCode, isActive: true,
            $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] }, { $inc: { usedCount: 1 } }, { session });
          order.couponConsumed = !!consumed;
          if (!consumed) addIncident(order, "coupon_reconciliation", order.couponCode);
        }
      } else {
        history(order, `Wompi ${tx.status}: ${tx.id}. No se cancela el pedido automáticamente.`);
      }
      if (["APPROVED", "VOIDED"].includes(tx.status)) order.requiresReview = blocked || order.incidents.some(i => !i.resolvedAt);
      else if (order.incidents.some(i => !i.resolvedAt)) order.requiresReview = true;
      await require("./notificationEvents").paymentResult(order, tx, session);
      await order.save({ session, validateModifiedOnly: true });
      receipt.processedAt = new Date(); receipt.processingState = "processed"; receipt.lastError = "";
      await receipt.save({ session });
    });
  } catch (err) {
    await PaymentEvent.updateOne({ _id: event._id }, { $set: { processingState: "failed", lastError: "Aplicación pendiente; reintentar conciliación" } });
    try {
      await inTransaction(async session => {
        const receipt = await PaymentEvent.findById(event._id).session(session);
        await require("./notificationEvents").paymentEventReview(receipt, session); await receipt.save({ session });
      });
    } catch { /* Original failure remains non-200; inbox is the durable recovery source. */ }
    if (tx.status === "APPROVED") {
      await Order.updateOne({ _id: orderId, incidents: { $not: { $elemMatch: { code: "payment_processing_failed", detail: tx.id, resolvedAt: null } } } }, { $set: { requiresReview: true }, $push: {
        incidents: { code: "payment_processing_failed", detail: tx.id },
      } });
      // The financial fact and incident already survive a failed fulfillment.
      // Queue its alert separately if storage is available; the durable inbox
      // and visible incident remain the recovery source if it is not.
      try {
        await require("./orderOperations").mutateOrder(orderId, async () => {});
      } catch { /* Original failure remains non-2xx for provider retry. */ }
    }
    throw err; // non-2xx asks provider to retry; evidence is already durable
  }
};
