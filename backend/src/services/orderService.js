const Order = require("../models/order");
const Product = require("../models/product");
const { logAuditEvent, safeLog } = require("./auditService");
const crypto = require("crypto");
const { inTransaction } = require("./transactionService");
const { moveStock, assertQuantity } = require("./inventoryService");

// UTC instant formatted as a Colombian commercial date. No daily count race.
const generateOrderNumber = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = ["year", "month", "day"].map((key) => parts.find((p) => p.type === key).value).join("");
  return `DIZ-${date}-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
};
exports.generateOrderNumber = generateOrderNumber;
exports.deductOrderStock = (items, context = {}) => context.session
  ? moveStock(items, -1, context, context.session)
  : inTransaction((session) => moveStock(items, -1, context, session));
exports.restoreOrderStock = (items, context = {}) => context.session
  ? moveStock(items, 1, context, context.session)
  : inTransaction((session) => moveStock(items, 1, context, session));

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
  checkoutFingerprint = "",
  checkoutState = "ready",
}) => {
  for (const item of items) assertQuantity(item.quantity);
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

  const order = await inTransaction(async (session) => {
    const [created] = await Order.create([{
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
      shippingIncluded: totals.shippingIncluded ?? false,
      paymentMethod,
      paymentStatus: "pendiente",
      orderStatus: initialStatus,
      carrier: carrier || "",
      customerNotes: customerNotes || "",
      couponCode: couponCode || "",
      couponConsumed: false,
      stockDeducted: false,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      checkoutFingerprint, checkoutState,
      statusHistory: [{ status: initialStatus, note: "Pedido creado" }],
    }], { session });
    if (deductStock) {
      await moveStock(created.items, -1, { orderId: created._id, orderNumber, user }, session);
      created.stockDeducted = true;
      if (couponCode) {
        const Coupon = require("../models/coupon");
        const coupon = await Coupon.findOneAndUpdate({ code: couponCode, isActive: true,
          $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] }, { $inc: { usedCount: 1 } }, { session });
        if (!coupon) throw new (require("../utils/AppError"))("El cupón ya no está disponible", 409);
        created.couponConsumed = true;
      }
      await created.save({ session });
    }
    if (checkoutState === "ready") await require("./notificationEvents").orderRegistered(created, session);
    return created;
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

  return order;
};
