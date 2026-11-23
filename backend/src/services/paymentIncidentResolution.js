const AppError = require("../utils/AppError");
const PaymentEvent = require("../models/paymentEvent");
const AuditLog = require("../models/AuditLog");
const { mutateOrder, history } = require("./orderOperations");
const { isAdmin } = require("../utils/orderPermissions");

const REFUND = ["additional_approved_payment", "payment_amount_or_currency_mismatch", "received_payment_pending_resolution",
  "approved_after_cancellation", "approval_on_refunded_order", "approved_without_stock"];
exports.decisions = (incident, role) => !isAdmin(role) || incident.resolvedAt ? []
  : incident.code === "coupon_reconciliation" ? ["accept_discount"]
  : ["cancelled_wompi_watch", "cancellation_verification_pending"].includes(incident.code) ? ["acknowledge_closed_watch"]
  : ["payment_link_creation_failed", "checkout_completion_failed"].includes(incident.code) ? ["archive_failed_checkout"]
  : ["payment_voided", "additional_payment_voided"].includes(incident.code) ? ["record_void_review"]
  : REFUND.includes(incident.code) && role === "superadmin" ? ["manual_refund_confirmed"] : [];

exports.resolve = async (id, incidentId, body, user) => {
  if (!isAdmin(user.role)) throw new AppError("Solo administradores pueden resolver incidencias", 403);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 10 || reason.length > 1000) throw new AppError("Registra un motivo de 10 a 1000 caracteres", 400);
  return mutateOrder(id, async (order, session) => {
    const incident = order.incidents.id(incidentId);
    if (!incident) throw new AppError("Incidencia no encontrada", 404);
    if (incident.resolvedAt) throw new AppError("La incidencia ya fue resuelta", 409);
    if (!exports.decisions(incident, user.role).includes(body.decision)) throw new AppError("Decisión no autorizada para esta incidencia", 403);
    const closed = ["cancelado", "devuelto", "rechazado"].includes(order.orderStatus);
    let evidence;
    if (body.decision === "accept_discount") {
      if (order.paymentStatus !== "pagado" || !order.stockDeducted) throw new AppError("Concilia pago e inventario antes de aceptar el descuento", 409);
    } else if (body.decision === "acknowledge_closed_watch") {
      if (!closed || order.paymentStatus === "pagado") throw new AppError("La vigilancia sólo se archiva sobre un pedido cerrado sin pago aplicado", 409);
      // Acknowledges a watch; does not certify absence of future payments.
    } else if (body.decision === "archive_failed_checkout") {
      if (!closed || order.checkoutState !== "failed" || order.paymentStatus === "pagado") throw new AppError("Cierra primero el checkout fallido, conservando su vigilancia financiera", 409);
    } else if (body.decision === "record_void_review") {
      const additional = incident.code === "additional_payment_voided" && order.paymentStatus === "pagado" && order.wompi.transactionId !== incident.detail;
      if (!additional && !closed && !["enviado", "entregado"].includes(order.orderStatus)) throw new AppError("Cierra el pedido o registra la gestión del envío existente antes de archivar la anulación", 409);
      const tx = await require("./wompiService").getTransaction(incident.detail);
      if (tx.status !== "VOIDED" || tx.payment_link_id !== order.wompi.paymentLinkId) throw new AppError("Wompi no confirma la anulación vinculada", 409);
      evidence = { transactionId: tx.id, recordedAt: new Date() };
      if (additional) for (const related of order.incidents) if (!related.resolvedAt && related.code === "additional_approved_payment" && related.detail === tx.id) {
        related.resolvedAt = new Date(); related.resolution = { actor: user.id || user._id, decision: body.decision, reason, evidence };
      }
    } else if (body.decision === "manual_refund_confirmed") {
      if (incident.code !== "additional_approved_payment" && !closed) throw new AppError("Cierra el pedido antes de documentar la devolución manual del pago principal", 409);
      const e = body.evidence || {};
      let url;
      try { url = new URL(e.url); } catch { throw new AppError("Adjunta URL HTTPS de evidencia de la devolución manual", 400); }
      if (url.protocol !== "https:" || url.username || url.password || typeof e.reference !== "string" || e.reference.trim().length < 6
          || e.reference.length > 200 || typeof e.transactionId !== "string" || !Number.isSafeInteger(e.amountInCents)
          || e.currency !== "COP" || !e.recordedAt || !Number.isFinite(+new Date(e.recordedAt)) || new Date(e.recordedAt) > new Date()) throw new AppError("Evidencia estructurada de devolución incompleta", 400);
      const receipt = await PaymentEvent.findOne({ order: order._id, transactionId: e.transactionId, status: "APPROVED",
        environment: require("./wompiService").getExpectedEventEnvironment(), amountInCents: e.amountInCents, currency: e.currency }).session(session);
      if (!receipt || (incident.code === "additional_approved_payment" && incident.detail !== e.transactionId)
          || (incident.code === "payment_amount_or_currency_mismatch" && !incident.detail.startsWith(`${e.transactionId}:`))
          || (["approved_without_stock", "approved_after_cancellation", "approval_on_refunded_order"].includes(incident.code) && incident.detail !== e.transactionId)
          || (["received_payment_pending_resolution"].includes(incident.code) && order.wompi.transactionId !== e.transactionId)) throw new AppError("La evidencia no corresponde al cobro de esta incidencia", 409);
      const used = order.incidents.some(i => i.resolvedAt && i.resolution?.evidence?.reference === e.reference.trim()
        && i.resolution.evidence.transactionId !== e.transactionId);
      if (used) throw new AppError("Referencia de devolución ya utilizada para otro cobro", 409);
      // This is a privileged attestation of an external MANUAL process, not a refund API.
      evidence = { transactionId: e.transactionId, reference: e.reference.trim(), url: url.href,
        amountInCents: e.amountInCents, currency: e.currency, recordedAt: new Date(e.recordedAt) };
      if (order.wompi.transactionId === e.transactionId) order.paymentStatus = "reembolsado";
    }
    incident.resolvedAt = new Date();
    incident.resolution = { actor: user.id || user._id, decision: body.decision, reason, evidence };
    order.requiresReview = order.incidents.some(i => !i.resolvedAt);
    history(order, `Incidencia ${incident.code} (${incident._id}): ${body.decision}. ${reason}. Sin devolución automática.`, user);
    // Required financial audit is in the SAME transaction, never best effort.
    await AuditLog.create([{ userId: user.id || user._id, userEmail: user.email, role: user.role,
      action: "payment_incident_resolved", module: "orders", entityId: order._id, entityType: "order", success: true,
      previousData: { incidentId: incident._id, code: incident.code, detail: incident.detail },
      newData: { decision: body.decision, reason, evidence, resolvedAt: incident.resolvedAt },
      summary: `Resolución auditada de ${incident.code}; proceso manual cuando corresponde` }], { session });
  });
};
