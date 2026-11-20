const crypto = require("crypto");
const Order = require("../models/order");
const PaymentEvent = require("../models/paymentEvent");
const Coupon = require("../models/coupon");
const { inTransaction } = require("./transactionService");
const { moveStock } = require("./inventoryService");
const { addIncident, history } = require("./orderOperations");

exports.processTransaction = async (orderId, tx, evidence = {}) => {
  const key = crypto.createHash("sha256").update(JSON.stringify([evidence.environment, tx.id, tx.status, tx.amount_in_cents, tx.currency])).digest("hex");
  let event;
  try {
    event = await PaymentEvent.findOneAndUpdate({ key }, { $setOnInsert: {
      key, order: orderId, transactionId: tx.id, status: tx.status,
      amountInCents: tx.amount_in_cents, currency: tx.currency, reference: tx.reference,
      environment: evidence.environment, checksum: evidence.checksum, providerTimestamp: evidence.timestamp,
    } }, { upsert: true, new: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
    event = await PaymentEvent.findOne({ key });
  }
  if (event.processedAt && !evidence.reconcile) return;
  if (String(event.order) !== String(orderId)) throw new Error("Transaction associated with another order");

  if (tx.status === "APPROVED") {
    // Money is a fact, independent of stock/fulfillment. Persist BEFORE fulfillment.
    await Order.updateOne({ _id: orderId, paymentStatus: { $nin: ["pagado", "reembolsado"] } }, {
      $set: { paymentStatus: "pagado", paymentConfirmedAt: new Date(),
        "wompi.transactionId": tx.id, "wompi.reference": tx.reference || "", "wompi.status": "APPROVED", requiresReview: true },
    });
  }

  try {
    await inTransaction(async (session) => {
      const receipt = await PaymentEvent.findById(event._id).session(session);
      if (receipt.processedAt && !evidence.reconcile) return;
      const order = await Order.findById(orderId).session(session);
      if (!order || order.paymentMethod !== "wompi") throw new Error("Invalid Wompi order");
      if (receipt.processedAt && !order.requiresReview) return;
      if (tx.status === "APPROVED") {
        let blocked = false;
        if (order.paymentStatus === "reembolsado") { addIncident(order, "approval_on_refunded_order", tx.id); blocked = true; }
        if (order.wompi.transactionId !== tx.id) { addIncident(order, "additional_approved_payment", tx.id); blocked = true; }
        if (tx.currency !== "COP" || tx.amount_in_cents !== Math.round(order.total * 100)) {
          addIncident(order, "payment_amount_or_currency_mismatch", `${tx.id}: ${tx.amount_in_cents} ${tx.currency}`); blocked = true;
        }
        if (["cancelado", "devuelto", "rechazado"].includes(order.orderStatus)) {
          addIncident(order, "approved_after_cancellation", tx.id); blocked = true;
        }
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
        if (!blocked && order.couponCode && !order.couponConsumed) {
          const consumed = await Coupon.findOneAndUpdate({ code: order.couponCode, isActive: true,
            $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] }, { $inc: { usedCount: 1 } }, { session });
          order.couponConsumed = !!consumed;
          if (!consumed) addIncident(order, "coupon_reconciliation", order.couponCode);
        }
      } else if (!["pagado", "reembolsado"].includes(order.paymentStatus)) {
        order.wompi.transactionId = tx.id;
        order.wompi.reference = tx.reference || "";
        order.wompi.status = tx.status;
        if (["DECLINED", "ERROR", "VOIDED"].includes(tx.status)) order.paymentStatus = "rechazado";
        history(order, `Wompi ${tx.status}: ${tx.id}. No se cancela el pedido automáticamente.`);
      }
      await order.save({ session, validateModifiedOnly: true });
      receipt.processedAt = new Date(); receipt.lastError = "";
      await receipt.save({ session });
    });
  } catch (err) {
    await PaymentEvent.updateOne({ _id: event._id }, { $set: { lastError: "Aplicación pendiente; reintentar conciliación" } });
    if (tx.status === "APPROVED") {
      await Order.updateOne({ _id: orderId, incidents: { $not: { $elemMatch: { code: "payment_processing_failed", detail: tx.id, resolvedAt: null } } } }, { $set: { requiresReview: true }, $push: {
        incidents: { code: "payment_processing_failed", detail: tx.id },
      } });
    }
    throw err; // non-2xx asks provider to retry; evidence is already durable
  }
};
