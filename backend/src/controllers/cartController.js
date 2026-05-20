const Cart = require("../models/cart");
const Coupon = require("../models/coupon");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { resolveCartItems } = require("../services/cartService");
const { trackAbandonedCart } = require("../services/marketingService");
const { getStoreSettings, getShippingCost } = require("../services/settingsService");

exports.validateCart = catchAsync(async (req, res) => {
  const { items, department } = req.body;
  const resolved = await resolveCartItems(items);
  const settings = await getStoreSettings();
  const subtotal = resolved.reduce((s, i) => s + i.lineTotal, 0);
  const shippingCost = getShippingCost(settings, subtotal, department);
  const taxTotal = settings.taxEnabled
    ? Math.round(subtotal * (settings.taxRate / 100))
    : 0;
  const total = subtotal + taxTotal + shippingCost;

  res.status(200).json({
    status: "success",
    items: resolved,
    subtotal,
    taxTotal,
    shippingCost,
    total,
    taxEnabled: settings.taxEnabled,
    taxRate: settings.taxRate,
    itemCount: resolved.reduce((s, i) => s + i.quantity, 0),
  });
});

exports.validateCoupon = catchAsync(async (req, res, next) => {
  const { code, subtotal } = req.body;

  if (!code?.trim()) {
    return next(new AppError("Ingresa un código de cupón", 400));
  }

  const coupon = await Coupon.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    return next(new AppError("Cupón no válido o no existe", 400));
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return next(new AppError("Este cupón ha expirado", 400));
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return next(new AppError("Este cupón ya alcanzó el límite de usos", 400));
  }

  const orderSubtotal = Number(subtotal) || 0;
  if (orderSubtotal < coupon.minOrderAmount) {
    return next(
      new AppError(
        `El pedido mínimo para este cupón es $${coupon.minOrderAmount.toLocaleString("es-CO")}`,
        400
      )
    );
  }

  const discountAmount =
    coupon.type === "percentage"
      ? Math.round(orderSubtotal * (coupon.value / 100))
      : Math.min(coupon.value, orderSubtotal);

  res.status(200).json({
    status: "success",
    coupon: {
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: coupon.value,
      discountAmount,
    },
  });
});

exports.getMyCart = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Inicia sesión para ver tu carrito guardado", 401));
  }

  let cart = await Cart.findOne({ user: req.user.id }).populate({
    path: "items.product",
    select: "name slug mainImage isActive salePrice onPromotion discountPercent promotionEndsAt variants",
    populate: { path: "variants.size variants.color" },
  });

  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }

  res.status(200).json({
    status: "success",
    items: cart.items,
  });
});

exports.syncCart = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError("Inicia sesión para guardar el carrito", 401));
  }

  const { items } = req.body;

  if (items?.length) {
    await resolveCartItems(items);
  }

  const cart = await Cart.findOneAndUpdate(
    { user: req.user.id },
    {
      user: req.user.id,
      items: (items || []).map((i) => ({
        product: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (items?.length && req.user?.email) {
    trackAbandonedCart({
      email: req.user.email,
      name: req.user.name,
      items,
      userId: req.user.id,
    }).catch(() => {});
  }

  res.status(200).json({
    status: "success",
    message: "Carrito sincronizado",
    itemCount: cart.items.length,
  });
});
