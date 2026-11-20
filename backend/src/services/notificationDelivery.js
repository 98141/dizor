const crypto = require("crypto");
const Notification = require("../models/notification");
const Order = require("../models/order");
const { validEmail, adminRecipient } = require("./notificationEvents");
const { buildMessage } = require("./notificationTemplates");

const MAX_ATTEMPTS = 5;
const SAFE_WINDOW_MS = 23 * 60 * 60 * 1000; // Resend retains its key for 24h.
const LEASE_MS = 60 * 1000;
let testTransport = null;
let receiptTransport = null;
exports.setTransportForTests = (fn) => {
  if (process.env.NODE_ENV !== "test") throw new Error("Test transport is restricted to tests");
  testTransport = fn;
};
exports.setReceiptTransport = (fn) => {
  if (process.env.NODE_ENV !== "test") throw new Error("Test transport is restricted to tests");
  receiptTransport = fn;
};
exports.ERROR_LABELS = {
  service_not_configured: "Servicio de correo no configurado", invalid_recipient: "Correo no válido",
  delivery_disabled: "Entrega de correos desactivada en este entorno",
  recipient_missing: "Destinatario no configurado", recipient_changed: "Destinatario cambiado; requiere revisión",
  superseded: "El estado del pedido cambió; no se envió un mensaje desactualizado",
  temporary_error: "Fallo temporal del proveedor", permanent_error: "El proveedor rechazó el mensaje",
  result_ambiguous: "Resultado sin confirmar; reintento seguro pendiente",
  attempts_exhausted: "Se agotaron los reintentos; requiere revisión",
  review_required: "Verificar con el proveedor antes de solicitar un nuevo envío",
};
exports.isWindowExpired = (n, now = new Date()) => n.firstAttemptAt && now - new Date(n.firstAttemptAt) >= SAFE_WINDOW_MS;
exports.canRetry = (n) => ["failed", "skipped"].includes(n.status) && n.retryable && n.attempts < MAX_ATTEMPTS && !exports.isWindowExpired(n);

const authorized = (n, order) => {
  const expected = n.audience === "admin" ? adminRecipient() : (order.buyer?.email || "").trim().toLowerCase();
  if (!validEmail(n.recipient)) return "invalid_recipient";
  if (n.recipient !== expected) return "recipient_changed";
  const closed = ["cancelado", "devuelto", "rechazado"].includes(order.orderStatus);
  if (["payment.approved", "admin.ready"].includes(n.event) && (closed || order.requiresReview || !order.stockDeducted)) return "superseded";
  if (n.event === "admin.ready" && !["pendiente", "pago_pendiente", "pagado"].includes(order.orderStatus)) return "superseded";
  if (n.event === "payment.declined" && (closed || ["pagado", "reembolsado"].includes(order.paymentStatus))) return "superseded";
  if (n.event === "payment.review" && (closed || !order.requiresReview)) return "superseded";
  if (n.event === "admin.incident" && !order.requiresReview && !(order.incidents || []).some((i) => !i.resolvedAt)) return "superseded";
  if (n.event === "order.received" && closed) return "superseded";
  if (["order.shipped", "shipping.corrected"].includes(n.event) && (order.orderStatus !== "enviado" || order.trackingNumber !== n.snapshot.trackingNumber || order.carrier !== n.snapshot.carrier)) return "superseded";
  if (n.event === "order.delivered" && order.orderStatus !== "entregado") return "superseded";
  return "";
};

const retryLink = async (order) => {
  if (!order.wompi?.paymentLinkId || !process.env.WOMPI_PRIVATE_KEY) return null;
  try {
    const link = await require("./wompiService").getPaymentLink(order.wompi.paymentLinkId);
    if (link.id !== order.wompi.paymentLinkId || link.active !== true || link.currency !== "COP" || link.amount_in_cents !== Math.round(order.total * 100)) return null;
    if (link.expires_at) {
      const expiry = require("./wompiService").parseProviderExpiry(link.expires_at);
      if (!expiry || expiry <= new Date()) return null;
    }
    const url = `https://checkout.wompi.co/l/${encodeURIComponent(link.id)}`;
    return order.wompi.paymentLinkUrl === url ? url : null;
  } catch { return null; } // No unverifiable retry URL or promise in the email.
};

const deliver = async (n) => {
  if (testTransport) return testTransport(n.message, { idempotencyKey: n.eventKey, notification: n });
  if (receiptTransport && n.event === "order.received") {
    const result = await receiptTransport(n.message);
    return result?.devMode === false ? { data: { id: `receipt-test-${n._id}` } } : { skipped: true };
  }
  return require("./emailService").getResendClient().emails.send(n.message, { idempotencyKey: n.eventKey });
};

