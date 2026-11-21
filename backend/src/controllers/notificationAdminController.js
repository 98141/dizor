const crypto = require("crypto");
const Notification = require("../models/notification");
const Order = require("../models/order");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { isAdmin } = require("../utils/orderPermissions");
const { inTransaction } = require("../services/transactionService");
const { enqueue } = require("../services/notificationEvents");
const { EVENT_LABELS } = require("../services/notificationTemplates");
const { canRetry, ERROR_LABELS } = require("../services/notificationDelivery");

const mask = (recipient) => {
  const [local, domain] = (recipient || "").split("@");
  return domain ? `${local.slice(0, 1)}***@${domain.slice(0, 1)}***.${domain.split(".").at(-1)}` : "Sin destinatario válido";
};
exports.list = catchAsync(async (req, res) => {
  const order = await Order.findById(req.params.id).select("buyerReceipt");
  if (!order) throw new AppError("Pedido no encontrado", 404);
  const admin = isAdmin(req.user.role);
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const filter = { order: req.params.id, ...(!admin ? { audience: "buyer" } : {}) };
  const [rows, total] = await Promise.all([
    Notification.find(filter).select("+recipient").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20),
    Notification.countDocuments(filter),
  ]);
  const pendingCopies = await Notification.find({ resendOf: { $in: rows.map((n) => n._id) }, status: { $in: ["pending", "processing"] } }).select("resendOf");
  const awaitingCopy = new Set(pendingCopies.map((n) => String(n.resendOf)));
  const hasReceipt = await Notification.exists({ order: order._id, event: "order.received" });
  const legacyReceipt = !hasReceipt && (order.buyerReceipt?.sentAt || order.buyerReceipt?.claimedAt)
    ? { recordedAt: order.buyerReceipt.sentAt || order.buyerReceipt.claimedAt, unverified: true } : null;
  res.json({ status: "success", total, page, legacyReceipt, deliveryEnabled: process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED === "true", pages: Math.max(1, Math.ceil(total / 20)), notifications: rows.map((n) => ({
    id: n._id, event: EVENT_LABELS[n.event] || "Comunicación transaccional", audience: n.audience,
    recipient: mask(n.recipient), status: n.status, createdAt: n.createdAt, lastAttemptAt: n.lastAttemptAt,
    acceptedAt: n.acceptedAt, deliveredAt: n.deliveredAt, attempts: n.attempts, nextAttemptAt: n.nextAttemptAt,
    error: ERROR_LABELS[n.errorCode] || "", retryable: admin && !n.supersededBy && canRetry(n), canResend: admin && !n.supersededBy && !awaitingCopy.has(String(n._id)) && !["pending", "processing"].includes(n.status),
    resend: !!n.resendOf, superseded: !!n.supersededBy, ambiguous: n.ambiguous,
    history: admin ? n.history.map((h) => ({ at: h.at, outcome: h.outcome, attempt: h.attempt, error: ERROR_LABELS[h.code] || "" })) : undefined,
  })) });
});
exports.retry = catchAsync(async (req, res) => {
  if (!isAdmin(req.user.role)) throw new AppError("Solo administradores pueden reintentar comunicaciones", 403);
  const row = await Notification.findOne({ _id: req.params.notificationId, order: req.params.id });
  if (!row) throw new AppError("Comunicación no encontrada", 404);
  if (row.supersededBy) throw new AppError("Consulta el reenvío más reciente; esta comunicación ya fue reemplazada", 409);
  if (["pending", "processing", "sent", "delivered"].includes(row.status)) return res.status(202).json({ status: "success", message: "La comunicación ya está registrada o en proceso" });
  if (!canRetry(row)) throw new AppError("Requiere revisión o un reenvío explícito; no se puede reintentar automáticamente", 409);
  await Notification.updateOne({ _id: row._id, status: row.status, attempts: row.attempts }, {
    $set: { status: "pending", nextAttemptAt: new Date() },
    $push: { history: { at: new Date(), outcome: "retry_requested", attempt: row.attempts, actor: req.user.id } },
  });
  res.status(202).json({ status: "success", message: "Reintento registrado; conserva la misma comunicación" });
});
exports.resend = catchAsync(async (req, res) => {
  if (!isAdmin(req.user.role)) throw new AppError("Solo administradores pueden reenviar comunicaciones", 403);
  const { requestKey, reason, confirmed, acknowledgeDuplicateRisk } = req.body;
  if (confirmed !== true || typeof requestKey !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestKey) || typeof reason !== "string" || reason.trim().length < 5 || reason.length > 300) {
    throw new AppError("Confirma el reenvío con un motivo y una clave válida", 400);
  }
  const manualKey = crypto.createHash("sha256").update(JSON.stringify([req.params.id, req.params.notificationId, requestKey])).digest("hex");
  let id;
  try { id = await inTransaction(async (session) => {
    const previous = await Notification.findOne({ manualKey }).select("+reason").session(session);
    if (previous) {
      if (String(previous.requestedBy) !== String(req.user.id) || previous.reason !== reason.trim()) throw new AppError("La clave ya corresponde a otro reenvío", 409);
      return previous._id;
    }
    const original = await Notification.findOne({ _id: req.params.notificationId, order: req.params.id }).session(session);
    if (!original) throw new AppError("Comunicación no encontrada", 404);
    if (original.supersededBy) throw new AppError("Consulta el reenvío más reciente; esta comunicación ya fue reemplazada", 409);
    if (["pending", "processing"].includes(original.status)) throw new AppError("La comunicación sigue pendiente o en proceso", 409);
    if (original.ambiguous && acknowledgeDuplicateRisk !== true) throw new AppError("Debes verificar o reconocer el posible envío anterior", 409);
    if (await Notification.exists({ resendOf: original._id, status: { $in: ["pending", "processing"] } }).session(session)) throw new AppError("Ya hay un reenvío pendiente de esta comunicación", 409);
    // Serialize requests with different keys as well, not just retries of one
    // request. Concurrent explicit actions cannot both pass the pending check.
    original.lastResendRequest = manualKey;
    await original.save({ session });
    const order = await Order.findById(original.order).session(session);
    if (!order) throw new AppError("Pedido no encontrado", 404);
    const identity = `resend:${original._id}:${crypto.createHash("sha256").update(requestKey).digest("hex")}`;
    const row = await enqueue(order, original.event, identity, session, { manualKey, resendOf: original._id, requestedBy: req.user.id, reason: reason.trim() });
    if (String(row.requestedBy) !== String(req.user.id) || row.reason !== reason.trim()) throw new AppError("La clave ya corresponde a otro reenvío", 409);
    original.supersededBy = row._id;
    original.retryable = false; original.nextAttemptAt = null;
    original.history.push({ at: new Date(), outcome: "superseded_by_resend", attempt: original.attempts, actor: req.user.id });
    await original.save({ session });
    return row._id;
  }); } catch (err) {
    if (err.code !== 11000) throw err;
    const previous = await Notification.findOne({ manualKey }).select("+reason");
    if (!previous || String(previous.requestedBy) !== String(req.user.id) || previous.reason !== reason.trim()) throw new AppError("Conflicto en la solicitud de reenvío", 409);
    id = previous._id;
  }
  res.status(202).json({ status: "success", id, message: "Reenvío explícito registrado. No se repite ninguna operación del pedido." });
});

exports.communicationAlerts = async () => {
  const filter = require("../services/communicationCriteria").communicationFailureFilter();
  const [groups, total] = await Promise.all([
    Notification.aggregate([{ $match: filter }, { $group: { _id: { order: "$order", code: "$errorCode" }, count: { $sum: 1 }, at: { $max: "$updatedAt" } } },
      { $sort: { at: -1 } }, { $limit: 10 }, { $lookup: { from: "orders", localField: "_id.order", foreignField: "_id", as: "order" } },
      { $project: { count: 1, at: 1, orderNumber: { $arrayElemAt: ["$order.orderNumber", 0] } } }]),
    Notification.countDocuments(filter),
  ]);
  return { count: total, items: groups.map((g) => ({ id: `${g._id.order}:${g._id.code}`, orderId: g._id.order, orderNumber: g.orderNumber,
    count: g.count, message: ERROR_LABELS[g._id.code] || "Comunicación pendiente de revisión", at: g.at })) };
};
