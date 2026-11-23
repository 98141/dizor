const mongoose = require("mongoose");
const PaymentEvent = require("../models/paymentEvent");
const AuditLog = require("../models/AuditLog");
const AppError = require("../utils/AppError");
const { inTransaction } = require("./transactionService");

exports.filter = view => view === "financial-follow-up"
  ? { "administrativeArchive.active": true, "administrativeArchive.financialFollowUp": true }
  : view === "closed-follow-up" ? { "administrativeArchive.active": true, "administrativeArchive.financialFollowUp": false, "administrativeArchive.concludedAt": { $ne: null } }
  : { processedAt: null, "administrativeArchive.active": { $ne: true } };

function validate(id, body, actor) {
  if (!["admin", "superadmin"].includes(actor.role)) throw new AppError("Solo administradores pueden gestionar archivos", 403);
  if (!mongoose.isObjectIdOrHexString(id)) throw new AppError("ID de evento inválido", 400);
  if (typeof body?.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 1000) throw new AppError("Indica un motivo de hasta 1000 caracteres", 400);
  return body.reason.trim();
}
async function audit(event, actor, action, previous, session) {
  await AuditLog.create([{ userId: actor.id, userEmail: actor.email, role: actor.role, action, module: "orders",
    entityId: event._id, entityType: "payment_event", previousData: previous, newData: event.administrativeArchive.toObject(),
    summary: action === "payment_event_archived" ? "Archivo administrativo; seguimiento financiero abierto"
      : action === "payment_event_follow_up_concluded" ? "Seguimiento concluido con pago autenticado y sin incidencias" : "Reapertura de evidencia de pago", success: true }], { session });
}
exports.archive = async (id, body, actor) => {
  const reason = validate(id, body, actor);
  if (!mongoose.isObjectIdOrHexString(body.evidenceReceiptId)) throw new AppError("Indica un recibo autenticado como evidencia", 400);
  const evidenceReceiptId = new mongoose.Types.ObjectId(body.evidenceReceiptId).toString();
  return inTransaction(async session => {
    const event = await PaymentEvent.findById(id).session(session);
    if (!event) throw new AppError("Evento no encontrado", 404);
    if (event.environment !== require("./wompiService").getExpectedEventEnvironment()) throw new AppError("Evento de otro ambiente", 409);
    if (event.administrativeArchive?.active) {
      if (event.administrativeArchive.reason === reason && String(event.administrativeArchive.evidenceReceipt) === evidenceReceiptId) return;
      throw new AppError("El evento ya tiene una decisión de archivo; reábrelo para cambiarla", 409);
    }
    const proof = await PaymentEvent.findById(evidenceReceiptId).session(session);
    const observation = event.providerObservation;
    const terminal = ["APPROVED", "DECLINED", "ERROR", "VOIDED"];
    const contradictory = observation && terminal.includes(observation.status) && event.status !== "PENDING"
      && ((["DECLINED", "ERROR"].includes(event.status) && ["APPROVED", "VOIDED"].includes(observation.status))
        || event.amountInCents !== observation.amountInCents || event.currency !== observation.currency);
    if (event.processedAt || !contradictory || !proof?.processedAt || proof.processingState !== "processed"
        || !(proof.source === "provider_query" || (proof.providerObservation?.checkedAt
          && proof.providerObservation.status === proof.status && proof.providerObservation.amountInCents === proof.amountInCents
          && proof.providerObservation.currency === proof.currency && proof.providerObservation.paymentLinkId === proof.paymentLinkId))
        || !proof.order || String(proof._id) === String(event._id)
        || proof.transactionId !== event.transactionId || proof.environment !== event.environment
        || (event.order && String(event.order) !== String(proof.order))
        || proof.status !== observation.status || proof.amountInCents !== observation.amountInCents
        || proof.currency !== observation.currency || proof.paymentLinkId !== observation.paymentLinkId) {
      throw new AppError("Archivo requiere contradicción persistente y recibo autenticado procesado de la misma transacción; recupera o concilia primero", 409);
    }
    const previous = event.administrativeArchive?.toObject();
    event.administrativeArchive = { active: true, actor: actor.id, archivedAt: new Date(), reason,
      evidenceReceipt: proof._id, financialFollowUp: true };
    await event.save({ session });
    await audit(event, actor, "payment_event_archived", previous, session);
  });
};
exports.reopen = async (id, body, actor) => {
  const reason = validate(id, body, actor);
  return inTransaction(async session => {
    const event = await PaymentEvent.findById(id).session(session);
    if (!event) throw new AppError("Evento no encontrado", 404);
    if (!event.administrativeArchive?.active) return;
    if (event.environment !== require("./wompiService").getExpectedEventEnvironment()) throw new AppError("Evento de otro ambiente", 409);
    const previous = event.administrativeArchive.toObject();
    event.administrativeArchive.active = false;
    event.administrativeArchive.reopenedAt = new Date(); event.administrativeArchive.reopenedBy = actor.id;
    event.administrativeArchive.reopenReason = reason;
    await event.save({ session });
    await audit(event, actor, "payment_event_reopened", previous, session);
  });
};

