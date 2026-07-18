const Order = require("../models/order");
const Review = require("../models/review");
const Product = require("../models/product");
const AppError = require("../utils/AppError");

const VERIFIED_PAYMENT = ["pagado"];
const VERIFIED_ORDER_STATUS = [
  "pagado",
  "en_preparacion",
  "enviado",
  "entregado",
];

exports.formatReviewPublic = (doc) => {
  const product = doc.product;
  return {
    id: String(doc._id),
    authorName: doc.authorName,
    city: doc.city || "",
    rating: doc.rating,
    comment: doc.comment,
    isBrandReview: Boolean(doc.isBrandReview),
    product: product
      ? {
          id: String(product._id || product),
          name: product.name || "",
          slug: product.slug || "",
        }
      : null,
    createdAt: doc.createdAt,
  };
};

exports.formatReviewAdmin = (doc) => ({
  ...exports.formatReviewPublic(doc),
  aprobado: Boolean(doc.aprobado),
  user: doc.user
    ? {
        id: String(doc.user._id || doc.user),
        name: doc.user.name || "",
        email: doc.user.email || "",
      }
    : null,
  createdBy: doc.createdBy ? String(doc.createdBy._id || doc.createdBy) : null,
  updatedAt: doc.updatedAt,
});

exports.hasVerifiedPurchase = async (userId, productId) => {
  if (!userId || !productId) return false;

  const order = await Order.findOne({
    user: userId,
    "items.product": productId,
    $or: [
      { paymentStatus: { $in: VERIFIED_PAYMENT } },
      { orderStatus: { $in: VERIFIED_ORDER_STATUS } },
    ],
  }).select("_id");

  return Boolean(order);
};

exports.assertCanCreateCustomerReview = async (user, productId) => {
  if (!user?._id) {
    throw new AppError("Debes iniciar sesión para dejar una reseña", 401);
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }

  const purchased = await exports.hasVerifiedPurchase(user._id, productId);
  if (!purchased) {
    throw new AppError(
      "Solo puedes reseñar productos con compra verificada",
      403
    );
  }

  const existing = await Review.findOne({
    user: user._id,
    product: productId,
    isBrandReview: false,
  });

  if (existing) {
    throw new AppError(
      "Ya tienes una reseña para este producto. Si fue rechazada, vuelve a intentarlo; si está pendiente o aprobada, no puedes crear otra.",
      409
    );
  }

  return product;
};
