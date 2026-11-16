const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const Order = require("../models/order");
const Cart = require("../models/cart");
const Coupon = require("../models/coupon");
const {
  resolveCartItems,
  calculateTotals,
} = require("../services/cartService");
const { getStoreSettings } = require("../services/settingsService");
const { createOrder, restoreOrderStock } = require("../services/orderService");
const { isWompiConfigured, createPaymentLink } = require("../services/wompiService");
const {
  isNequiConfigured,
  createNequiCharge,
  normalizePhone,
} = require("../services/nequiPaymentService");
const { markAbandonedCartRecovered } = require("../services/marketingService");
const { sendNewOrderAdminEmail } = require("../services/emailService");
const { sendOrderReceiptOnce } = require("../services/orderReceiptService");
const { requireAuthorization, recordConsent } = require("../services/consentService");
const { PURPOSES, getText } = require("../config/legalTexts");
const { issueAccessToken, matchesHash } = require("../utils/opaqueTokens");

// Vigencia del token de acceso del comprador a la confirmación de su pedido
// (H-06). Cubre el retorno desde la pasarela y la consulta inmediata; después,
// el seguimiento se hace con número de pedido + correo o desde la cuenta.
const ORDER_ACCESS_TTL_MS = 72 * 60 * 60 * 1000;

const grantOrderAccess = async (orderId) => {
  const { token, tokenHash } = issueAccessToken();
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        "guestAccess.tokenHash": tokenHash,
        "guestAccess.expiresAt": new Date(Date.now() + ORDER_ACCESS_TTL_MS),
      },
    }
  );
  return token;
};

// Resumen para la página de confirmación: solo lo que el comprador necesita.
// No incluye dirección completa, teléfono, costos internos ni notas de staff.
const formatOrderConfirmation = (order) => ({
  orderNumber: order.orderNumber,
  createdAt: order.createdAt,
  orderStatus: order.orderStatus,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  items: (order.items || []).map((i) => ({
    productName: i.productName,
    sizeName: i.sizeName,
    colorName: i.colorName,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  })),
  subtotal: order.subtotal,
  discountTotal: order.discountTotal,
  couponCode: order.couponCode,
  taxTotal: order.taxTotal,
  ivaPercent: order.ivaPercent,
  shippingCost: order.shippingCost,
  freeShippingApplied: order.freeShippingApplied,
  total: order.total,
  // Se devuelve al titular del token para prellenar el registro opcional
  // (sustituye a guardar el correo en la URL o en sessionStorage).
  buyer: { name: order.buyer?.name || "", email: order.buyer?.email || "" },
  receiptSent: Boolean(order.buyerReceipt?.sentAt),
});

// DTO seguro: nunca expone unitCost, internalCost ni datos administrativos al cliente
const formatOrderForClient = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  orderStatus: order.orderStatus,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  subtotal: order.subtotal,
  discountTotal: order.discountTotal,
  taxTotal: order.taxTotal,
  shippingCost: order.shippingCost,
  total: order.total,
  couponCode: order.couponCode,
  carrier: order.carrier,
  trackingNumber: order.trackingNumber,
  customerNotes: order.customerNotes,
  createdAt: order.createdAt,
  shippingAddress: {
    address: order.shippingAddress?.address,
    city: order.shippingAddress?.city,
    department: order.shippingAddress?.department,
  },
  items: (order.items || []).map((i) => ({
    productName: i.productName,
    productSlug: i.productSlug,
    productImage: i.productImage,
    sizeName: i.sizeName,
    colorName: i.colorName,
    sku: i.sku,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
    customizationNotes: i.customizationNotes,
  })),
  statusHistory: (order.statusHistory || []).map((h) => ({
    status: h.status,
    note: h.note,
    changedAt: h.changedAt,
  })),
});

exports.getCheckoutConfig = catchAsync(async (req, res) => {
  const settings = await getStoreSettings();

  res.status(200).json({
    status: "success",
    config: {
      taxEnabled: settings.taxEnabled,
      taxRate: settings.taxRate,
      shippingMode: settings.shippingMode,
      shippingFixedCost: settings.shippingFixedCost,
      freeShippingMinAmount: settings.freeShippingMinAmount,
      carriers: settings.carriers,
      paymentMethods: [
        ...(isWompiConfigured()
          ? [
              {
                id: "wompi",
                label: "Tarjeta / PSE (Wompi)",
                description: "Pago en línea seguro",
              },
            ]
          : []),
        {
          id: "contra_entrega",
          label: "Pago contra entrega",
          description: "Pagas al recibir tu pedido",
        },
      ],
      departments: [
        "Amazonas",
        "Antioquia",
        "Arauca",
        "Atlántico",
        "Bolívar",
        "Boyacá",
        "Caldas",
        "Caquetá",
        "Casanare",
        "Cauca",
        "Cesar",
        "Chocó",
        "Córdoba",
        "Cundinamarca",
        "Guainía",
        "Guaviare",
        "Huila",
        "La Guajira",
        "Magdalena",
        "Meta",
        "Nariño",
        "Norte de Santander",
        "Putumayo",
        "Quindío",
        "Risaralda",
        "San Andrés",
        "Santander",
        "Sucre",
        "Tolima",
        "Valle del Cauca",
        "Vaupés",
        "Vichada",
      ],
    },
  });
});

