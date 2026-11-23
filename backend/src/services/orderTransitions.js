const AppError = require("../utils/AppError");
const { isAdmin, isStaff } = require("../utils/orderPermissions");
const { canFulfill } = require("./orderReadiness");

const next = {
  pendiente: ["en_preparacion", "cancelado"],
  pago_pendiente: ["en_preparacion", "cancelado"],
  pagado: ["en_preparacion", "cancelado"], // legacy operational label; paymentStatus remains authoritative
  en_preparacion: ["enviado", "cancelado"],
  enviado: ["entregado", "devuelto"],
  entregado: ["devuelto"],
  rechazado: ["cancelado"],
  cancelado: [], devuelto: [],
};
exports.assertTransition = (order, status, role) => {
  if (!isStaff(role)) throw new AppError("No autorizado", 403);
  if (role === "vendedor" && !["en_preparacion", "enviado", "entregado"].includes(status)) {
    throw new AppError("El vendedor solo puede actualizar estados operativos autorizados", 403);
  }
  if (status === order.orderStatus) return;
  if (!next[order.orderStatus]?.includes(status)) throw new AppError("Transición de pedido no permitida", 409);
  if (["en_preparacion", "enviado"].includes(status)) {
    if (order.paymentMethod !== "contra_entrega" && order.paymentStatus !== "pagado") {
      throw new AppError("Se requiere pago verificado antes de preparar o enviar", 409);
    }
    if (!canFulfill(order)) throw new AppError("El pedido requiere conciliación de pago o inventario", 409);
  }
  if (status === "enviado" && (!order.carrier?.trim() || !order.trackingNumber?.trim())) {
    throw new AppError("Debes registrar transportadora y guía antes de enviar", 400);
  }
};
exports.allowedTransitions = (order, role) => (next[order.orderStatus] || []).filter((status) => {
  try {
    // Shipping form supplies tracking before it asks for this transition.
    exports.assertTransition({ ...order, carrier: order.carrier || "pendiente", trackingNumber: order.trackingNumber || "pendiente" }, status, role);
    return true;
  } catch { return false; }
});
exports.canSelfCancel = (order) => ["pendiente", "pago_pendiente"].includes(order.orderStatus)
  // A Link can have another in-flight transaction even after a decline/expiry.
  // Until the provider can prove closure, electronic cancellation needs staff review.
  && order.paymentMethod === "contra_entrega"
  && order.paymentStatus !== "pagado" && order.paymentStatus !== "reembolsado";
exports.assertCollection = (order, role, evidence) => {
  if (!isAdmin(role)) throw new AppError("Solo administradores pueden confirmar recaudos", 403);
  if (order.paymentMethod !== "contra_entrega") throw new AppError("Los pagos electrónicos solo se confirman con evidencia del proveedor", 409);
  if (order.orderStatus !== "entregado") throw new AppError("El recaudo requiere entrega confirmada", 409);
  if (order.paymentStatus === "reembolsado") throw new AppError("El pago histórico requiere conciliación administrativa", 409);
  if (typeof evidence.reference !== "string" || !evidence.reference.trim() || typeof evidence.receivedAt !== "string" || !Number.isFinite(new Date(evidence.receivedAt).getTime()) || new Date(evidence.receivedAt) > new Date()) {
    throw new AppError("Registra referencia de recaudo y fecha válida, no futura", 400);
  }
};
