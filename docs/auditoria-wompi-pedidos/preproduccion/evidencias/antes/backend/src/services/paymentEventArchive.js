const mongoose = require("mongoose");
const PaymentEvent = require("../models/paymentEvent");
const AuditLog = require("../models/AuditLog");
const AppError = require("../utils/AppError");
const { inTransaction } = require("./transactionService");

exports.filter = view => view === "financial-follow-up"
  ? { "administrativeArchive.active": true, "administrativeArchive.financialFollowUp": true }
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
    summary: action === "payment_event_archived" ? "Archivo administrativo; seguimiento financiero abierto" : "Reapertura de evidencia de pago", success: true }], { session });
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
