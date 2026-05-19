const Order = require("../models/order");
const Product = require("../models/product");
const { logAuditEvent, safeLog } = require("./auditService");
const {
  logProductSale,
  safeLogProductHistory,
} = require("./productHistoryService");

const generateOrderNumber = async () => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const prefix = `DIZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const count = await Order.countDocuments({
    createdAt: { $gte: startOfDay },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

exports.createOrder = async ({
  user,
  isGuest,
  buyer,
  shippingAddress,
  items,
  totals,
  paymentMethod,
  carrier,
  customerNotes,
  req,
}) => {
  for (const item of items) {
    const product = await Product.findById(item.productId);

    if (!product) {
      throw new Error("Producto no encontrado");
    }

    const variant = product.variants.id(item.variantId);

    if (!variant || variant.stock < item.quantity) {
      throw new Error(`Stock insuficiente: ${item.productName}`);
    }
  }

  const stockDeductions = [];

  const productCosts = new Map();

  for (const item of items) {
    const product = await Product.findById(item.productId).select(
      "+internalCost"
    );
    const variant = product.variants.id(item.variantId);
    productCosts.set(String(product._id), product.internalCost ?? null);
    variant.stock -= item.quantity;
    product.cartAddsCount = (product.cartAddsCount || 0) + item.quantity;
    product.salesCount = (product.salesCount || 0) + item.quantity;
    await product.save({ validateBeforeSave: false });
    stockDeductions.push({ product, variant, item });
  }

  const orderNumber = await generateOrderNumber();

  const initialStatus =
    paymentMethod === "contra_entrega" ? "pendiente" : "pago_pendiente";

  const order = await Order.create({
    orderNumber,
    user: user?.id || null,
    isGuest,
    buyer,
    shippingAddress,
    items: items.map((i) => ({
      product: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      productSlug: i.productSlug,
      productImage: i.productImage,
      sizeName: i.sizeName,
      colorName: i.colorName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      unitCost: productCosts.get(String(i.productId)) ?? null,
    })),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    shippingCost: totals.shippingCost,
    total: totals.total,
    paymentMethod,
    paymentStatus: "pendiente",
    orderStatus: initialStatus,
    carrier: carrier || "",
    customerNotes: customerNotes || "",
    statusHistory: [
      {
        status: initialStatus,
        note: "Pedido creado",
      },
    ],
  });

  if (req && user) {
    safeLog(
      logAuditEvent({
        req,
        action: "order_created",
        module: "orders",
        user,
        entityId: order._id,
        entityType: "order",
        summary: `Pedido creado · ${orderNumber}`,
        newData: { orderNumber },
      })
    );
  }

  for (const { product, variant, item } of stockDeductions) {
    safeLogProductHistory(
      logProductSale({
        product,
        variant,
        quantity: item.quantity,
        orderId: order._id,
        orderNumber,
        user: user || null,
        sizeName: item.sizeName,
        colorName: item.colorName,
      })
    );
  }

  return order;
};
