const Product = require("../models/product");
const ProductHistory = require("../models/productHistory");
const AppError = require("../utils/AppError");

exports.assertQuantity = (quantity) => {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new AppError("La cantidad debe ser un entero positivo", 400);
  }
};

exports.moveStock = async (items, direction, context, session) => {
  if (!session?.inTransaction()) throw new Error("Stock requires a transaction");
  for (const item of items) {
    exports.assertQuantity(item.quantity);
    const delta = direction * item.quantity;
    const match = { _id: item.variantId };
    if (direction < 0) { match.stock = { $gte: item.quantity }; match.isActive = true; }
    const product = await Product.findOneAndUpdate(
      { _id: item.product || item.productId, ...(direction < 0 ? { isActive: true } : {}), variants: { $elemMatch: match } },
      { $inc: { "variants.$.stock": delta, salesCount: -delta } },
      { new: true, session }
    );
    if (!product) throw new AppError("Stock insuficiente o variante no disponible", 409);
    const variant = product.variants.id(item.variantId);
    if (!Number.isSafeInteger(variant.stock)) throw new AppError("El stock histórico requiere conciliación previa", 409);
    await ProductHistory.create([{
      productId: product._id, productName: product.name, productSlug: product.slug,
      variantId: variant._id, sku: variant.sku, eventType: direction < 0 ? "sale" : "stock_adjustment",
      quantityChange: delta, stockBefore: variant.stock - delta, stockAfter: variant.stock,
      referenceType: "order", referenceId: context.orderId, referenceLabel: context.orderNumber,
      userId: context.user?.id || context.user?._id || null, role: context.user?.role || "system",
      summary: context.reason || (direction < 0 ? "Venta" : "Reposición por cancelación/devolución"),
    }], { session });
  }
};
