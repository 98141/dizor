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
const { markAbandonedCartRecovered } = require("../services/marketingService");

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
          id: "nequi_manual",
          label: "Nequi (transferencia manual)",
          description: "Envía comprobante por WhatsApp",
        },
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
  } = req.body;

  if (!buyer?.name || !buyer?.email || !buyer?.phone) {
    return next(new AppError("Datos del comprador incompletos", 400));
  }

  if (
    !shippingAddress?.address ||
    !shippingAddress?.city ||
    !shippingAddress?.department
  ) {
    return next(new AppError("Dirección de envío incompleta", 400));
  }

  const validPayments = ["wompi", "nequi_manual", "contra_entrega"];
  if (!validPayments.includes(paymentMethod)) {
    return next(new AppError("Método de pago inválido", 400));
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
        return res.status(200).json({
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
    const coupon = await Coupon.findOne({
      code: couponCode.trim().toUpperCase(),
      isActive: true,
    });

    if (coupon) {
      const notExpired = !coupon.expiresAt || coupon.expiresAt > new Date();
      const hasUses = coupon.maxUses === null || coupon.usedCount < coupon.maxUses;
      const meetsMin = totals.subtotal >= coupon.minOrderAmount;

      if (notExpired && hasUses && meetsMin) {
        const discount =
          coupon.type === "percentage"
            ? Math.round(totals.subtotal * (coupon.value / 100))
            : Math.min(coupon.value, totals.subtotal);

        totals.discountTotal = discount;
        totals.total = totals.subtotal - discount + totals.taxTotal + totals.shippingCost;
        appliedCoupon = coupon;
      }
    }
  }

  const isGuest = !req.user;
  // Para Wompi diferimos el descuento de stock hasta que el webhook confirme el pago
  const deductStock = paymentMethod !== "wompi";

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

  res.status(201).json({
    status: "success",
    order: {
      id: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    },
    paymentUrl,
    message:
      paymentMethod === "wompi"
        ? "Pedido creado. Serás redirigido a Wompi para completar el pago."
        : paymentMethod === "nequi_manual"
          ? "Pedido creado. Envía tu comprobante Nequi por WhatsApp."
          : "Pedido creado. Pagarás al recibir tu pedido.",
  });
});

exports.trackGuestOrder = catchAsync(async (req, res, next) => {
  const { orderNumber, email } = req.query;

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
