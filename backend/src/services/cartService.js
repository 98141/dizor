const Product = require("../models/product");
const AppError = require("../utils/AppError");

const getVariant = (product, variantId) =>
  product.variants.id(variantId) ||
  product.variants.find((v) => String(v._id) === String(variantId));

exports.resolveCartItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AppError("El carrito está vacío", 400);
  }

  const resolved = [];

  for (const item of rawItems) {
    const { productId, variantId, quantity } = item;

    if (!productId || !variantId || !quantity || quantity < 1) {
      throw new AppError("Ítem de carrito inválido", 400);
    }

    const product = await Product.findById(productId).populate(
      "variants.size variants.color"
    );

    if (!product || !product.isActive) {
      throw new AppError(`Producto no disponible`, 400);
    }

    const variant = getVariant(product, variantId);

    if (!variant || !variant.isActive) {
      throw new AppError(`Variante no disponible para ${product.name}`, 400);
    }

    if (variant.stock < quantity) {
      throw new AppError(
        `Stock insuficiente para ${product.name} (${variant.sku})`,
        400
      );
    }

    const unitPrice =
      variant.price != null ? variant.price : product.getEffectivePrice();

    resolved.push({
      productId: product._id,
      variantId: variant._id,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.mainImage,
      sizeName: variant.size?.name || "",
      colorName: variant.color?.name || "",
      sku: variant.sku,
      maxStock: variant.stock,
    });
  }

  return resolved;
};

exports.calculateTotals = (resolvedItems, settings, department) => {
  const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const discountTotal = 0;

  const ivaEnabled = !!settings.taxEnabled;
  const ivaPercent = ivaEnabled ? (settings.taxRate || 0) : 0;
  const taxable = subtotal - discountTotal;
  const taxTotal = ivaEnabled ? Math.round(taxable * (ivaPercent / 100)) : 0;

  const { getShippingCost } = require("./settingsService");
  const shippingCost = getShippingCost(settings, subtotal, department);

  const freeShippingApplied =
    settings.shippingMode === "free_threshold" &&
    subtotal >= settings.freeShippingMinAmount;
  const freeShippingThreshold =
    settings.shippingMode === "free_threshold"
      ? (settings.freeShippingMinAmount || 0)
      : 0;

  const total = subtotal - discountTotal + taxTotal + shippingCost;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingCost,
    total,
    ivaEnabled,
    ivaPercent,
    freeShippingApplied,
    freeShippingThreshold,
  };
};
