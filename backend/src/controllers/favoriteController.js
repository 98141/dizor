const User = require("../models/user");
const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { isValidObjectId, toObjectId } = require("../utils/objectIdUtils");
const { formatProductPublic } = require("../utils/productFormatter");

const populateList = "category weaveType style variants.size variants.color";

const normalizeFavoriteIds = (favorites = []) =>
  [...new Set(favorites.map((id) => String(id)))];

/**
 * Lista favoritos del usuario autenticado.
 * - Solo productos activos (inactivos/eliminados no se muestran).
 * - Agotados sí aparecen.
 * - Limpia refs huérfanas/inactivas del array del usuario.
 */
exports.getMyFavorites = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("favorites");
  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const ids = user.favorites || [];
  if (ids.length === 0) {
    return res.status(200).json({
      status: "success",
      favoriteIds: [],
      products: [],
      count: 0,
    });
  }

  const products = await Product.find({
    _id: { $in: ids },
    isActive: true,
  }).populate(populateList);

  const byId = new Map(products.map((p) => [String(p._id), p]));
  const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);

  const activeIds = ordered.map((p) => p._id);
  const activeIdSet = new Set(activeIds.map(String));
  const stale = ids.some((id) => !activeIdSet.has(String(id)));
  if (stale) {
    user.favorites = activeIds;
    await user.save({ validateBeforeSave: false });
  }

  res.status(200).json({
    status: "success",
    favoriteIds: activeIds.map(String),
    products: ordered.map(formatProductPublic),
    count: ordered.length,
  });
});

/** Solo IDs — hidratación ligera del contexto. */
exports.getMyFavoriteIds = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("favorites");
  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const ids = normalizeFavoriteIds(user.favorites || []);

  if (ids.length === 0) {
    return res.status(200).json({
      status: "success",
      favoriteIds: [],
      count: 0,
    });
  }

  const active = await Product.find({
    _id: { $in: ids },
    isActive: true,
  }).select("_id");

  const activeSet = new Set(active.map((p) => String(p._id)));
  const favoriteIds = ids.filter((id) => activeSet.has(id));

  if (favoriteIds.length !== ids.length) {
    user.favorites = favoriteIds.map((id) => toObjectId(id)).filter(Boolean);
    await user.save({ validateBeforeSave: false });
  }

  res.status(200).json({
    status: "success",
    favoriteIds,
    count: favoriteIds.length,
  });
});

exports.addFavorite = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return next(new AppError("ID de producto inválido", 400));
  }

  const product = await Product.findOne({
    _id: productId,
    isActive: true,
  }).select("_id");

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $addToSet: { favorites: product._id } },
    { new: true, select: "favorites" }
  );

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const favoriteIds = normalizeFavoriteIds(user.favorites);

  res.status(200).json({
    status: "success",
    message: "Agregado a favoritos",
    favoriteIds,
    count: favoriteIds.length,
  });
});

exports.removeFavorite = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  if (!isValidObjectId(productId)) {
    return next(new AppError("ID de producto inválido", 400));
  }

  const oid = toObjectId(productId);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { favorites: oid } },
    { new: true, select: "favorites" }
  );

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const favoriteIds = normalizeFavoriteIds(user.favorites);

  res.status(200).json({
    status: "success",
    message: "Eliminado de favoritos",
    favoriteIds,
    count: favoriteIds.length,
  });
});

/** Fusiona IDs locales (invitado) con la wishlist del usuario. */
exports.syncFavorites = catchAsync(async (req, res, next) => {
  const raw = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
  const candidateIds = [
    ...new Set(raw.map(String).filter((id) => isValidObjectId(id))),
  ].slice(0, 50);

  const user = await User.findById(req.user.id).select("favorites");
  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  let incomingActive = [];
  if (candidateIds.length > 0) {
    const active = await Product.find({
      _id: { $in: candidateIds.map((id) => toObjectId(id)).filter(Boolean) },
      isActive: true,
    }).select("_id");
    incomingActive = active.map((p) => String(p._id));
  }

  const merged = normalizeFavoriteIds([
    ...(user.favorites || []),
    ...incomingActive,
  ]);

  // Conservar solo activos del set fusionado
  const stillActive = await Product.find({
    _id: { $in: merged.map((id) => toObjectId(id)).filter(Boolean) },
    isActive: true,
  }).select("_id");
  const favoriteIds = stillActive.map((p) => String(p._id));

  user.favorites = favoriteIds.map((id) => toObjectId(id)).filter(Boolean);
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Favoritos sincronizados",
    favoriteIds,
    count: favoriteIds.length,
  });
});

/** Quita varios productos (p. ej. tras compra). Idempotente. */
exports.removeManyFavorites = catchAsync(async (req, res, next) => {
  const raw = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
  const oids = [
    ...new Set(raw.map(String).filter((id) => isValidObjectId(id))),
  ]
    .slice(0, 50)
    .map((id) => toObjectId(id))
    .filter(Boolean);

  if (oids.length === 0) {
    const user = await User.findById(req.user.id).select("favorites");
    if (!user) {
      return next(new AppError("Usuario no encontrado", 404));
    }
    const favoriteIds = normalizeFavoriteIds(user.favorites);
    return res.status(200).json({
      status: "success",
      favoriteIds,
      count: favoriteIds.length,
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pullAll: { favorites: oids } },
    { new: true, select: "favorites" }
  );

  if (!user) {
    return next(new AppError("Usuario no encontrado", 404));
  }

  const favoriteIds = normalizeFavoriteIds(user.favorites);

  res.status(200).json({
    status: "success",
    message: "Favoritos actualizados",
    favoriteIds,
    count: favoriteIds.length,
  });
});