exports.calculateCheckout = catchAsync(async (req, res) => {
  const { items, department } = req.body;
  const resolved = await resolveCartItems(items);
  const settings = await getStoreSettings();
  const totals = calculateTotals(resolved, settings, department);

  res.status(200).json({
    status: "success",
    items: resolved,
    totals,
    itemCount: resolved.reduce((s, i) => s + i.quantity, 0),
  });
});

exports.createCheckoutOrder = catchAsync(async (req, res, next) => {
  const {
    items,
    buyer,
    shippingAddress,
    paymentMethod,
    carrier,
    customerNotes,
    couponCode,
    idempotencyKey,
    nequiPhone,
  } = req.body;

  if (!buyer?.name || !buyer?.email || !buyer?.phone) {
    return next(new AppError("Datos del comprador incompletos", 400));
  }

  // Autorización de tratamiento para gestionar el pedido (H-03). Validada en
  // el servidor: solo `true` cuenta.
  requireAuthorization(req.body.privacyAuthorization, PURPOSES.ORDER_PROCESSING);

  if (
    !shippingAddress?.address ||
    !shippingAddress?.city ||
    !shippingAddress?.department
  ) {
    return next(new AppError("Dirección de envío incompleta", 400));
  }

  const validPayments = ["wompi", "nequi_api", "nequi_manual", "contra_entrega"];
  if (!validPayments.includes(paymentMethod)) {
    return next(new AppError("Método de pago inválido", 400));
  }

  // Validar número Nequi antes de crear la orden para no dejar órdenes huérfanas
  if (paymentMethod === "nequi_api") {
    const normalizedNequiPhone = normalizePhone(nequiPhone);
    if (!normalizedNequiPhone || !/^3\d{9}$/.test(normalizedNequiPhone)) {
      return next(new AppError("Número de teléfono Nequi inválido (10 dígitos empezando en 3)", 400));
    }
    if (!isNequiConfigured()) {
      return next(new AppError("Nequi no está configurado en el servidor", 503));
    }
  }

  const resolved = await resolveCartItems(items);
  const settings = await getStoreSettings();
  const totals = calculateTotals(
    resolved,
    settings,
    shippingAddress.department
  );

  // Idempotencia: si ya existe una orden con esta clave, devolverla solo si pertenece al mismo actor
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) {
      const ownerUserId = req.user?.id?.toString() || null;
      const ownerEmail = buyer?.email?.toLowerCase() || "";
      const sameUser = ownerUserId && existing.user?.toString() === ownerUserId;
      const sameEmail = !ownerUserId && existing.buyer?.email === ownerEmail;

      if (sameUser || sameEmail) {
        // Reintento del mismo pedido: no se crea otro ni se reenvía el acuse;
        // se rota el token de acceso (el anterior deja de servir).
        const accessToken = await grantOrderAccess(existing._id);
        return res.status(200).json({
          accessToken,
          status: "success",
          order: {
            id: existing._id,
            orderNumber: existing.orderNumber,
            total: existing.total,
            paymentMethod: existing.paymentMethod,
            orderStatus: existing.orderStatus,
            paymentStatus: existing.paymentStatus,
          },
          paymentUrl: existing.wompi?.paymentLinkUrl || null,
          message: "Pedido ya registrado.",
        });
      }
      // Key no pertenece a este actor: ignorar y continuar (la BD rechazará por unique index)
    }
  }

  // Validar y aplicar cupón (sin consumirlo todavía)
  let appliedCoupon = null;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });

    if (!coupon || !coupon.isActive) {
      return next(new AppError("Este cupón no está disponible o ha expirado", 400));
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return next(new AppError("Este cupón no está disponible o ha expirado", 400));
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return next(new AppError("Este cupón no está disponible o ha expirado", 400));
    }

    if (totals.subtotal < coupon.minOrderAmount) {
      return next(
        new AppError(
          `El pedido mínimo para este cupón es $${coupon.minOrderAmount.toLocaleString("es-CO")}`,
          400
        )
      );
    }

    const discount =
      coupon.type === "percentage"
        ? Math.round(totals.subtotal * (coupon.value / 100))
        : Math.min(coupon.value, totals.subtotal);

    totals.discountTotal = discount;
    totals.total = totals.subtotal - discount + totals.taxTotal + totals.shippingCost;
    appliedCoupon = coupon;
  }

  const isGuest = !req.user;
  // Wompi y Nequi API difieren el descuento de stock hasta que el webhook confirme el pago
  const deductStock = paymentMethod !== "wompi" && paymentMethod !== "nequi_api";

  let order;
  try {
    order = await createOrder({
      user: req.user,
      isGuest,
      buyer,
      shippingAddress,
      items: resolved,
      totals,
      paymentMethod,
      carrier,
      customerNotes,
      couponCode: appliedCoupon?.code || "",
      deductStock,
      idempotencyKey: idempotencyKey || null,
      req,
    });
  } catch (err) {
    return next(new AppError(err.message || "No se pudo crear el pedido", 400));
  }

  // Consumir cupón solo para métodos de pago que no sean Wompi
  // (Wompi lo consume el webhook cuando confirma el pago)
  // Incremento atómico con condición: evita race condition si dos requests
  // concurrentes usan el mismo cupón al mismo tiempo
  if (appliedCoupon && deductStock) {
    const consumed = await Coupon.findOneAndUpdate(
      {
        _id: appliedCoupon._id,
        isActive: true,
        $or: [
          { maxUses: null },
          { $expr: { $lt: ["$usedCount", "$maxUses"] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (!consumed) {
      return next(new AppError("El cupón ya no está disponible.", 400));
    }
    order.couponConsumed = true;
    await order.save({ validateBeforeSave: false });
  }

  if (req.user) {
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { items: [] },
      { upsert: true }
    );
  }

  await markAbandonedCartRecovered(buyer.email, order.orderNumber);

  let paymentUrl = null;

  if (paymentMethod === "wompi") {
    if (!isWompiConfigured()) {
      // Limpiar la orden si Wompi no está configurado
      await Order.findByIdAndDelete(order._id).catch(() => {});
      return next(
        new AppError("Wompi no está configurado en el servidor", 503)
      );
    }
    try {
      const wompi = await createPaymentLink(order);
      order.wompi = {
        paymentLinkId: wompi.paymentLinkId,
        paymentLinkUrl: wompi.paymentLinkUrl,
      };
      await order.save();
      paymentUrl = wompi.paymentLinkUrl;
    } catch (err) {
      await Order.findByIdAndDelete(order._id).catch(() => {});
      return next(
        new AppError(err.message || "No se pudo iniciar el pago con Wompi", 502)
      );
    }
  }

  if (paymentMethod === "nequi_api") {
    const normalizedNequiPhone = normalizePhone(nequiPhone);
    try {
      const charge = await createNequiCharge(order, normalizedNequiPhone);
      order.nequi = {
        paymentToken:      charge.paymentToken,
        reference:         order.orderNumber,
        phoneNumber:       normalizedNequiPhone,
        status:            "PENDING",
        chargeInitiatedAt: new Date(),
      };
      order.orderStatus = "pago_pendiente";
      order.statusHistory.push({
        status:    "pago_pendiente",
        note:      "Cobro Nequi enviado. Esperando aprobación del cliente.",
        changedAt: new Date(),
      });
      await order.save();
    } catch (err) {
      await Order.findByIdAndDelete(order._id).catch(() => {});
      return next(
        new AppError(err.message || "No se pudo iniciar el pago con Nequi", 502)
      );
    }
  }

  // Evidencia de lo aceptado (H-19) y autorización de tratamiento (H-03).
  const privacyText = getText(PURPOSES.ORDER_PROCESSING);
  const termsText = getText(PURPOSES.TERMS);
  order.legal = {
    privacyNoticeVersion: privacyText.version,
    privacyNoticeStatus: privacyText.status,
    // Sin términos aprobados no se registra aceptación de términos (H-17).
    termsVersion: termsText.status === "approved" ? termsText.version : null,
    acceptedAt: new Date(),
  };
  await order.save({ validateBeforeSave: false });
  await recordConsent({
    purpose: PURPOSES.ORDER_PROCESSING,
    subjectEmail: buyer.email,
    userId: req.user?.id || null,
    source: "checkout",
    referenceType: "Order",
    referenceId: order._id,
  });

  const accessToken = await grantOrderAccess(order._id);

  // Acuse de recibo al comprador (H-20): idempotente; un fallo no bloquea el
  // pedido y queda registrado en order.buyerReceipt para reintento.
  await sendOrderReceiptOnce(order._id);

  try {
    await sendNewOrderAdminEmail(order);
  } catch (err) {
    console.error("[Dizor] No se pudo enviar el correo de notificación de pedido:", err.message);
  }

  res.status(201).json({
    accessToken,
    status: "success",
    order: {
      id:            order._id,
      orderNumber:   order.orderNumber,
      total:         order.total,
      paymentMethod: order.paymentMethod,
      orderStatus:   order.orderStatus,
      paymentStatus: order.paymentStatus,
    },
    paymentUrl,
    message:
      paymentMethod === "wompi"
        ? "Pedido creado. Serás redirigido a Wompi para completar el pago."
        : paymentMethod === "nequi_api"
          ? "Pedido creado. Aprueba el pago en tu app Nequi."
          : paymentMethod === "nequi_manual"
            ? "Pedido creado. Envía tu comprobante Nequi por WhatsApp."
            : "Pedido creado. Pagarás al recibir tu pedido.",
  });
});

// Seguimiento por número de pedido + correo. Ahora por POST con cuerpo para
// que el correo no quede en URLs, historial ni logs de acceso (H-06).
exports.trackGuestOrder = catchAsync(async (req, res, next) => {
  const orderNumber = typeof req.body?.orderNumber === "string" ? req.body.orderNumber.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";

  if (!orderNumber || !email) {
    return next(
      new AppError("Número de pedido y correo son obligatorios", 400)
    );
  }

  const order = await Order.findOne({
    orderNumber: orderNumber.toUpperCase(),
    "buyer.email": email.toLowerCase(),
  }).select(
    "orderNumber orderStatus paymentStatus total createdAt items shippingAddress trackingNumber carrier"
  );

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      total: order.total,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      items: order.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      city: order.shippingAddress?.city,
      department: order.shippingAddress?.department,
    },
  });
});

