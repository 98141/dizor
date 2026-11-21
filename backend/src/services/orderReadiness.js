// Shared predicates for operational queries and protected transitions.
exports.fulfillmentFilter = () => ({
  stockDeducted: true, requiresReview: { $ne: true },
  incidents: { $not: { $elemMatch: { resolvedAt: null } } },
  checkoutState: { $nin: ["processing", "failed"] },
  $or: [{ paymentMethod: "contra_entrega" }, { paymentStatus: "pagado" }],
});
exports.hasActiveIncident = (order) => !!order.requiresReview || (order.incidents || []).some((i) => !i.resolvedAt);
exports.canFulfill = (order) => order.stockDeducted === true && !exports.hasActiveIncident(order)
  && !["processing", "failed"].includes(order.checkoutState)
  && (order.paymentMethod === "contra_entrega" || order.paymentStatus === "pagado");