exports.processOne = async (id = null) => {
  const now = new Date();
  // Exhausted or stale processing is visible and never blindly retried after
  // the provider's deduplication window. This also recovers crashed workers.
  await Notification.updateMany({ status: { $in: ["pending", "failed", "processing"] },
    $or: [{ retryable: true }, { status: "processing" }],
    $and: [{ $or: [{ status: { $ne: "processing" } }, { leaseUntil: { $lte: now } }] },
      { $or: [{ attempts: { $gte: MAX_ATTEMPTS } }, { firstAttemptAt: { $lte: new Date(now - SAFE_WINDOW_MS), $ne: null } }] }] },
  { $set: { status: "failed", retryable: false, ambiguous: true, errorCode: "review_required", nextAttemptAt: null, leaseUntil: null },
    $push: { history: { at: now, outcome: "review_required", code: "review_required" } } });
  const leaseToken = crypto.randomUUID();
  const n = await Notification.findOneAndUpdate({ ...(id ? { _id: id } : {}), attempts: { $lt: MAX_ATTEMPTS },
    $or: [{ status: { $in: ["pending", "failed"] }, retryable: true, nextAttemptAt: { $lte: now } }, { status: "processing", leaseUntil: { $lte: now } }] },
  { $set: { status: "processing", leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS), lastAttemptAt: now }, $inc: { attempts: 1 },
    $push: { history: { at: now, outcome: "processing" } } },
  { returnDocument: "after", sort: { createdAt: 1 } }).select("+recipient +snapshot +message +leaseToken");
  if (!n) return null;
  const finish = (fields) => Notification.updateOne({ _id: n._id, status: "processing", leaseToken }, {
    $set: { ...fields, leaseUntil: null, leaseToken: "" },
    $push: { history: { at: new Date(), outcome: fields.status, attempt: n.attempts, code: fields.errorCode || "" } },
  });
  const order = await Order.findById(n.order);
  const blocked = order ? authorized(n, order) : "recipient_changed";
  const configured = testTransport || (receiptTransport && n.event === "order.received") || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const enabled = testTransport || (receiptTransport && n.event === "order.received") || process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED === "true";
  if (blocked || !configured || !enabled) {
    await finish({ status: "skipped", errorCode: blocked || (!configured ? "service_not_configured" : "delivery_disabled"), retryable: !blocked, nextAttemptAt: null });
    return n._id;
  }
  if (!n.firstAttemptAt) {
    n.firstAttemptAt = now;
    await Notification.updateOne({ _id: n._id, leaseToken }, { $set: { firstAttemptAt: now } });
  }
  if (!n.message) {
    const options = n.event === "payment.declined" ? { retryUrl: await retryLink(order) } : {};
    n.message = { ...buildMessage(n.event, n.snapshot, options), to: n.recipient, from: process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>" };
    // Freeze the exact payload before its first external attempt. All retries
    // use the same provider key AND body, even if settings or the guide change.
    await Notification.updateOne({ _id: n._id, leaseToken }, { $set: { message: n.message } });
  }
  let response;
  try {
    let timer;
    try { response = await Promise.race([deliver(n), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 10000); })]); }
    finally { clearTimeout(timer); }
  } catch { response = { error: { network: true } }; }
  if (response?.data?.id) {
    const acceptedAt = new Date();
    // If this persistence fails, leave the lease for recovery with the SAME
    // provider key. Never mark an ambiguous acceptance as a fresh new email.
    await finish({ status: "sent", acceptedAt, providerId: String(response.data.id), errorCode: "", retryable: false, ambiguous: false, nextAttemptAt: null });
    if (n.event === "order.received") await Order.updateOne({ _id: order._id }, { $set: { "buyerReceipt.sentAt": acceptedAt, "buyerReceipt.lastError": "" }, $max: { "buyerReceipt.attempts": n.attempts } }, { timestamps: false });
  } else {
    const error = response?.error || { network: true };
    const temporary = error.network || error.statusCode >= 500 || error.statusCode === 429 || error.name === "concurrent_idempotent_requests";
    const retryable = !!temporary && n.attempts < MAX_ATTEMPTS;
    const errorCode = response?.skipped ? "service_not_configured" : temporary && !retryable ? "attempts_exhausted" : error.network ? "result_ambiguous" : temporary ? "temporary_error" : "permanent_error";
    await finish({ status: response?.skipped ? "skipped" : "failed", errorCode, retryable,
      ambiguous: !!error.network || error.statusCode >= 500, nextAttemptAt: retryable ? new Date(Date.now() + [60000, 300000, 1800000, 7200000][n.attempts - 1]) : null });
  }
  return n._id;
};
exports.processBatch = async (limit = 20) => {
  let processed = 0;
  while (processed < limit && await exports.processOne()) processed++;
  return processed;
};
exports.recoverIncidents = async (limit = 20) => {
  const { mutateOrder } = require("./orderOperations");
  // Reconcile only COMMUNICATION evidence after an interrupted operation.
  // Never replay payment, inventory or order transitions in this worker.
  const orders = await Order.find({ incidents: { $elemMatch: { resolvedAt: null } } })
    .sort({ notificationReviewCheckedAt: 1, _id: 1 }).limit(limit).select("_id");
  for (const order of orders) await mutateOrder(order._id, async (current) => { current.notificationReviewCheckedAt = new Date(); }, { timestamps: false });
  const PaymentEvent = require("../models/paymentEvent");
  const interrupted = await PaymentEvent.find({ status: "APPROVED", processedAt: null, notificationQueuedAt: null,
    updatedAt: { $lte: new Date(Date.now() - 60000) } }).limit(limit).select("_id order");
  for (const event of interrupted) await require("./transactionService").inTransaction(async (session) => {
    const receipt = await PaymentEvent.findById(event._id).session(session);
    if (!receipt || receipt.processedAt || receipt.notificationQueuedAt) return;
    const order = await Order.findById(receipt.order).session(session);
    if (order?.requiresReview) await require("./notificationEvents").enqueue(order, "admin.incident", `payment-recovery:${receipt._id}`, session);
    receipt.notificationQueuedAt = new Date(); await receipt.save({ session, timestamps: false });
  });
};
exports.startWorker = () => {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await exports.recoverIncidents(); await exports.processBatch(); }
    catch { require("../lib/logger").warn("Notification worker: persistence or processing pending; will retry"); }
    finally { busy = false; }
  };
  const interval = setInterval(tick, 30000); interval.unref();
  void tick();
  return () => clearInterval(interval);
};
