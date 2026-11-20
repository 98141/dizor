const Order = require("../models/order");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  isAdmin,
  canConfirmPayment,
} = require("../utils/orderPermissions");
const { mutateOrder, transition, history } = require("../services/orderOperations");
const { allowedTransitions, assertCollection } = require("../services/orderTransitions");

const formatOrderList = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  buyer: order.buyer,
  total: order.total,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  carrier: order.carrier,
  trackingNumber: order.trackingNumber,
  isGuest: order.isGuest,
  source: order.source || "web",
  channelOrigin: order.channelOrigin || "",
  shippingRequired: order.shippingRequired !== false,
  createdAt: order.createdAt,
  itemCount: order.items?.length || 0,
  requiresReview: !!order.requiresReview,
});

exports.getOrderStats = catchAsync(async (req, res) => {
  const [total, pendingPayment, toPrepare, shippedToday] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({
      paymentStatus: "pendiente",
      paymentMethod: "wompi",
      orderStatus: { $nin: ["cancelado", "rechazado"] },
    }),
    Order.countDocuments({ requiresReview: { $ne: true }, stockDeducted: true, $or: [{ orderStatus: "pagado", paymentStatus: "pagado" }, { orderStatus: "pendiente", paymentMethod: "contra_entrega" }] }),
    Order.countDocuments({
      orderStatus: "enviado",
      updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  res.status(200).json({
    status: "success",
    stats: {
      total,
      pendingPayment,
      toPrepare,
      shippedToday,
    },
  });
});

exports.getOrders = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.orderStatus) filter.orderStatus = req.query.orderStatus;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;
  if (req.query.source) filter.source = req.query.source;

  if (req.query.q?.trim()) {
    const q = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { orderNumber: { $regex: q, $options: "i" } },
      { "buyer.name": { $regex: q, $options: "i" } },
      { "buyer.email": { $regex: q, $options: "i" } },
      { "buyer.phone": { $regex: q, $options: "i" } },
    ];
  }

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    status: "success",
    results: orders.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    orders: orders.map(formatOrderList),
  });
});

exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "assignedTo",
    "name email role"
  );

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  const dto = order.toObject();
  if (!isAdmin(req.user.role)) for (const item of dto.items) delete item.unitCost;
  dto.allowedTransitions = allowedTransitions(dto, req.user.role);
  dto.canConfirmCollection = isAdmin(req.user.role) && dto.paymentMethod === "contra_entrega"
    && dto.orderStatus === "entregado" && dto.paymentStatus === "pendiente";
  dto.canUpdateShipping = ["en_preparacion", "enviado"].includes(dto.orderStatus)
    && !dto.requiresReview && (dto.paymentMethod === "contra_entrega" || dto.paymentStatus === "pagado");
  res.status(200).json({ status: "success", order: dto });
});

exports.updateOrderStatus = catchAsync(async (req, res) => {
  const { order, changed } = await mutateOrder(req.params.id, async (order, session) => {
    const changed = await transition(order, req.body.orderStatus, req.user, req.body.note, session);
    return { changed };
  });
  if (changed) safeLog(logAuditEvent({ req, user: req.user, action: "order_status_changed", module: "orders",
    entityId: order._id, entityType: "order", summary: `Pedido ${order.orderNumber}: ${order.orderStatus}` }));
  res.status(200).json({ status: "success", message: "Estado actualizado", order: formatOrderList(order) });
});

exports.confirmPayment = catchAsync(async (req, res) => {
  const { order, changed } = await mutateOrder(req.params.id, async (order) => {
    // Check role and method even on retries; payment is never an operational transition.
    if (!canConfirmPayment(req.user.role)) throw new AppError("Solo administradores pueden registrar recaudos", 403);
    if (order.paymentMethod !== "contra_entrega") throw new AppError("Wompi no admite confirmación manual", 409);
    if (["cancelado", "devuelto", "rechazado"].includes(order.orderStatus)) throw new AppError("Pedido cerrado", 409);
    if (order.paymentStatus === "pagado") return;
    assertCollection(order, req.user.role, req.body);
    order.collection = { receivedAt: new Date(req.body.receivedAt), recordedAt: new Date(),
      reference: req.body.reference.trim(), proofUrl: req.body.paymentProofUrl || "", recordedBy: req.user.id };
    order.paymentStatus = "pagado";
    order.paymentConfirmedAt = new Date(); order.paymentConfirmedBy = req.user.id;
    order.paymentProofUrl = req.body.paymentProofUrl || "";
    history(order, `Recaudo confirmado: ${order.collection.reference}`, req.user);
    return { changed: true };
  });
  if (changed) safeLog(logAuditEvent({ req, user: req.user, action: "payment_confirmed", module: "orders",
    entityId: order._id, entityType: "order", summary: `Recaudo registrado · ${order.orderNumber}` }));
  res.status(200).json({ status: "success", message: "Recaudo registrado", order: formatOrderList(order) });
});

