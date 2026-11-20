// A received payment is not necessarily a reconciled sale. Keep this criterion
// shared by reports, charts, dashboard totals and the reports used for exports.
exports.reconciledSalesFilter = (dateFilter = {}) => ({
  ...dateFilter,
  paymentStatus: "pagado",
  orderStatus: { $nin: ["cancelado", "rechazado", "devuelto"] },
  requiresReview: { $ne: true },
  // Also protect against an active incident whose summary flag is stale.
  // `null` matches legacy incidents without a resolution timestamp as well.
  incidents: { $not: { $elemMatch: { resolvedAt: null } } },
});
