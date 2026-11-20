const Order = require("../models/order");
const Notification = require("../models/notification");
const { inTransaction } = require("./transactionService");
const { orderRegistered } = require("./notificationEvents");
const { buildMessage, snapshotOrder } = require("./notificationTemplates");
const delivery = require("./notificationDelivery");

exports.buildOrderReceivedEmail = (order) => ({ ...buildMessage("order.received", snapshotOrder(order)), includesDeliveryTime: !!order.legal?.deliveryTermsText });
exports.setReceiptTransport = delivery.setReceiptTransport;
exports.sendOrderReceiptOnce = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.buyerReceipt?.sentAt) return { sent: false, reason: "already_sent_or_no_email" };
    // Do not automatically repeat an ambiguous send claimed by the old service.
    if (order.buyerReceipt?.claimedAt) return { sent: false, reason: "legacy_claim_requires_review" };
    await inTransaction(async (session) => {
      const current = await Order.findById(orderId).session(session);
      if (current) await orderRegistered(current, session);
    });
    const notification = await Notification.findOne({ order: orderId, event: "order.received", resendOf: null });
    // Delivery belongs to the worker, never to the checkout HTTP request.
    const result = notification && await Notification.findById(notification._id);
    return { sent: result?.status === "sent", reason: result?.errorCode || "queued" };
  } catch {
    // Receipt enqueue recovery never rolls back a completed checkout. Its outbox entry
    // remains pending/leased for the worker and visible in the admin history.
    return { sent: false, reason: "pending_recovery" };
  }
};