exports.updateShipping = catchAsync(async (req, res) => {
  const { order } = await mutateOrder(req.params.id, async (order, session) => {
    if (!["en_preparacion", "enviado"].includes(order.orderStatus) || order.requiresReview
        || (order.paymentMethod !== "contra_entrega" && order.paymentStatus !== "pagado")) {
      throw new AppError("No se puede registrar una guía en este estado", 409);
    }
    const previous = `${order.carrier}|${order.trackingNumber}|${order.shippingNotes}`;
    for (const key of ["carrier", "trackingNumber", "shippingNotes"]) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== "string") throw new AppError("Información de envío inválida", 400);
        order[key] = req.body[key].trim();
      }
    }
    if (!order.carrier || !order.trackingNumber) throw new AppError("Registra transportadora y guía", 400);
    const changed = await transition(order, "enviado", req.user, `Guía registrada: ${order.trackingNumber}`, session);
    if (!changed && previous !== `${order.carrier}|${order.trackingNumber}|${order.shippingNotes}`) history(order, `Guía corregida: ${order.trackingNumber}`, req.user);
    return { changed };
  });
  res.status(200).json({ status: "success", message: "Guía guardada", order: formatOrderList(order) });
});

exports.exportOrdersPdf = catchAsync(async (req, res) => {
  const PDFDocument = require("pdfkit");

  const filter = {};
  if (req.query.orderStatus) filter.orderStatus = req.query.orderStatus;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.q?.trim()) {
    const q = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { orderNumber: { $regex: q, $options: "i" } },
      { "buyer.name": { $regex: q, $options: "i" } },
      { "buyer.email": { $regex: q, $options: "i" } },
    ];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(500);

  const STATUS_ES = {
    pendiente: "Pendiente",
    pago_pendiente: "Pago pendiente",
    pagado: "Pagado",
    en_preparacion: "En preparación",
    enviado: "Enviado",
    entregado: "Entregado",
    cancelado: "Cancelado",
    rechazado: "Rechazado",
    devuelto: "Devuelto",
  };
  const PM_ES = { wompi: "Wompi", nequi_manual: "Nequi", contra_entrega: "Contraentrega" };
  const fmt = (n) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);

    doc.fontSize(16).text("Listado de pedidos — Dizor", { align: "center" });
    doc.fontSize(10).text(
      `Generado: ${new Date().toLocaleString("es-CO")}   Total: ${orders.length} pedido(s)`,
      { align: "center" }
    );
    doc.moveDown(1);

    for (const order of orders) {
      const date = new Date(order.createdAt).toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", year: "numeric",
      });
      doc
        .fontSize(10)
        .text(
          `${order.orderNumber}  ·  ${date}  ·  ${order.buyer.name}  ·  ${STATUS_ES[order.orderStatus] || order.orderStatus}  ·  ${PM_ES[order.paymentMethod] || order.paymentMethod}  ·  ${fmt(order.total)}`
        );
    }

    doc.end();
  });

  const filename = `dizor-pedidos-${Date.now()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.concat(chunks));
});

exports.assignOrder = catchAsync(async (req, res, next) => {
  if (!isAdmin(req.user.role)) {
    return next(new AppError("Solo administradores pueden asignar pedidos", 403));
  }

  const { assignedTo } = req.body;
  if (assignedTo) {
    const User = require("../models/user");
    if (!await User.exists({ _id: assignedTo, isActive: true, role: { $in: ["admin", "superadmin", "vendedor"] } })) {
      throw new AppError("El responsable debe ser personal activo", 400);
    }
  }
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { assignedTo: assignedTo || null },
    { new: true }
  );

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Pedido asignado",
    order: formatOrderList(order),
  });
});

exports.reconcileWompi = catchAsync(async (req, res) => {
  if (!isAdmin(req.user.role)) throw new AppError("Solo administradores pueden conciliar", 403);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.paymentMethod !== "wompi" || !order.wompi?.transactionId) throw new AppError("No hay transacción Wompi consultable", 409);
  const { getTransaction, getExpectedEventEnvironment } = require("../services/wompiService");
  let tx;
  try { tx = await getTransaction(order.wompi.transactionId); }
  catch { throw new AppError("No se pudo consultar a Wompi. Conserva el pedido para revisión.", 503); }
  await require("../services/wompiPaymentService").processTransaction(order._id, tx, { environment: getExpectedEventEnvironment(), reconcile: true });
  res.json({ status: "success", message: "Transacción consultada y conciliada según evidencia del proveedor" });
});

