const Order = require("../models/order");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  isAdmin,
  canUpdateOrderStatus,
  canConfirmPayment,
} = require("../utils/orderPermissions");

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
  createdAt: order.createdAt,
  itemCount: order.items?.length || 0,
});

const pushStatusHistory = (order, status, note, userId) => {
  order.statusHistory.push({
    status,
    note: note || "",
    changedBy: userId || null,
    changedAt: new Date(),
  });
};

exports.getOrderStats = catchAsync(async (req, res) => {
  const [total, pendingPayment, toPrepare, shippedToday] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({
      paymentStatus: "pendiente",
      orderStatus: { $nin: ["cancelado", "rechazado"] },
    }),
    Order.countDocuments({ orderStatus: "pagado" }),
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

  if (req.query.q?.trim()) {
    const q = req.query.q.trim();
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

  res.status(200).json({
    status: "success",
    order,
  });
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { orderStatus, note } = req.body;

  if (!orderStatus) {
    return next(new AppError("El estado del pedido es obligatorio", 400));
  }

  if (!canUpdateOrderStatus(req.user.role, orderStatus)) {
    return next(
      new AppError("No tienes permiso para asignar este estado", 403)
    );
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  if (["cancelado", "entregado", "devuelto"].includes(order.orderStatus)) {
    return next(
      new AppError("No se puede modificar un pedido en estado final", 400)
    );
  }

  const previousStatus = order.orderStatus;
  order.orderStatus = orderStatus;
  pushStatusHistory(order, orderStatus, note, req.user.id);

  if (orderStatus === "enviado" && order.paymentStatus === "pendiente") {
    order.paymentStatus = "pagado";
  }

  await order.save();

  safeLog(
    logAuditEvent({
      req,
      action: "order_status_changed",
      module: "orders",
      user: req.user,
      entityId: order._id,
      entityType: "order",
      summary: `Pedido ${order.orderNumber}: ${previousStatus} → ${orderStatus}`,
      previousData: { status: previousStatus },
      newData: { status: orderStatus, orderNumber: order.orderNumber },
    })
  );

  res.status(200).json({
    status: "success",
    message: "Estado actualizado",
    order: formatOrderList(order),
  });
});

exports.confirmPayment = catchAsync(async (req, res, next) => {
  if (!canConfirmPayment(req.user.role)) {
    return next(new AppError("No autorizado", 403));
  }

  const { paymentProofUrl, note } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  if (order.paymentStatus === "pagado") {
    return next(new AppError("El pago ya fue confirmado", 400));
  }

  order.paymentStatus = "pagado";
  order.paymentProofUrl = paymentProofUrl || order.paymentProofUrl;
  order.paymentConfirmedAt = new Date();
  order.paymentConfirmedBy = req.user.id;

  if (order.orderStatus === "pago_pendiente" || order.orderStatus === "pendiente") {
    order.orderStatus = "pagado";
    pushStatusHistory(order, "pagado", note || "Pago confirmado", req.user.id);
  } else {
    pushStatusHistory(
      order,
      order.orderStatus,
      note || "Pago confirmado",
      req.user.id
    );
  }

  await order.save();

  safeLog(
    logAuditEvent({
      req,
      action: "payment_confirmed",
      module: "orders",
      user: req.user,
      entityId: order._id,
      entityType: "order",
      summary: `Pago confirmado · ${order.orderNumber}`,
      newData: {
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
      },
    })
  );

  res.status(200).json({
    status: "success",
    message: "Pago confirmado correctamente",
    order: formatOrderList(order),
  });
});

exports.updateShipping = catchAsync(async (req, res, next) => {
  const { carrier, trackingNumber, shippingNotes } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  if (carrier) order.carrier = carrier;
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (shippingNotes !== undefined) order.shippingNotes = shippingNotes;

  if (trackingNumber && order.orderStatus === "en_preparacion") {
    order.orderStatus = "enviado";
    pushStatusHistory(
      order,
      "enviado",
      `Guía registrada: ${trackingNumber}`,
      req.user.id
    );
  }

  await order.save();

  safeLog(
    logAuditEvent({
      req,
      action: "tracking_registered",
      module: "orders",
      user: req.user,
      entityId: order._id,
      entityType: "order",
      summary: `Guía ${trackingNumber || "—"} · ${order.orderNumber}`,
      newData: { orderNumber: order.orderNumber, trackingNumber },
    })
  );

  res.status(200).json({
    status: "success",
    message: "Información de envío actualizada",
    order: formatOrderList(order),
  });
});

exports.exportOrdersPdf = catchAsync(async (req, res) => {
  const PDFDocument = require("pdfkit");

  const filter = {};
  if (req.query.orderStatus) filter.orderStatus = req.query.orderStatus;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.q?.trim()) {
    const q = req.query.q.trim();
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
