const Order = require("../models/order");
const AppError = require("../utils/AppError");
const { isAdmin } = require("../utils/orderPermissions");
const { allowedTransitions } = require("./orderTransitions");
const { fulfillmentFilter, hasActiveIncident, canFulfill } = require("./orderReadiness");
const { communicationFailureFilter } = require("./communicationCriteria");

const INITIAL = ["pendiente", "pago_pendiente", "pagado"];
const FINAL = ["cancelado", "devuelto", "rechazado"];
exports.TRAYS = { prepare: "Por preparar", dispatch: "Por despachar", transit: "En camino",
  collection: "Pendientes de recaudo", review: "Requieren revisión", all: "Todos", communications: "Comunicaciones por revisar" };
const reviewFilter = () => ({ $or: [
  { requiresReview: true }, { incidents: { $elemMatch: { resolvedAt: null } } },
  { orderStatus: { $nin: FINAL }, checkoutState: { $in: ["processing", "failed"] } },
  { orderStatus: { $in: [...INITIAL, "en_preparacion"] }, stockDeducted: { $ne: true },
    $or: [{ paymentMethod: "contra_entrega" }, { paymentStatus: "pagado" }] },
] });
exports.trayFilter = (tray) => ({
  prepare: { orderStatus: { $in: INITIAL }, ...fulfillmentFilter() },
  dispatch: { orderStatus: "en_preparacion", ...fulfillmentFilter() },
  transit: { orderStatus: "enviado" },
  collection: { orderStatus: "entregado", paymentMethod: "contra_entrega", paymentStatus: "pendiente" },
  review: reviewFilter(), all: {}, communications: { "communicationFailures.0": { $exists: true } },
})[tray];
exports.needsReview = (order) => hasActiveIncident(order) || (!FINAL.includes(order.orderStatus)
  && ["processing", "failed"].includes(order.checkoutState))
  || ([...INITIAL, "en_preparacion"].includes(order.orderStatus) && !order.stockDeducted
    && (order.paymentMethod === "contra_entrega" || order.paymentStatus === "pagado"));
const INCIDENT_LABELS = {
  approved_without_stock: "Pago recibido sin inventario disponible", approved_after_cancellation: "Pago recibido después del cierre",
  payment_amount_or_currency_mismatch: "Monto o moneda pendientes de conciliación", additional_approved_payment: "Pago aprobado adicional",
  payment_processing_failed: "Aplicación del pago pendiente de recuperación", received_payment_pending_resolution: "Dinero recibido pendiente de tratamiento",
  cancelled_wompi_watch: "Vigilar pagos posteriores a la cancelación", cancellation_verification_pending: "Verificar el pago antes de cancelar",
  payment_link_creation_failed: "Enlace de pago pendiente de revisión", checkout_completion_failed: "Registro del pedido incompleto",
  approval_on_refunded_order: "Pago recibido sobre un reembolso histórico", coupon_reconciliation: "Cupón pendiente de conciliación",
};
exports.operationalActions = (order, role) => {
  order = order.toObject ? order.toObject() : order;
  const admin = isAdmin(role);
  const transitions = allowedTransitions(order, role);
  const canReconcile = admin && order.paymentMethod === "wompi" && !!order.wompi?.transactionId;
  const canCollect = admin && order.orderStatus === "entregado" && order.paymentMethod === "contra_entrega" && order.paymentStatus === "pendiente";
  const review = exports.needsReview(order);
  const reasons = (order.incidents || []).filter((i) => !i.resolvedAt).map((i) => INCIDENT_LABELS[i.code] || "Incidencia administrativa pendiente");
  if (review && !reasons.length) reasons.push(order.stockDeducted ? "Registro del pedido pendiente de revisión" : "Verificar inventario y registro del pedido antes de continuar");
  let primary;
  if (review) primary = { code: "review", label: "Requiere revisión", description: reasons.join(". ") };
  else if (FINAL.includes(order.orderStatus)) primary = { code: "closed", label: "Pedido cerrado", description: "Consulta el estado final y su historial." };
  else if (transitions.includes("en_preparacion")) primary = { code: "prepare", label: "Comenzar preparación", description: order.paymentMethod === "contra_entrega" ? "El recaudo se registra por separado, después de la entrega." : "Pago verificado. Puedes iniciar la preparación." };
  else if (order.orderStatus === "en_preparacion" && transitions.includes("enviado")) primary = { code: "dispatch", label: "Registrar envío y despachar", description: "Registra transportadora y guía en una sola operación." };
  else if (order.orderStatus === "enviado" && transitions.includes("entregado")) primary = { code: "deliver", label: "Registrar entrega", description: "Confirma la entrega. Esta acción no registra recaudo." };
  else if (canCollect) primary = { code: "collect", label: "Registrar recaudo", description: "Registra la confirmación o giro de la transportadora. No depende solo de la entrega." };
  else if (order.orderStatus === "entregado" && order.paymentMethod === "contra_entrega" && order.paymentStatus === "pendiente") primary = { code: "waiting_collection", label: "Pendiente de recaudo", description: "Un administrador debe registrar la confirmación de la transportadora." };
  else if (order.paymentMethod === "wompi" && order.paymentStatus !== "pagado") primary = { code: "waiting_payment", label: "Esperando confirmación del pago", description: "La preparación requiere verificación de Wompi. El pedido no se cancela por antigüedad." };
  else primary = { code: "complete", label: "Sin acciones operativas pendientes", description: "Consulta los datos y las comunicaciones del pedido." };
  return { primary, requiresReview: review, reasons, canReconcile, canCollect,
    canCancel: transitions.includes("cancelado"), canReturn: transitions.includes("devuelto"),
    canCorrectShipping: order.orderStatus === "enviado" && !review && canFulfill(order) && transitions.includes("entregado") };
};

