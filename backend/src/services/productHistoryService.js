const ProductHistory = require("../models/productHistory");

const snapshotVariants = (product) => {
  if (!product?.variants?.length) return [];

  return product.variants.map((v) => ({
    variantId: String(v._id),
    sku: v.sku,
    stock: v.stock ?? 0,
    price: v.price ?? null,
    isActive: v.isActive !== false,
    sizeName: v.size?.name || null,
    colorName: v.color?.name || null,
  }));
};

const buildActor = (user) => ({
  userId: user?._id || user?.id || null,
  userEmail: user?.email || null,
  role: user?.role || null,
});

exports.logProductHistory = async (entry) => {
  if (!entry?.eventType || !entry?.productName) return;

  await ProductHistory.create({
    productId: entry.productId || null,
    productName: entry.productName,
    productSlug: entry.productSlug || null,
    variantId: entry.variantId || null,
    sku: entry.sku || null,
    sizeName: entry.sizeName || null,
    colorName: entry.colorName || null,
    eventType: entry.eventType,
    quantityChange: entry.quantityChange ?? 0,
    stockBefore: entry.stockBefore ?? null,
    stockAfter: entry.stockAfter ?? null,
    referenceType: entry.referenceType || null,
    referenceId: entry.referenceId || null,
    referenceLabel: entry.referenceLabel || null,
    ...buildActor(entry.user),
    summary: entry.summary ? String(entry.summary).slice(0, 500) : null,
    details: entry.details || null,
  });
};

exports.safeLogProductHistory = (promise) => {
  if (promise?.catch) promise.catch(() => {});
};

exports.logProductCreated = async ({ product, user, req }) => {
  const variants = snapshotVariants(product);
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);

  await exports.logProductHistory({
    productId: product._id,
    productName: product.name,
    productSlug: product.slug,
    eventType: "created",
    stockAfter: totalStock,
    referenceType: "admin",
    user,
    summary: `Producto registrado · stock inicial ${totalStock} uds`,
    details: { variants, salePrice: product.salePrice },
  });

  for (const v of variants) {
    await exports.logProductHistory({
      productId: product._id,
      productName: product.name,
      productSlug: product.slug,
      variantId: v.variantId,
      sku: v.sku,
      sizeName: v.sizeName,
      colorName: v.colorName,
      eventType: "stock_adjustment",
      quantityChange: v.stock,
      stockBefore: 0,
      stockAfter: v.stock,
      referenceType: "admin",
      user,
      summary: `Stock inicial ${v.stock} · ${v.sku}`,
      details: { reason: "initial_stock" },
    });
  }
};

exports.logProductDeleted = async ({ product, user }) => {
  const variants = snapshotVariants(product);
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);

  await exports.logProductHistory({
    productId: product._id,
    productName: product.name,
    productSlug: product.slug,
    eventType: "deleted",
    stockBefore: totalStock,
    stockAfter: 0,
    referenceType: "admin",
    user,
    summary: `Producto eliminado · ${product.name}`,
    details: { variants },
  });
};

exports.logProductSale = async ({
  product,
  variant,
  quantity,
  orderId,
  orderNumber,
  user,
  sizeName = null,
  colorName = null,
}) => {
  const stockBefore = (variant.stock ?? 0) + quantity;
  const stockAfter = variant.stock ?? 0;

  await exports.logProductHistory({
    productId: product._id,
    productName: product.name,
    productSlug: product.slug,
    variantId: variant._id,
    sku: variant.sku,
    sizeName: sizeName || variant.size?.name || null,
    colorName: colorName || variant.color?.name || null,
    eventType: "sale",
    quantityChange: -quantity,
    stockBefore,
    stockAfter,
    referenceType: "order",
    referenceId: orderId,
    referenceLabel: orderNumber,
    user,
    summary: `Venta ${quantity} uds · ${orderNumber} · quedan ${stockAfter}`,
    details: {
      orderNumber,
      unitPrice: null,
    },
  });
};

