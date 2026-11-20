const Order = require("../models/order");
const AppError = require("../utils/AppError");
const { inTransaction } = require("./transactionService");
const { moveStock } = require("./inventoryService");
const rules = require("./orderTransitions");

exports.addIncident = (order, code, detail = "") => {
  if (!order.incidents.some((i) => i.code === code && i.detail === detail && !i.resolvedAt)) order.incidents.push({ code, detail, createdAt: new Date() });
  order.requiresReview = true;
};
exports.history = (order, note, user) => order.statusHistory.push({
  status: order.orderStatus, note, changedBy: user?.id || null, changedAt: new Date(),
});
exports.mutateOrder = (id, work) => inTransaction(async (session) => {
  const order = await Order.findById(id).session(session);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  const result = await work(order, session);
  await order.save({ session, validateModifiedOnly: true });
  return { order, ...result };
});
exports.transition = async (order, status, user, note, session) => {
  rules.assertTransition(order, status, user.role);
  if (order.orderStatus === status) return false;
  if (["cancelado", "devuelto"].includes(status) && order.stockDeducted) {
    await moveStock(order.items, 1, { orderId: order._id, orderNumber: order.orderNumber, user }, session);
    order.stockDeducted = false;
  }
  order.orderStatus = status;
  if (status === "entregado") {
    order.deliveredAt = new Date(); order.deliveredBy = user.id;
  }
  if (["cancelado", "devuelto"].includes(status) && order.paymentStatus === "pagado") {
    exports.addIncident(order, "received_payment_pending_resolution", "Dinero recibido: tratamiento administrativo pendiente, sin reembolso automático");
  }
  if (status === "cancelado" && order.paymentMethod === "wompi" && order.paymentStatus !== "pagado") {
    exports.addIncident(order, "cancelled_wompi_watch", "Vigilar aprobación tardía del proveedor");
  }
  exports.history(order, note || `Estado actualizado: ${status}`, user);
  return true;
};
