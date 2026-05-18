const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const slugifyText = require("../utils/slugifyText");
const { formatProductAdmin } = require("../utils/productFormatter");
const { uploadProductImages } = require("../services/cloudinaryService");
const { isCloudinaryConfigured } = require("../config/cloudinary");

const populateAll =
  "category weaveType style variants.size variants.color";

const canDelete = (role) => ["superadmin", "admin"].includes(role);
const canViewCosts = (role) => ["superadmin", "admin"].includes(role);

exports.getProducts = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }
  if (req.query.q?.trim()) {
    filter.$or = [
      { name: { $regex: req.query.q.trim(), $options: "i" } },
      { slug: { $regex: req.query.q.trim(), $options: "i" } },
    ];
  }

  let query = Product.find(filter)
    .populate(populateAll)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  if (canViewCosts(req.user.role)) {
    query = query.select("+internalCost");
  }

  const [products, total] = await Promise.all([
    query,
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    status: "success",
    results: products.length,
    total,
    page,
    products: products.map((p) => formatProductAdmin(p, req.user.role)),
  });
});

exports.getProduct = catchAsync(async (req, res, next) => {
  let query = Product.findById(req.params.id).populate(populateAll);

  if (canViewCosts(req.user.role)) {
    query = query.select("+internalCost");
  }

  const product = await query;

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    product: formatProductAdmin(product, req.user.role),
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  if (!canViewCosts(req.user.role)) {
    delete req.body.internalCost;
  }

  const product = await Product.create(req.body);
  await product.populate(populateAll);

  res.status(201).json({
    status: "success",
    product: formatProductAdmin(product, req.user.role),
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  if (!canViewCosts(req.user.role)) {
    delete req.body.internalCost;
  }

  let query = Product.findById(req.params.id);

  if (canViewCosts(req.user.role)) {
    query = query.select("+internalCost");
  }

  const product = await query;

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  Object.assign(product, req.body);
  await product.save();
  await product.populate(populateAll);

  res.status(200).json({
    status: "success",
    product: formatProductAdmin(product, req.user.role),
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  if (!canDelete(req.user.role)) {
    return next(
      new AppError("No tienes permiso para eliminar productos", 403)
    );
  }

  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Producto eliminado",
  });
});

exports.uploadImages = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  if (!req.files?.length) {
    return next(new AppError("Debes enviar al menos una imagen", 400));
  }

  if (product.images.length + req.files.length > 10) {
    return next(new AppError("Máximo 10 imágenes por producto", 400));
  }

  const uploaded = await uploadProductImages(req.files);
  product.images.push(...uploaded);

  if (!product.mainImage && uploaded[0]) {
    product.mainImage = uploaded[0].url;
  }

  await product.save();

  res.status(200).json({
    status: "success",
    images: product.images,
    mainImage: product.mainImage,
  });
});

exports.getInventorySummary = catchAsync(async (req, res) => {
  let query = Product.find().populate("variants.size variants.color");

  if (canViewCosts(req.user.role)) {
    query = query.select("+internalCost");
  }

  const products = await query;

  const inventory = products.map((product) => {
    const totalStock = product.getTotalStock();
    let stockStatus = "healthy";

    if (totalStock === 0) stockStatus = "out";
    else if (totalStock <= 5) stockStatus = "low";

    const item = {
      id: product._id,
      name: product.name,
      slug: product.slug,
      totalStock,
      stockStatus,
      variants: product.variants.map((v) => ({
        id: v._id,
        sku: v.sku,
        stock: v.stock,
        size: v.size,
        color: v.color,
        isActive: v.isActive,
      })),
    };

    if (canViewCosts(req.user.role)) {
      item.internalCost = product.internalCost;
      item.salePrice = product.salePrice;
    }

    return item;
  });

  res.status(200).json({
    status: "success",
    results: inventory.length,
    inventory,
  });
});