exports.logProductUpdates = async ({ productBefore, productAfter, user }) => {
  const before = snapshotVariants(productBefore);
  const after = snapshotVariants(productAfter);
  const beforeMap = new Map(before.map((v) => [v.variantId, v]));
  const afterMap = new Map(after.map((v) => [v.variantId, v]));

  // Existing variants — stock, price, isActive changes
  for (const prev of before) {
    const next = afterMap.get(prev.variantId);
    if (!next) continue;

    if (prev.stock !== next.stock) {
      const delta = next.stock - prev.stock;
      await exports.logProductHistory({
        productId: productAfter._id,
        productName: productAfter.name,
        productSlug: productAfter.slug,
        variantId: next.variantId,
        sku: next.sku,
        sizeName: next.sizeName,
        colorName: next.colorName,
        eventType: "stock_adjustment",
        quantityChange: delta,
        stockBefore: prev.stock,
        stockAfter: next.stock,
        referenceType: "admin",
        user,
        summary:
          delta > 0
            ? `Ingreso +${delta} uds · ${next.sku}${next.sizeName ? ` · ${next.sizeName}` : ""}${next.colorName ? ` / ${next.colorName}` : ""}`
            : `Salida ${delta} uds · ${next.sku}${next.sizeName ? ` · ${next.sizeName}` : ""}${next.colorName ? ` / ${next.colorName}` : ""}`,
        details: { reason: "manual_adjustment" },
      });
    }

    if (prev.price !== next.price && next.price != null) {
      await exports.logProductHistory({
        productId: productAfter._id,
        productName: productAfter.name,
        productSlug: productAfter.slug,
        variantId: next.variantId,
        sku: next.sku,
        sizeName: next.sizeName,
        colorName: next.colorName,
        eventType: "price_change",
        referenceType: "admin",
        user,
        summary: `Precio variante ${next.sku}: ${prev.price ?? "—"} → ${next.price}`,
        details: { field: "variant_price", before: prev.price, after: next.price },
      });
    }

    if (prev.isActive !== next.isActive) {
      await exports.logProductHistory({
        productId: productAfter._id,
        productName: productAfter.name,
        productSlug: productAfter.slug,
        variantId: next.variantId,
        sku: next.sku,
        sizeName: next.sizeName,
        colorName: next.colorName,
        eventType: "status_change",
        referenceType: "admin",
        user,
        summary: next.isActive
          ? `Variante activada · ${next.sku}`
          : `Variante desactivada · ${next.sku}`,
        details: { field: "variant_isActive", isActive: next.isActive },
      });
    }
  }

  // New variants (present in after but not in before)
  for (const next of after) {
    if (!beforeMap.has(next.variantId)) {
      await exports.logProductHistory({
        productId: productAfter._id,
        productName: productAfter.name,
        productSlug: productAfter.slug,
        variantId: next.variantId,
        sku: next.sku,
        sizeName: next.sizeName,
        colorName: next.colorName,
        eventType: "stock_adjustment",
        quantityChange: next.stock,
        stockBefore: 0,
        stockAfter: next.stock,
        referenceType: "admin",
        user,
        summary: `Nueva variante agregada · ${next.sku} · stock inicial ${next.stock}`,
        details: { reason: "new_variant" },
      });
    }
  }

  if (productBefore.salePrice !== productAfter.salePrice) {
    await exports.logProductHistory({
      productId: productAfter._id,
      productName: productAfter.name,
      productSlug: productAfter.slug,
      eventType: "price_change",
      referenceType: "admin",
      user,
      summary: `Precio base: ${productBefore.salePrice ?? "—"} → ${productAfter.salePrice ?? "—"}`,
      details: { field: "salePrice", before: productBefore.salePrice, after: productAfter.salePrice },
    });
  }

  if (productBefore.isActive !== productAfter.isActive) {
    await exports.logProductHistory({
      productId: productAfter._id,
      productName: productAfter.name,
      productSlug: productAfter.slug,
      eventType: "status_change",
      referenceType: "admin",
      user,
      summary: productAfter.isActive
        ? "Producto activado en tienda"
        : "Producto desactivado en tienda",
      details: { isActive: productAfter.isActive },
    });
  }

  if (productBefore.name !== productAfter.name) {
    await exports.logProductHistory({
      productId: productAfter._id,
      productName: productAfter.name,
      productSlug: productAfter.slug,
      eventType: "updated",
      referenceType: "admin",
      user,
      summary: `Nombre: "${productBefore.name}" → "${productAfter.name}"`,
      details: { field: "name", before: productBefore.name, after: productAfter.name },
    });
  }
};

exports.snapshotProductForHistory = (product) => ({
  _id: product._id,
  name: product.name,
  slug: product.slug,
  salePrice: product.salePrice,
  isActive: product.isActive,
  variants: product.variants.map((v) => ({
    _id: v._id,
    sku: v.sku,
    stock: v.stock,
    price: v.price ?? null,
    isActive: v.isActive,
    size: v.size,
    color: v.color,
  })),
});
