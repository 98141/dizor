const Cart = require("../models/cart");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { resolveCartItems } = require("../services/cartService");
const { getStoreSettings, getShippingCost } = require("../services/settingsService");

exports.validateCart = catchAsync(async (req, res) => {
  const { items, department } = req.body;
  const resolved = await resolveCartItems(items);
  const settings = await getStoreSettings();
  const subtotal = resolved.reduce((s, i) => s + i.lineTotal, 0);
  const shippingCost = getShippingCost(settings, subtotal, department);

  res.status(200).json({
    status: "success",
    items: resolved,
    subtotal,
    shippingCost,
    itemCount: resolved.reduce((s, i) => s + i.quantity, 0),
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

  res.status(200).json({
    status: "success",
    message: "Carrito sincronizado",
    itemCount: cart.items.length,
  });
});
