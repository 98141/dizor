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

// Atomically deduct stock for each order item.
// orderItems uses { product (ObjectId), variantId, quantity, productName }
// Rolls back partial deductions and throws if any item has insufficient stock.
// `context` (orderId/orderNumber/user) is optional but needed to log each
// sale in el historial de inventario — sin él el stock baja pero la venta
// no queda registrada como movimiento (ver deducciones vía webhook Wompi/Nequi).
exports.deductOrderStock = async (orderItems, context = {}) => {
  const { orderId = null, orderNumber = "", user = null } = context;
  const deducted = [];
  for (const item of orderItems) {
    const productId = item.product || item.productId;
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        "variants._id": item.variantId,
        "variants.stock": { $gte: item.quantity },
      },
      { $inc: { "variants.$.stock": -item.quantity, salesCount: item.quantity } },
      { new: true }
    );
    if (!updated) {
      for (const prev of deducted) {
        const prevId = prev.product || prev.productId;
        await Product.findOneAndUpdate(
          { _id: prevId, "variants._id": prev.variantId },
          { $inc: { "variants.$.stock": prev.quantity } }
        ).catch(() => {});
      }
      throw new Error(`Stock insuficiente: ${item.productName}`);
    }
    deducted.push(item);

    if (orderNumber) {
      safeLogProductHistory(
        logProductSale({
          product: updated,
          variant: updated.variants.id(item.variantId),
          quantity: item.quantity,
          orderId,
          orderNumber,
          user,
          sizeName: item.sizeName,
          colorName: item.colorName,
        })
      );
    }
  }
};

// Restore stock when an order is cancelled or returned.
exports.restoreOrderStock = async (orderItems) => {
  await Promise.all(
    orderItems.map((item) => {
      const productId = item.product || item.productId;
      return Product.findOneAndUpdate(
        { _id: productId, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": item.quantity } }
      );
    })
  );
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
  couponCode = "",
  deductStock = true,
  idempotencyKey = null,
  req,
}) => {
  // Read-only stock check before touching anything
  for (const item of items) {
    const product = await Product.findById(item.productId).select("name variants");
    if (!product) throw new Error("Producto no encontrado");
    const variant = product.variants.id(item.variantId);
    if (!variant || variant.stock < item.quantity) {
      throw new Error(`Stock insuficiente: ${item.productName}`);
    }
  }

  const productCosts = new Map();
  for (const item of items) {
    const product = await Product.findById(item.productId).select("+internalCost");
    productCosts.set(String(item.productId), product?.internalCost ?? null);
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
    ivaEnabled: totals.ivaEnabled ?? false,
    ivaPercent: totals.ivaPercent ?? 0,
    freeShippingApplied: totals.freeShippingApplied ?? false,
    freeShippingThreshold: totals.freeShippingThreshold ?? 0,
    paymentMethod,
    paymentStatus: "pendiente",
    orderStatus: initialStatus,
    carrier: carrier || "",
    customerNotes: customerNotes || "",
    couponCode: couponCode || "",
    couponConsumed: false,
    stockDeducted: false,
    idempotencyKey: idempotencyKey || null,
    statusHistory: [{ status: initialStatus, note: "Pedido creado" }],
  });

  if (deductStock) {
    const deducted = [];
    try {
      for (const item of items) {
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            "variants._id": item.variantId,
            "variants.stock": { $gte: item.quantity },
          },
          { $inc: { "variants.$.stock": -item.quantity, salesCount: item.quantity } },
          { new: true }
        );
        if (!updated) throw new Error(`Stock insuficiente: ${item.productName}`);
        deducted.push({ productId: item.productId, variantId: item.variantId, quantity: item.quantity });
      }
    } catch (err) {
      // Roll back partial deductions
      for (const prev of deducted) {
        await Product.findOneAndUpdate(
          { _id: prev.productId, "variants._id": prev.variantId },
          { $inc: { "variants.$.stock": prev.quantity } }
        ).catch(() => {});
      }
      await Order.findByIdAndDelete(order._id).catch(() => {});
      throw err;
    }

    order.stockDeducted = true;
    await order.save({ validateBeforeSave: false });

    for (const item of items) {
      safeLogProductHistory(
        logProductSale({
          product: { _id: item.productId, name: item.productName, slug: item.productSlug },
          variant: { _id: item.variantId, stock: 0 },
          quantity: item.quantity,
          orderId: order._id,
          orderNumber,
          user: user || null,
          sizeName: item.sizeName,
          colorName: item.colorName,
        })
      );
    }
  }

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

  return order;
};
