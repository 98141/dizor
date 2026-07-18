const Review = require("../models/review");
const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  formatReviewPublic,
  formatReviewAdmin,
  assertCanCreateCustomerReview,
} = require("../services/reviewService");
const { isValidObjectId } = require("../utils/objectIdUtils");
const { logAuditEvent, safeLog } = require("../services/auditService");

const populateProduct = { path: "product", select: "name slug" };
const populateUser = { path: "user", select: "name email" };

/** GET /reviews?limit= — reseñas aprobadas para el home */
exports.getApprovedReviews = catchAsync(async (req, res) => {
  const limit = Math.min(12, parseInt(req.query.limit, 10) || 4);

  const reviews = await Review.find({ aprobado: true })
    .populate(populateProduct)
    .sort({ isBrandReview: -1, createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: reviews.length,
    reviews: reviews.map(formatReviewPublic),
  });
});

/** GET /reviews/product/:productId — reseñas aprobadas de un producto */
exports.getProductReviews = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return next(new AppError("Producto inválido", 400));
  }

  const reviews = await Review.find({
    product: productId,
    aprobado: true,
  })
    .populate(populateProduct)
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    status: "success",
    results: reviews.length,
    reviews: reviews.map(formatReviewPublic),
  });
});

/** POST /reviews — cliente autenticado, compra verificada → pendiente */
exports.createCustomerReview = catchAsync(async (req, res, next) => {
  const productId = req.body.productId || req.body.product;
  if (!isValidObjectId(productId)) {
    return next(new AppError("Producto inválido", 400));
  }

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return next(new AppError("La calificación debe ser entre 1 y 5", 400));
  }

  const comment = String(req.body.comment || "").trim();
  if (comment.length < 10) {
    return next(new AppError("El comentario debe tener al menos 10 caracteres", 400));
  }

  await assertCanCreateCustomerReview(req.user, productId);

  const review = await Review.create({
    product: productId,
    user: req.user._id,
    authorName: String(req.body.authorName || req.user.name || "").trim(),
    city: String(req.body.city || "").trim(),
    rating,
    comment,
    aprobado: false,
    isBrandReview: false,
  });

  await review.populate(populateProduct);

  res.status(201).json({
    status: "success",
    message: "Reseña enviada. Se publicará cuando sea aprobada.",
    review: formatReviewPublic(review),
  });
});

/** GET /admin/reviews */
exports.adminListReviews = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.aprobado === "true") filter.aprobado = true;
  if (req.query.aprobado === "false") filter.aprobado = false;
  if (req.query.isBrandReview === "true") filter.isBrandReview = true;
  if (req.query.isBrandReview === "false") filter.isBrandReview = false;

  const reviews = await Review.find(filter)
    .populate(populateProduct)
    .populate(populateUser)
    .sort({ createdAt: -1 })
    .limit(Math.min(200, parseInt(req.query.limit, 10) || 100));

  res.status(200).json({
    status: "success",
    results: reviews.length,
    reviews: reviews.map(formatReviewAdmin),
  });
});

/** PATCH /admin/reviews/:id/approve */
exports.approveReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError("Reseña no encontrada", 404));

  review.aprobado = true;
  await review.save();
  await review.populate(populateProduct);

  safeLog(
    logAuditEvent({
      req,
      action: "review_approved",
      module: "reviews",
      user: req.user,
      entityId: review._id,
      entityType: "review",
      summary: `Reseña aprobada · ${review.authorName}`,
    })
  );

  res.status(200).json({
    status: "success",
    review: formatReviewAdmin(review),
  });
});

/** DELETE /admin/reviews/:id — rechazar / eliminar */
exports.rejectReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return next(new AppError("Reseña no encontrada", 404));

  safeLog(
    logAuditEvent({
      req,
      action: "review_rejected",
      module: "reviews",
      user: req.user,
      entityId: review._id,
      entityType: "review",
      summary: `Reseña rechazada/eliminada · ${review.authorName}`,
      previousData: {
        authorName: review.authorName,
        product: review.product,
        aprobado: review.aprobado,
      },
    })
  );

  res.status(200).json({
    status: "success",
    message: "Reseña eliminada",
  });
});

/** POST /admin/reviews/brand — reseña de marca auto-aprobada */
exports.createBrandReview = catchAsync(async (req, res, next) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return next(new AppError("La calificación debe ser entre 1 y 5", 400));
  }

  const comment = String(req.body.comment || "").trim();
  if (comment.length < 5) {
    return next(new AppError("El comentario es demasiado corto", 400));
  }

  let product = null;
  const productId = req.body.productId || req.body.product;
  if (productId) {
    if (!isValidObjectId(productId)) {
      return next(new AppError("Producto inválido", 400));
    }
    product = await Product.findById(productId);
    if (!product) return next(new AppError("Producto no encontrado", 404));
  }

  const review = await Review.create({
    product: product?._id || null,
    user: null,
    authorName: String(req.body.authorName || "Dizor").trim(),
    city: String(req.body.city || "").trim(),
    rating,
    comment,
    aprobado: true,
    isBrandReview: true,
    createdBy: req.user._id,
  });

  await review.populate(populateProduct);

  safeLog(
    logAuditEvent({
      req,
      action: "brand_review_created",
      module: "reviews",
      user: req.user,
      entityId: review._id,
      entityType: "review",
      summary: `Reseña de marca creada · ${review.authorName}`,
    })
  );

  res.status(201).json({
    status: "success",
    review: formatReviewAdmin(review),
  });
});
