const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const Order = require("../models/order");
const Cart = require("../models/cart");
const municipalityCatalog = require("../services/municipalityCatalog");
const Coupon = require("../models/coupon");
const {
  resolveCartItems,
  calculateTotals,
} = require("../services/cartService");
const {
  getStoreSettings,
  isShippingIncluded,
} = require("../services/settingsService");
const { getEnabledPaymentMethods, isPaymentMethodEnabled } = require("../services/paymentMethods");
const { getPublicDeliveryTerms } = require("../config/deliveryTerms");
const { createOrder } = require("../services/orderService");
const { isWompiConfigured, createPaymentLink, getTransaction } = require("../services/wompiService");
const {
  isNequiDirectEnabled,
  createNequiCharge,
  normalizePhone,
} = require("../services/nequiPaymentService");
const { markAbandonedCartRecovered } = require("../services/marketingService");
const { sendOrderReceiptOnce } = require("../services/orderReceiptService");
const { requireAuthorization, recordConsent } = require("../services/consentService");
const { PURPOSES, getText } = require("../config/legalTexts");
const { issueAccessToken, matchesHash } = require("../utils/opaqueTokens");

// Vigencia del token de acceso del comprador a la confirmación de su pedido
// (H-06). Cubre el retorno desde la pasarela y la consulta inmediata; después,
// el seguimiento se hace con número de pedido + correo o desde la cuenta.
const crypto = require("crypto");
const { mutateOrder, transition, addIncident } = require("../services/orderOperations");
const { canSelfCancel } = require("../services/orderTransitions");
const { processTransaction } = require("../services/wompiPaymentService");
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])])) : value;
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
  shippingIncluded: Boolean(order.shippingIncluded),
  total: order.total,
  // Se devuelve al titular del token para prellenar el registro opcional
  // (sustituye a guardar el correo en la URL o en sessionStorage).
  buyer: { name: order.buyer?.name || "", email: order.buyer?.email || "" },
  receiptSent: Boolean(order.buyerReceipt?.sentAt),
});