// Ruta antigua GET /track?orderNumber=…&email=…: ya no se procesa para no
// seguir aceptando el correo en la URL. Responde 410 sin leer los parámetros.
exports.trackGuestOrderLegacy = (req, res) => {
  res.status(410).json({
    status: "fail",
    message: "Esta forma de consulta ya no está disponible. Usa el formulario de seguimiento.",
  });
};

/**
 * Confirmación del pedido (H-06, H-20). Acceso permitido solo a:
 *  - el usuario autenticado dueño del pedido, o
 *  - quien presente el token de acceso vigente emitido al crear el pedido.
 * Cualquier otro caso responde 404 genérico (no revela si el pedido existe).
 */
exports.lookupOrderConfirmation = catchAsync(async (req, res, next) => {
  const orderNumber =
    typeof req.body?.orderNumber === "string" ? req.body.orderNumber.trim().toUpperCase() : "";
  const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken : "";

  const notFound = () => next(new AppError("Pedido no encontrado", 404));
  if (!orderNumber) return notFound();

  const order = await Order.findOne({ orderNumber }).select(
    "+guestAccess.tokenHash +guestAccess.expiresAt"
  );
  if (!order) return notFound();

  const isOwner = Boolean(req.user?.id) && order.user?.toString() === String(req.user.id);
  const tokenValid =
    Boolean(accessToken) &&
    order.guestAccess?.expiresAt instanceof Date &&
    order.guestAccess.expiresAt > new Date() &&
    matchesHash(accessToken, order.guestAccess.tokenHash);

  if (!isOwner && !tokenValid) return notFound();

  res.status(200).json({ status: "success", order: formatOrderConfirmation(order) });
});

exports.getMyOrders = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("No autorizado", 401));
  }

  const orders = await Order.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .select(
      "orderNumber orderStatus paymentStatus paymentMethod total subtotal shippingCost taxTotal discountTotal createdAt trackingNumber carrier"
    );

  res.status(200).json({
    status: "success",
    results: orders.length,
    orders,
  });
});

exports.getMyOrder = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("No autorizado", 401));
  }

  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    order: formatOrderForClient(order),
  });
});

exports.cancelMyOrder = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("No autorizado", 401));
  }

  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  if (["enviado", "entregado", "cancelado"].includes(order.orderStatus)) {
    return next(
      new AppError("Este pedido no puede cancelarse en su estado actual", 400)
    );
  }

  // Restaurar stock si ya fue descontado
  if (order.stockDeducted) {
    await restoreOrderStock(order.items);
    order.stockDeducted = false;
  }

  order.orderStatus = "cancelado";
  order.statusHistory.push({
    status: "cancelado",
    note: "Cancelado por el cliente",
  });
  await order.save();

  res.status(200).json({
    status: "success",
    message: "Pedido cancelado",
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
    },
  });
});