// A conclusion records a reviewed fact. It never confirms money or clears incidents.
exports.conclude = async (id, body, actor) => {
  const reason = validate(id, body, actor);
  const initial = await PaymentEvent.findById(id);
  if (!initial) throw new AppError("Evento no encontrado", 404);
  if (!initial.administrativeArchive?.active) throw new AppError("Primero archiva el evento con evidencia", 409);
  if (initial.environment !== require("./wompiService").getExpectedEventEnvironment()) throw new AppError("Evento de otro ambiente", 409);
  const alreadyConcluded = event => {
    if (event.administrativeArchive.financialFollowUp !== false || !event.administrativeArchive.concludedAt) return false;
    if (event.administrativeArchive.conclusionReason !== reason) throw new AppError("La conclusión ya está registrada; reabre para investigar nueva evidencia", 409);
    return true;
  };
  if (alreadyConcluded(initial)) return;
  let tx;
  try { tx = await require("./wompiService").getTransaction(initial.transactionId); }
  catch { throw new AppError("No se pudo actualizar la evidencia privada; seguimiento abierto", 503); }
  return inTransaction(async session => {
    const event = await PaymentEvent.findById(id).session(session);
    if (!event?.administrativeArchive?.active) throw new AppError("El evento ya no está archivado", 409);
    if (alreadyConcluded(event)) return;
    const proof = await PaymentEvent.findById(event.administrativeArchive.evidenceReceipt).session(session);
    const Order = require("../models/order");
    const order = proof?.order ? await Order.findById(proof.order).session(session) : null;
    const privateProof = proof && (proof.source === "provider_query" || (proof.providerObservation?.checkedAt
      && proof.providerObservation.status === proof.status && proof.providerObservation.amountInCents === proof.amountInCents
      && proof.providerObservation.currency === proof.currency && proof.providerObservation.paymentLinkId === proof.paymentLinkId));
    const voided = await PaymentEvent.exists({ transactionId: event.transactionId, environment: event.environment, status: "VOIDED" }).session(session);
    if (!order || !privateProof || !proof.processedAt || proof.processingState !== "processed" || proof.environment !== event.environment
        || event.environment !== require("./wompiService").getExpectedEventEnvironment()
        || proof.transactionId !== event.transactionId || (event.order && String(event.order) !== String(order._id))
        || proof.status !== "APPROVED" || tx.id !== event.transactionId || tx.status !== "APPROVED" || voided
        || tx.amount_in_cents !== proof.amountInCents || tx.currency !== proof.currency || tx.payment_link_id !== proof.paymentLinkId
        || order.paymentMethod !== "wompi" || order.paymentStatus !== "pagado" || order.wompi?.status !== "APPROVED"
        || order.wompi?.transactionId !== proof.transactionId || order.wompi?.paymentLinkId !== proof.paymentLinkId
        || proof.currency !== "COP" || proof.amountInCents !== Math.round(order.total * 100)
        || !require("./orderReadiness").canFulfill(order) || ["cancelado", "devuelto", "rechazado"].includes(order.orderStatus)) {
      throw new AppError("El pago o el pedido todavía requiere gestión financiera; seguimiento abierto", 409);
    }
    // A real write serializes this decision with order/payment mutations. No financial field changes.
    await Order.updateOne({ _id: order._id }, { $inc: { __v: 1 } }, { session, timestamps: false });
    const previous = event.administrativeArchive.toObject();
    event.administrativeArchive.financialFollowUp = false;
    event.administrativeArchive.concludedAt = new Date(); event.administrativeArchive.concludedBy = actor.id;
    event.administrativeArchive.conclusionReason = reason; event.administrativeArchive.conclusionCheckedAt = new Date();
    await event.save({ session });
    await audit(event, actor, "payment_event_follow_up_concluded", previous, session);
  });
};
