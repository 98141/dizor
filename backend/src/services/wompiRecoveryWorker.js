const crypto = require("node:crypto");
const Task = require("../models/wompiRecoveryTask");
const PaymentEvent = require("../models/paymentEvent");
const wompi = require("./wompiService");
const AppError = require("../utils/AppError");

const MAX_ATTEMPTS = 72;
const MAX_AGE_MS = 72 * 60 * 60 * 1000;
const LEASE_MS = 90 * 1000;
const active = ["queued", "waiting", "running"];
const eventKey = (environment, event) => `${environment}:event:${event}`;
const returnKey = (environment, order, id) => crypto.createHash("sha256")
  .update(JSON.stringify([environment, "buyer_return", String(order), id])).digest("hex");

async function enqueue(id, fields) {
  try {
    return await Task.findOneAndUpdate({ _id: id }, { $setOnInsert: fields }, {
      upsert: true, returnDocument: "after", writeConcern: { w: "majority" },
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Task.findById(id);
  }
}

exports.rememberReturn = (order, transactionId) => {
  const environment = wompi.getExpectedEventEnvironment();
  return enqueue(returnKey(environment, order._id, transactionId), {
    environment, kind: "buyer_return", order: order._id, transactionId,
  });
};

// Rebuild from the durable inbox after crashes, including a crash between
// saving a provider receipt and creating its recovery task. The lookup skips
// already scheduled receipts so old review cases cannot starve newer payments.
exports.discover = async () => {
  const environment = wompi.getExpectedEventEnvironment();
  // An administrator may have resolved a receipt while its task awaited
  // review. Close scheduling metadata only; never archive financial evidence.
  const resolved = await Task.aggregate([
    { $match: { environment, kind: "payment_event", status: { $in: ["review", "waiting", "queued"] } } },
    { $lookup: { from: PaymentEvent.collection.name, localField: "event", foreignField: "_id", as: "receipt" } },
    { $unwind: "$receipt" },
    { $match: { $or: [
      { "receipt.processedAt": { $ne: null }, "receipt.processingState": "processed", "receipt.status": { $ne: "PENDING" } },
      { "receipt.processedAt": { $ne: null }, "receipt.processingState": "processed", "receipt.associationError": "superseded_by_provider_state" },
      { "receipt.administrativeArchive.active": true, "receipt.administrativeArchive.financialFollowUp": false,
        "receipt.administrativeArchive.concludedAt": { $ne: null } },
    ] } }, { $limit: 50 }, { $project: { _id: 1 } },
  ]);
  if (resolved.length) await Task.updateMany({ _id: { $in: resolved.map(row => row._id) }, status: { $in: ["review", "waiting", "queued"] } },
    { $set: { status: "complete", completedAt: new Date(), nextAttemptAt: null, lastCode: "RESOLVED_EXTERNALLY" } });
  const resolvedReturns = await Task.aggregate([
    { $match: { environment, kind: "buyer_return", status: { $in: ["review", "waiting", "queued"] } } },
    { $lookup: { from: PaymentEvent.collection.name, let: { tx: "$transactionId", order: "$order" }, pipeline: [
      { $match: { environment, processedAt: { $ne: null }, processingState: "processed", status: { $ne: "PENDING" },
        $or: [{ source: "provider_query" }, { "providerObservation.checkedAt": { $ne: null } }],
        $expr: { $and: [{ $eq: ["$transactionId", "$$tx"] }, { $eq: ["$order", "$$order"] }] } } },
      { $limit: 1 }, { $project: { _id: 1 } },
    ], as: "proof" } },
    { $match: { "proof.0": { $exists: true } } }, { $limit: 50 }, { $project: { _id: 1 } },
  ]);
  if (resolvedReturns.length) await Task.updateMany({ _id: { $in: resolvedReturns.map(row => row._id) }, status: { $in: ["review", "waiting", "queued"] } },
    { $set: { status: "complete", completedAt: new Date(), nextAttemptAt: null, lastCode: "RESOLVED_EXTERNALLY" } });
  const receipts = await PaymentEvent.aggregate([
    { $match: { environment, "administrativeArchive.active": { $ne: true }, $or: [
      { processedAt: null }, { processingState: "failed" },
      { status: "PENDING", associationError: { $ne: "superseded_by_provider_state" } },
    ] } },
    { $addFields: { recoveryKey: { $concat: [environment, ":event:", { $toString: "$_id" }] } } },
    { $lookup: { from: Task.collection.name, localField: "recoveryKey", foreignField: "_id", as: "recoveryTask" } },
    { $match: { "recoveryTask.0": { $exists: false } } },
    { $sort: { createdAt: 1, _id: 1 } }, { $limit: 50 },
    { $project: { _id: 1, transactionId: 1, order: 1 } },
  ]);
  for (const receipt of receipts) await enqueue(eventKey(environment, receipt._id), {
    environment, kind: "payment_event", event: receipt._id, transactionId: receipt.transactionId,
    ...(receipt.order ? { order: receipt.order } : {}),
  });
  return receipts.length;
};

async function perform(task) {
  if (task.kind === "buyer_return") {
    const order = await require("../models/order").findById(task.order);
    if (!order || order.paymentMethod !== "wompi") throw Object.assign(new AppError("Pedido no disponible para verificar", 409), { recoveryReview: true });
    return require("./wompiTransactionRecovery").verifyCandidate(order, task.transactionId);
  }
  const receipt = await PaymentEvent.findById(task.event);
  if (!receipt || receipt.administrativeArchive?.active) throw Object.assign(new AppError("Evidencia no disponible para recuperación automática", 409), { recoveryReview: true });
  if (receipt.processedAt && receipt.processingState === "processed"
      && (receipt.status !== "PENDING" || receipt.associationError === "superseded_by_provider_state")) {
    return { providerStatus: "RESOLVED" };
  }
  return require("./wompiEventRecovery").reprocess(receipt._id, { automatic: true });
}

const safeCode = error => error.recoveryReject ? "RETURN_NOT_ASSOCIATED" : error.recoveryReview ? "REQUIRES_REVIEW"
  : ["WOMPI_QUERY_TIMEOUT", "WOMPI_QUERY_UNAVAILABLE", "WOMPI_QUERY_HTTP_ERROR", "WOMPI_INVALID_TRANSACTION_RESPONSE"].includes(error.code)
    ? error.code : "RECOVERY_RETRY_PENDING";

// A lease is atomic across processes. Expired work is recoverable after a
// restart; the financial processor also remains idempotent if a lease expires
// during a long database operation. A stale worker cannot release a new lease.
exports.processOne = async ({ taskId, orderId, force = false, throwOnError = false } = {}) => {
  const now = new Date(), environment = wompi.getExpectedEventEnvironment();
  const expiredLease = { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] };
  const withinBudget = { attempts: { $lt: MAX_ATTEMPTS }, createdAt: { $gte: new Date(+now - MAX_AGE_MS) } };
  const token = crypto.randomUUID();
  const task = await Task.findOneAndUpdate({ environment, status: { $in: active }, ...withinBudget,
    ...(taskId ? { _id: taskId } : {}), ...(orderId ? { order: orderId, kind: "buyer_return" } : {}),
    $and: [expiredLease, ...(force ? [] : [{ nextAttemptAt: { $lte: now } }])],
  }, { $set: { status: "running", leaseUntil: new Date(+now + LEASE_MS), leaseToken: token, lastAttemptAt: now },
    $inc: { attempts: 1 } }, { sort: { nextAttemptAt: 1, _id: 1 }, returnDocument: "after" });
  if (!task) {
    if (taskId) {
      const current = await Task.findOne({ _id: taskId, environment });
      if (current?.status === "complete") return { outcome: "complete" };
      if (throwOnError) throw new AppError(current?.status === "rejected" ? "La transacción no corresponde a este pedido."
        : current?.status === "review" ? "La verificación requiere revisión de soporte; el pedido conserva su estado."
          : "Verificación en curso; vuelve a consultar el pedido.", ["review", "rejected"].includes(current?.status) ? 409 : 503);
    }
    return null;
  }
  const lease = { _id: task._id, status: "running", leaseToken: token };
  try {
    const result = await perform(task);
    if (result.receiptId && result.orderId) await require("./wompiQueryRecovery").resolve(result.orderId, result.receiptId);
    const pending = result.providerStatus === "PENDING";
    const delay = Math.min(60 * 60 * 1000, 30000 * 2 ** Math.min(task.attempts - 1, 7));
    await Task.updateOne(lease, { $set: { status: pending ? "waiting" : "complete", lastCode: pending ? "PROVIDER_PENDING" : "",
      nextAttemptAt: pending ? new Date(Date.now() + delay) : null, completedAt: pending ? null : new Date(), leaseUntil: null, leaseToken: "" } });
    return { outcome: pending ? "waiting" : "complete" };
  } catch (error) {
    const review = error.recoveryReview || task.attempts >= MAX_ATTEMPTS || Date.now() - task.createdAt >= MAX_AGE_MS;
    const outcome = error.recoveryReject ? "rejected" : review ? "review" : "waiting";
    const delay = Math.min(60 * 60 * 1000, 30000 * 2 ** Math.min(task.attempts - 1, 7));
    await Task.updateOne(lease, { $set: { status: outcome, lastCode: safeCode(error),
      nextAttemptAt: outcome === "waiting" ? new Date(Date.now() + delay) : null, leaseUntil: null, leaseToken: "" } });
    if (throwOnError) throw error;
    return { outcome };
  }
};

exports.processBatch = async ({ limit = 5 } = {}) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("Límite de recuperación inválido");
  const now = new Date();
  await Task.updateMany({ environment: wompi.getExpectedEventEnvironment(), status: { $in: active },
    $and: [{ $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
      { $or: [{ attempts: { $gte: MAX_ATTEMPTS } }, { createdAt: { $lt: new Date(+now - MAX_AGE_MS) } }] }],
  }, { $set: { status: "review", lastCode: "RETRY_LIMIT_REACHED", nextAttemptAt: null, leaseUntil: null, leaseToken: "" } });
  await exports.discover();
  const counts = { attempted: 0, complete: 0, waiting: 0, review: 0, rejected: 0 };
  for (let i = 0; i < limit; i++) {
    const result = await exports.processOne();
    if (!result) break;
    counts.attempted++; counts[result.outcome]++;
  }
  return counts;
};

exports.recoverOrderReturn = async orderId => {
  const task = await Task.findOne({ environment: wompi.getExpectedEventEnvironment(), order: orderId,
    kind: "buyer_return", status: { $in: active } }).sort({ createdAt: 1 });
  if (task) await exports.processOne({ taskId: task._id, force: true, throwOnError: true });
};

exports.startWorker = () => {
  let busy = false, stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try { await exports.processBatch(); }
    catch { require("../lib/logger").warn("Recuperación Wompi pendiente; se reintentará sin confirmar pagos manualmente"); }
    finally { busy = false; }
  };
  const interval = setInterval(tick, 30000); interval.unref(); void tick();
  return () => { stopped = true; clearInterval(interval); };
};
