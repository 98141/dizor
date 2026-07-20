const catchAsync = require("../utils/catchAsync");
const AppError   = require("../utils/AppError");
const Order      = require("../models/order");
const Coupon     = require("../models/coupon");
const {
  isNequiConfigured,
  createNequiCharge,
  getChargeStatus,
  verifyWebhookSignature,
  mapNequiStatus,
  normalizePhone,
} = require("../services/nequiPaymentService");
const { deductOrderStock } = require("../services/orderService");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pushStatusHistory = (order, status, note) => {
  order.statusHistory.push({ status, note: note || "", changedAt: new Date() });
};

const ORDER_PENDING_STATUSES  = ["pendiente", "pago_pendiente"];
const ORDER_TERMINAL_STATUSES = ["cancelado", "entregado", "devuelto"];

// Marca la orden como pagada: descuenta stock, consume cupón, actualiza estados.
// Diseñado para ser idempotente: cada guard verifica antes de actuar.
const approveOrder = async (order, source) => {
  if (order.paymentStatus === "pagado") return; // ya procesado

  if (!order.stockDeducted) {
    try {
      await deductOrderStock(order.items, {
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
      order.stockDeducted = true;
    } catch {
      pushStatusHistory(
        order,
        order.orderStatus,
        "ALERTA: Pago Nequi aprobado pero stock insuficiente. Revisión manual requerida."
      );
      await order.save();
      return; // dejar para revisión manual
    }
  }

  if (order.couponCode && !order.couponConsumed) {
    await Coupon.findOneAndUpdate(
      {
        code: order.couponCode,
        isActive: true,
        $or: [
          { maxUses: null },
          { $expr: { $lt: ["$usedCount", "$maxUses"] } },
        ],
      },
      { $inc: { usedCount: 1 } }
    );
    order.couponConsumed = true;
  }

  order.paymentStatus     = "pagado";
  order.paymentConfirmedAt = new Date();
  if (ORDER_PENDING_STATUSES.includes(order.orderStatus)) {
    order.orderStatus = "pagado";
    pushStatusHistory(order, "pagado", `Pago Nequi confirmado vía ${source}`);
  }
};

// Marca la orden como rechazada/expirada.
const declineOrder = (order, nequiStatus, source) => {
  if (order.paymentStatus === "pagado") return; // no revertir pagos ya aprobados
  order.paymentStatus = "rechazado";
  if (!ORDER_TERMINAL_STATUSES.includes(order.orderStatus)) {
    order.orderStatus = "cancelado";
    pushStatusHistory(
      order,
      "cancelado",
      `Pago Nequi ${nequiStatus} vía ${source}. Cancelado automáticamente.`
    );
  }
};

// ─── POST /api/payments/nequi/create ─────────────────────────────────────────
// Re-inicia un cobro Nequi para una orden pendiente existente (p.ej. tras expirar).

exports.createNequiPayment = catchAsync(async (req, res, next) => {
  const { orderId, phoneNumber } = req.body;

  if (!orderId)     return next(new AppError("orderId requerido", 400));
  if (!phoneNumber) return next(new AppError("Número de teléfono requerido", 400));

  const normalized = normalizePhone(phoneNumber);
  if (!/^3\d{9}$/.test(normalized)) {
    return next(new AppError("Número Nequi inválido (10 dígitos empezando en 3)", 400));
  }

  if (!isNequiConfigured()) {
    return next(new AppError("Nequi no está configurado en el servidor", 503));
  }

  const order = await Order.findById(orderId);
  if (!order) return next(new AppError("Pedido no encontrado", 404));

  if (order.paymentMethod !== "nequi_api") {
    return next(new AppError("Este pedido no usa Nequi API", 400));
  }
  if (order.paymentStatus === "pagado") {
    return next(new AppError("Este pedido ya fue pagado", 400));
  }
  if (!ORDER_PENDING_STATUSES.includes(order.orderStatus)) {
    return next(new AppError("El pedido no está en estado pendiente de pago", 400));
  }

  let charge;
  try {
    charge = await createNequiCharge(order, normalized);
  } catch (err) {
    return next(new AppError(err.message || "No se pudo enviar el cobro a Nequi", 502));
  }

  order.nequi = {
    paymentToken:       charge.paymentToken,
    reference:          order.orderNumber,
    phoneNumber:        normalized,
    status:             "PENDING",
    chargeInitiatedAt:  new Date(),
  };
  order.orderStatus = "pago_pendiente";
  pushStatusHistory(order, "pago_pendiente", "Cobro Nequi iniciado/reiniciado");
  await order.save();

  res.status(200).json({
    status:      "success",
    message:     "Notificación enviada. Aprueba el pago en tu app Nequi.",
    orderId:     order._id,
    orderNumber: order.orderNumber,
  });
});

// ─── GET /api/payments/nequi/status/:orderId ──────────────────────────────────
// Polling del frontend. Llama a Nequi solo si la orden sigue pendiente.

exports.getNequiStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return next(new AppError("Pedido no encontrado", 404));

  if (order.paymentMethod !== "nequi_api") {
    return next(new AppError("Este pedido no usa Nequi API", 400));
  }

  // Si ya tiene estado terminal, responder con cache sin llamar a Nequi
  const isTerminal = ["pagado", "cancelado", "rechazado", "devuelto"].includes(order.orderStatus);
  if (isTerminal) {
    return res.status(200).json({
      status:        "success",
      paymentStatus: order.paymentStatus,
      orderStatus:   order.orderStatus,
    });
  }

  const paymentToken = order.nequi?.paymentToken;
  if (!paymentToken) {
    return res.status(200).json({
      status:        "success",
      paymentStatus: order.paymentStatus,
      orderStatus:   order.orderStatus,
    });
  }

  // Consultar estado actual en Nequi
  let nequiStatus;
  try {
    const result = await getChargeStatus(paymentToken);
    nequiStatus  = result.status;
  } catch {
    // Si Nequi no responde, devolvemos el estado guardado sin modificar la orden
    return res.status(200).json({
      status:        "success",
      paymentStatus: order.paymentStatus,
      orderStatus:   order.orderStatus,
    });
  }

  const mapped = mapNequiStatus(nequiStatus);

  // Actualizar estado de la orden según respuesta de Nequi
  if (mapped === "approved") {
    await approveOrder(order, "polling");
    order.nequi.status = nequiStatus;
    await order.save();
  } else if (mapped === "declined" || mapped === "expired") {
    declineOrder(order, nequiStatus, "polling");
    order.nequi.status = nequiStatus;
    await order.save();
  }

  res.status(200).json({
    status:        "success",
    paymentStatus: order.paymentStatus,
    orderStatus:   order.orderStatus,
    nequiStatus,
  });
});

