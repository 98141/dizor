const crypto = require("crypto");
const validator = require("validator");
const Notification = require("../models/notification");
const { snapshotOrder } = require("./notificationTemplates");

exports.validEmail = (value) => typeof value === "string" && value.length <= 254 && validator.isEmail(value) && !/[\r\n]/.test(value);
exports.adminRecipient = () => (process.env.ADMIN_NOTIFY_EMAIL || "").trim().toLowerCase();
exports.enqueue = async (order, event, identity, session, extra = {}) => {
  if (!session?.inTransaction()) throw new Error("Notification events require a transaction");
  const audience = event.startsWith("admin.") ? "admin" : "buyer";
  const recipient = (audience === "admin" ? exports.adminRecipient() : order.buyer?.email || "").trim().toLowerCase();
  const eventKey = crypto.createHash("sha256").update(JSON.stringify([String(order._id), event, identity, recipient, "email"])).digest("hex");
  const valid = exports.validEmail(recipient);
  return Notification.findOneAndUpdate({ eventKey }, { $setOnInsert: {
    eventKey, order: order._id, event, audience, recipient, snapshot: snapshotOrder(order),
    status: valid ? "pending" : "skipped", retryable: valid,
    errorCode: valid ? "" : recipient ? "invalid_recipient" : "recipient_missing",
    history: [{ at: new Date(), outcome: "created", attempt: 0 }], ...extra,
  } }, { session, upsert: true, returnDocument: "after" }).select("+reason");
};
exports.orderRegistered = async (order, session) => {
  // Older accepted receipts are historical evidence, not a reason to resend.
  if (!order.buyerReceipt?.sentAt) await exports.enqueue(order, "order.received", "registered", session);
  if (order.paymentMethod === "contra_entrega" && !order.requiresReview && order.stockDeducted) await exports.enqueue(order, "admin.ready", "ready", session);
};
exports.activeIncidents = async (order, session) => {
  for (const [index, incident] of (order.incidents || []).entries()) if (!incident.resolvedAt) {
    // Incident history is append-only. Its position + facts remain stable even
    // for old raw documents without subdocument IDs/timestamps (Mongoose may
    // otherwise manufacture a different default ID on each read).
    await exports.enqueue(order, "admin.incident", JSON.stringify([index, incident.code, incident.detail]), session);
  }
};
exports.orderChanged = async (order, previous, session) => {
  if (order.orderStatus !== previous.status) {
    if (order.orderStatus === "enviado") await exports.enqueue(order, "order.shipped", "shipped", session);
    if (order.orderStatus === "entregado") await exports.enqueue(order, "order.delivered", "delivered", session);
    if (order.orderStatus === "cancelado") {
      await exports.enqueue(order, "order.cancelled", "cancelled", session);
      if (order.cancelledByCustomer) await exports.enqueue(order, "admin.cancelled", "cancelled", session);
    }
  } else if (order.orderStatus === "enviado" && `${order.carrier}|${order.trackingNumber}` !== previous.tracking) {
    await exports.enqueue(order, "shipping.corrected", String(order.shippingRevision), session);
  }
  await exports.activeIncidents(order, session);
};
exports.paymentResult = async (order, tx, session) => {
  if (tx.status === "APPROVED" && !["cancelado", "devuelto", "rechazado"].includes(order.orderStatus)) {
    if (order.requiresReview) await exports.enqueue(order, "payment.review", tx.id, session);
    else {
      await exports.enqueue(order, "payment.approved", "approved", session);
      if (order.stockDeducted) await exports.enqueue(order, "admin.ready", "ready", session);
    }
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(tx.status) && !["pagado", "reembolsado"].includes(order.paymentStatus) && !["cancelado", "devuelto"].includes(order.orderStatus)) {
    await exports.enqueue(order, "payment.declined", tx.id, session);
  }
  await exports.activeIncidents(order, session);
};