// DTO seguro: nunca expone unitCost, internalCost ni datos administrativos al cliente
const formatOrderForClient = (order) => ({
  canSelfCancel: canSelfCancel(order),
  id: order._id,
  orderNumber: order.orderNumber,
  orderStatus: order.orderStatus,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  subtotal: order.subtotal,
  discountTotal: order.discountTotal,
  taxTotal: order.taxTotal,
  shippingCost: order.shippingCost,
  shippingIncluded: Boolean(order.shippingIncluded),
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
      shippingIncluded: isShippingIncluded(settings),
      shippingFixedCost: settings.shippingFixedCost,
      freeShippingMinAmount: isShippingIncluded(settings) ? 0 : settings.freeShippingMinAmount,
      // Solo los métodos habilitados en el servidor (Wompi y contraentrega).
      paymentMethods: getEnabledPaymentMethods(),
      // null mientras el plazo no esté definido (no se promete nada ambiguo).
      deliveryTerms: getPublicDeliveryTerms(),
      departments: municipalityCatalog.departments,
      municipalities: municipalityCatalog.municipalities,
      municipalityCatalog: municipalityCatalog.metadata,
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

const createCheckoutOrder = async (req, res, next) => {
  const {
    items,
    buyer,
    shippingAddress: submittedShippingAddress,
    paymentMethod,
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
    !submittedShippingAddress?.address
  ) {
    return next(new AppError("Dirección de envío incompleta", 400));
  }

  const municipality = municipalityCatalog.findMunicipality(submittedShippingAddress.city, submittedShippingAddress.department);
  if (!municipality) {
    return next(new AppError("Selecciona una ciudad o municipio de la lista", 400));
  }
  const shippingAddress = { ...submittedShippingAddress, city: municipality.city, department: municipality.department };

  // Solo métodos habilitados en el servidor (hoy: Wompi y contraentrega).
  // Rechaza nequi_api / nequi_manual aunque los envíe un cliente antiguo o
  // manipulado; no se crea ningún pedido.
  if (typeof paymentMethod !== "string" || !isPaymentMethodEnabled(paymentMethod)) {
    return next(
      new AppError(
        "Este método de pago no está disponible. Recarga la página y elige Wompi o pago contra entrega.",
        400
      )
    );
  }

  // La transportadora la asigna DIZOR desde administración. Se ignora el
  // campo de clientes antiguos, incluso en la huella de idempotencia.

  // Términos y condiciones de compra (H-17): aceptación obligatoria cuando
  // existe un texto publicado. Solo `true` cuenta.
  const termsNotice = getText(PURPOSES.TERMS);
  if (termsNotice?.required && termsNotice.status !== "missing" && req.body.termsAccepted !== true) {
    return next(
      new AppError(
        "Debes aceptar los Términos y condiciones para continuar. Si no ves la casilla, recarga la página.",
        400
      )
    );
  }

  // Validar número Nequi antes de crear la orden para no dejar órdenes huérfanas
  // (solo alcanzable si la integración se reactivara explícitamente).
  if (paymentMethod === "nequi_api") {
    const normalizedNequiPhone = normalizePhone(nequiPhone);
    if (!normalizedNequiPhone || !/^3\d{9}$/.test(normalizedNequiPhone)) {
      return next(new AppError("Número de teléfono Nequi inválido (10 dígitos empezando en 3)", 400));
    }
    if (!isNequiDirectEnabled()) {
      return next(new AppError("Este método de pago no está disponible", 400));
    }
  }

  if (idempotencyKey !== undefined && (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))) {
    throw new AppError("Clave de idempotencia inválida", 400);
  }
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(stable({
    actor: req.user?.id || null, items, buyer, shippingAddress, paymentMethod, carrier: "",
    customerNotes: customerNotes || "", couponCode: couponCode || "",
  }))).digest("hex");
  const replay = async (existing) => {
    const owner = req.user?.id ? String(existing.user) === String(req.user.id)
      : !existing.user && existing.buyer?.email === buyer.email.trim().toLowerCase();
    if (!owner || !existing.checkoutFingerprint || existing.checkoutFingerprint !== fingerprint) {
      throw new AppError("La clave ya se usó para otra solicitud", 409);
    }
    if (existing.checkoutState === "failed" && existing.paymentMethod === "wompi") throw new AppError(`El pedido ${existing.orderNumber} requiere revisión del enlace con Wompi. Contacta a soporte con este número antes de iniciar otro pago.`, 409);
    if (existing.checkoutState !== "ready") throw new AppError("Pedido en proceso o pendiente de revisión. Conserva la misma clave e inténtalo después.", 409);
    return res.status(200).json({ status: "success", accessToken: await grantOrderAccess(existing._id),
      order: { id: existing._id, orderNumber: existing.orderNumber, total: existing.total,
        paymentMethod: existing.paymentMethod, orderStatus: existing.orderStatus, paymentStatus: existing.paymentStatus },
      paymentUrl: existing.wompi?.paymentLinkUrl || null, message: "Pedido ya registrado." });
  };
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey }).select("+checkoutFingerprint");
    if (existing) return replay(existing);
  }
  const resolved = await resolveCartItems(items);
  const settings = await getStoreSettings();
  const totals = calculateTotals(resolved, settings, shippingAddress.department);

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
      carrier: "",
      customerNotes,
      couponCode: appliedCoupon?.code || "",
      deductStock,
      idempotencyKey: idempotencyKey || undefined,
      checkoutFingerprint: fingerprint, checkoutState: "processing",
      req,
    });
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey }).select("+checkoutFingerprint");
      if (existing) return replay(existing);
    }
    return next(err.isOperational ? err : new AppError("No se pudo crear el pedido. Intenta nuevamente con la misma clave.", 503));
  }

  req.createdCheckoutOrderId = order._id;
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
      await Order.updateOne({ _id: order._id }, { $set: { checkoutState: "failed", requiresReview: true }, $push: { incidents: { code: "payment_link_creation_failed", detail: "Verificar con el proveedor antes de reintentar" } } });
      return next(
        new AppError("Wompi no está configurado en el servidor", 503)
      );
    }
    try {
      const wompi = await createPaymentLink(order);
      order.wompi = {
        paymentLinkId: wompi.paymentLinkId,
        paymentLinkUrl: wompi.paymentLinkUrl,
        expiresAt: wompi.expiresAt,
      };
      await order.save();
      paymentUrl = wompi.paymentLinkUrl;
    } catch (err) {
      await Order.updateOne({ _id: order._id }, { $set: { checkoutState: "failed", requiresReview: true }, $push: { incidents: { code: "payment_link_creation_failed", detail: "Verificar con el proveedor antes de reintentar" } } });
      return next(
        new AppError("No se pudo iniciar el pago con Wompi. El pedido queda pendiente de revisión.", 502)
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
      await Order.updateOne({ _id: order._id }, { $set: { checkoutState: "failed", requiresReview: true }, $push: { incidents: { code: "payment_link_creation_failed", detail: "Verificar con el proveedor antes de reintentar" } } });
      return next(
        new AppError(err.message || "No se pudo iniciar el pago con Nequi", 502)
      );
    }
  }

  // Evidencia de lo aceptado (H-19) y autorización de tratamiento (H-03).
  const privacyText = getText(PURPOSES.ORDER_PROCESSING);
  const termsText = getText(PURPOSES.TERMS);
  const termsRecorded =
    Boolean(termsText) && termsText.status !== "missing" && req.body.termsAccepted === true;
  const deliveryTerms = getPublicDeliveryTerms();
  order.legal = {
    privacyNoticeVersion: privacyText.version,
    privacyNoticeStatus: privacyText.status,
    // Versión exacta de los términos aceptados (H-17); null si no hay texto.
    termsVersion: termsRecorded ? termsText.version : null,
    termsStatus: termsRecorded ? termsText.status : null,
    // Plazo mostrado antes de confirmar; null mientras no esté definido.
    deliveryTermsVersion: deliveryTerms?.version || null,
    deliveryTermsText: deliveryTerms?.text || null,
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
  if (termsRecorded) {
    await recordConsent({
      purpose: PURPOSES.TERMS,
      subjectEmail: buyer.email,
      userId: req.user?.id || null,
      source: "checkout",
      referenceType: "Order",
      referenceId: order._id,
    });
  }

  await mutateOrder(order._id, async (current, session) => {
    current.checkoutState = "ready";
    await require("../services/notificationEvents").orderRegistered(current, session);
  });
  const accessToken = await grantOrderAccess(order._id);

  // Acuse de recibo al comprador (H-20): idempotente; un fallo no bloquea el
  // pedido y queda registrado en order.buyerReceipt para reintento.
  await sendOrderReceiptOnce(order._id);

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
          : "Pedido creado. Pagarás al recibir tu pedido.",
  });
};