// ─── POST /api/payments/nequi/webhook ─────────────────────────────────────────
// Recibe notificaciones push de Nequi cuando el usuario aprueba/rechaza el cobro.

exports.handleNequiWebhook = catchAsync(async (req, res) => {
  const signatureHeader = req.headers["x-nequi-signature"];
  const rawBody         = req.rawBody || JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    return res.status(401).json({ status: "fail", message: "Firma inválida" });
  }

  // Nequi usa JSONRPC 2.0. La notificación puede venir en result.value o params.value.
  const payload    = req.body;
  const value      = payload?.result?.value || payload?.params?.value;
  if (!value) return res.status(200).send("OK");

  const nequiStatus  = value?.statusCode;
  const paymentToken = value?.paymentToken;
  const reference    = value?.reference; // orderNumber que enviamos al crear el cobro

  if (!paymentToken && !reference) return res.status(200).send("OK");

  const order = await Order.findOne({
    $or: [
      { "nequi.paymentToken": paymentToken },
      { orderNumber: reference },
    ],
  });

  if (!order) return res.status(200).send("OK");
  if (order.paymentMethod !== "nequi_api") return res.status(200).send("OK");

  const mapped = mapNequiStatus(nequiStatus);

  if (mapped === "approved") {
    await approveOrder(order, "webhook");
  } else if (mapped === "declined" || mapped === "expired") {
    declineOrder(order, nequiStatus, "webhook");
  }

  if (nequiStatus) {
    order.nequi = { ...order.nequi?.toObject?.() || {}, status: nequiStatus };
  }

  await order.save();
  res.status(200).send("OK");
});