// Date-only filters are Colombian civil dates; timestamps must carry an offset.
exports.dateBoundary = (value, end = false) => {
  if (typeof value !== "string") throw new AppError("Fecha inválida", 400);
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    d = new Date(`${value}T00:00:00-05:00`);
    if (!Number.isFinite(+d) || new Date(+d - 5 * 3600000).toISOString().slice(0, 10) !== value) throw new AppError("Fecha inválida", 400);
    if (end) d = new Date(+d + 86400000);
  } else {
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new AppError("La fecha debe indicar zona horaria", 400);
    d = new Date(value);
    if (!Number.isFinite(+d)) throw new AppError("Fecha inválida", 400);
    // Timestamp bounds retain their former inclusive meaning.
    if (end) d = new Date(+d + 1);
  }
  return d;
};
exports.bogotaPeriod = (now = new Date()) => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { today: exports.dateBoundary(day), tomorrow: exports.dateBoundary(day, true), monthStart: exports.dateBoundary(`${day.slice(0, 7)}-01`) };
};
const firstHistoryDate = (status) => ({ $min: { $map: {
  input: { $filter: { input: { $ifNull: ["$statusHistory", []] }, as: "h", cond: { $eq: ["$$h.status", status] } } }, as: "h", in: "$$h.changedAt",
} } });
exports.countDispatches = async (from, to) => {
  // Guide corrections also have status=enviado in historical statusHistory.
  // The first recorded dispatch is the event, subsequent notes are not a sale
  // or a new dispatch. Never use updatedAt as evidence of a physical shipment.
  const [result] = await Order.aggregate([
    { $match: { "statusHistory.status": "enviado" } },
    { $project: { firstDispatch: firstHistoryDate("enviado") } },
    { $match: { firstDispatch: { $gte: from, $lt: to } } }, { $count: "total" },
  ]);
  return result?.total || 0;
};
exports.countDeliveries = async (from, to) => {
  const [result] = await Order.aggregate([
    { $project: { deliveryDate: { $ifNull: ["$deliveredAt", firstHistoryDate("entregado")] } } },
    { $match: { deliveryDate: { $gte: from, $lt: to } } }, { $count: "total" },
  ]);
  return result?.total || 0;
};
exports.baseFilter = (query) => {
  const filter = {};
  const enums = { orderStatus: [...INITIAL, "en_preparacion", "enviado", "entregado", ...FINAL],
    paymentStatus: ["pendiente", "pagado", "rechazado", "reembolsado"],
    paymentMethod: ["wompi", "contra_entrega", "nequi_manual", "nequi_api", "efectivo", "nequi_presencial", "tarjeta", "transferencia"],
    carrier: ["servientrega", "interrapidisimo", "envia", "coordinadora"], source: ["web", "manual", "pos"] };
  for (const [key, values] of Object.entries(enums)) if (query[key]) {
    if (typeof query[key] !== "string" || !values.includes(query[key])) throw new AppError("Filtro inválido", 400);
    filter[key] = query[key];
  }
  if (query.q) {
    if (typeof query.q !== "string" || query.q.length > 160) throw new AppError("Búsqueda inválida", 400);
    const q = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (q) filter.$or = ["orderNumber", "buyer.name", "buyer.email", "buyer.phone"].map((key) => ({ [key]: { $regex: q, $options: "i" } }));
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = exports.dateBoundary(query.from);
    if (query.to) filter.createdAt.$lt = exports.dateBoundary(query.to, true);
    if (filter.createdAt.$gte >= filter.createdAt.$lt) throw new AppError("El intervalo de fechas no es válido", 400);
  }
  return filter;
};
exports.listDTO = (order, role) => ({
  id: order._id, orderNumber: order.orderNumber, buyer: order.buyer, total: order.total,
  paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus,
  carrier: order.carrier, trackingNumber: order.trackingNumber, isGuest: order.isGuest,
  source: order.source || "web", channelOrigin: order.channelOrigin || "", shippingRequired: order.shippingRequired !== false,
  createdAt: order.createdAt, itemCount: order.items?.length || 0, requiresReview: exports.needsReview(order),
  operation: exports.operationalActions(order, role), communicationFailure: isAdmin(role) && !!order.communicationFailures?.length,
});
exports.queryWorkspace = async (query = {}, role = "admin") => {
  const tray = query.tray || "all";
  if (!Object.hasOwn(exports.TRAYS, tray)) throw new AppError("Bandeja inválida", 400);
  const admin = isAdmin(role);
  if (tray === "communications" && !admin) throw new AppError("Bandeja reservada a administradores", 403);
  for (const key of ["page", "limit"]) if (query[key] !== undefined &&
    !/^\d{1,7}$/.test(String(query[key]))) throw new AppError("Paginación inválida", 400);
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.max(1, Math.min(50, Math.floor(Number(query.limit) || 15)));
  const pipeline = [{ $match: exports.baseFilter(query) }];
  if (admin) pipeline.push({ $lookup: { from: "notifications", localField: "_id", foreignField: "order",
    pipeline: [{ $match: communicationFailureFilter() }, { $limit: 1 }, { $project: { _id: 1 } }], as: "communicationFailures" } });
  const trays = Object.keys(exports.TRAYS).filter((key) => admin || key !== "communications");
  const facets = Object.fromEntries(trays.map((key) => [key, [{ $match: exports.trayFilter(key) }, { $count: "total" }]]));
  facets.rows = [{ $match: exports.trayFilter(tray) }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
    { $project: { orderNumber: 1, buyer: 1, total: 1, paymentMethod: 1, paymentStatus: 1, orderStatus: 1, carrier: 1, trackingNumber: 1,
      isGuest: 1, source: 1, channelOrigin: 1, shippingRequired: 1, createdAt: 1, "items._id": 1, requiresReview: 1, stockDeducted: 1,
      checkoutState: 1, incidents: 1, "wompi.transactionId": 1, communicationFailures: 1 } }];
  pipeline.push({ $facet: facets });
  const [result] = await Order.aggregate(pipeline);
  const counts = Object.fromEntries(trays.map((key) => [key, result[key][0]?.total || 0]));
  return { status: "success", results: result.rows.length, total: counts[tray], page, totalPages: Math.max(1, Math.ceil(counts[tray] / limit)),
    tray, counts, orders: result.rows.map((o) => exports.listDTO(o, role)) };
};