exports.createCheckoutOrder = catchAsync(async (req, res, next) => {
  try {
    return await createCheckoutOrder(req, res, (error) => { throw error; });
  } catch (error) {
    if (req.createdCheckoutOrderId) {
      await Order.updateOne({ _id: req.createdCheckoutOrderId, checkoutState: "processing" }, {
        $set: { checkoutState: "failed", requiresReview: true },
        $push: { incidents: { code: "checkout_completion_failed", detail: "Pedido registrado; completar o conciliar antes de crear otra compra" } },
      }).catch(() => {});
    }
    return next(error);
  }
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
    message:
      "Esta forma de consulta ya no está disponible. Recarga la página y vuelve a consultar con el formulario de seguimiento.",
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
    orders: orders.map((o) => ({ ...o.toObject(), canSelfCancel: canSelfCancel(o) })),
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

  const canCheckElectronicAttempt = order.paymentMethod === "wompi"
    && ["pendiente", "pago_pendiente"].includes(order.orderStatus) && !["pagado", "reembolsado"].includes(order.paymentStatus);
  if (!canSelfCancel(order) && !canCheckElectronicAttempt) throw new AppError("La cancelación requiere intervención administrativa", 409);
  if (order.paymentMethod === "wompi") {
    // The link API does not enumerate all transactions. Unknown/unavailable payment state
    // must be reviewed, never treated as evidence of non-payment.
    if (!order.wompi?.transactionId) {
      await Order.updateOne({ _id: order._id, "incidents.code": { $ne: "cancellation_verification_pending" } }, { $set: { requiresReview: true }, $push: { incidents: { code: "cancellation_verification_pending", detail: "Sin transacción consultable: revisión administrativa requerida" } } });
      throw new AppError("No se puede verificar aún el pago. La cancelación requiere revisión administrativa.", 409);
    }
    let tx;
    try { tx = await getTransaction(order.wompi.transactionId); }
    catch { throw new AppError("No se pudo verificar con Wompi. Reintenta o solicita revisión administrativa.", 503); }
    if (tx.id !== order.wompi.transactionId) throw new AppError("Verificación de pago inválida", 409);
    await processTransaction(order._id, tx, { environment: process.env.WOMPI_ENV === "production" ? "prod" : "test", reconcile: true });
    if (tx.status === "APPROVED") throw new AppError("El pago está aprobado; solicita intervención administrativa", 409);
    throw new AppError("Consultar un intento no descarta otros pagos en proceso. Solicita cancelación administrativa.", 409);
  }
  await mutateOrder(order._id, async (current, session) => {
    if (String(current.user) !== String(req.user.id) || !canSelfCancel(current)) throw new AppError("El pedido ya no puede autocancelarse", 409);
    current.cancelledByCustomer = true;
    await transition(current, "cancelado", { ...req.user.toObject?.(), id: req.user.id, role: "admin" }, "Cancelado por el cliente antes de preparación", session);
  });
  res.status(200).json({ status: "success", message: "Pedido cancelado", order: { orderNumber: order.orderNumber, orderStatus: "cancelado" } });
});
