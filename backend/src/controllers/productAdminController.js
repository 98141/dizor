const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const slugifyText = require("../utils/slugifyText");
const { formatProductAdmin } = require("../utils/productFormatter");
const { uploadProductImages } = require("../services/cloudinaryService");
const { isCloudinaryConfigured } = require("../config/cloudinary");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  logProductCreated,
  logProductDeleted,
  logProductUpdates,
  snapshotProductForHistory,
  safeLogProductHistory,
} = require("../services/productHistoryService");

const cloudinaryConfigured = () => isCloudinaryConfigured();

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

  const formatted = formatProductAdmin(product, req.user.role);
  formatted.variants = product.variants.map((v) => ({
    id: v._id,
    size: v.size?._id || v.size,
    color: v.color?._id || v.color,
    sizeName: v.size?.name,
    colorName: v.color?.name,
    sku: v.sku,
    stock: v.stock,
    price: v.price,
    isActive: v.isActive,
  }));

  res.status(200).json({
    status: "success",
    product: formatted,
  });
});

exports.getCatalogMeta = catchAsync(async (req, res) => {
  const Category = require("../models/category");
  const Color = require("../models/color");
  const Size = require("../models/size");
  const WeaveType = require("../models/weaveType");
  const Style = require("../models/style");

  const [categories, colors, sizes, weaveTypes, styles] = await Promise.all([
    Category.find().sort({ sortOrder: 1, name: 1 }),
    Color.find().sort({ sortOrder: 1, name: 1 }),
    Size.find().sort({ sortOrder: 1, name: 1 }),
    WeaveType.find().sort({ sortOrder: 1, name: 1 }),
    Style.find().sort({ sortOrder: 1, name: 1 }),
  ]);

  res.status(200).json({
    status: "success",
    meta: {
      categories,
      colors,
      sizes,
      weaveTypes,
      styles,
      cloudinaryConfigured: cloudinaryConfigured(),
    },
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  if (!canViewCosts(req.user.role)) {
    delete req.body.internalCost;
  }

  const product = await Product.create(req.body);
  await product.populate(populateAll);

  safeLog(
    logAuditEvent({
      req,
      action: "product_created",
      module: "catalog",
      user: req.user,
      entityId: product._id,
      entityType: "product",
      summary: `Producto creado · ${product.name}`,
      newData: { name: product.name, slug: product.slug },
    })
  );

  safeLogProductHistory(
    logProductCreated({ product, user: req.user, req })
  );

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

  await product.populate(populateAll);
  const productBefore = snapshotProductForHistory(product);

  Object.assign(product, req.body);
  await product.save();
  await product.populate(populateAll);

  const productAfter = snapshotProductForHistory(product);

  safeLog(
    logAuditEvent({
      req,
      action: "product_updated",
      module: "catalog",
      user: req.user,
      entityId: product._id,
      entityType: "product",
      summary: `Producto actualizado · ${product.name}`,
      previousData: { name: productBefore.name },
      newData: { name: product.name, isActive: product.isActive },
    })
  );

  safeLogProductHistory(
    logProductUpdates({
      productBefore,
      productAfter,
      user: req.user,
    })
  );

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

  safeLog(
    logAuditEvent({
      req,
      action: "product_deleted",
      module: "catalog",
      user: req.user,
      entityId: product._id,
      entityType: "product",
      summary: `Producto eliminado · ${product.name}`,
      previousData: { name: product.name, slug: product.slug },
    })
  );

  safeLogProductHistory(logProductDeleted({ product, user: req.user }));

  res.status(200).json({
    status: "success",
    message: "Producto eliminado",
  });
});

exports.addImageUrl = catchAsync(async (req, res, next) => {
  const { url, alt } = req.body;

  if (!url?.trim()) {
    return next(new AppError("La URL de la imagen es obligatoria", 400));
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  if (product.images.length >= 10) {
    return next(new AppError("Máximo 10 imágenes por producto", 400));
  }

  product.images.push({
    url: url.trim(),
    alt: alt || product.name,
    publicId: null,
  });

  if (!product.mainImage) {
    product.mainImage = url.trim();
  }

  await product.save();

  res.status(200).json({
    status: "success",
    images: product.images,
    mainImage: product.mainImage,
  });
});

exports.removeImage = catchAsync(async (req, res, next) => {
  const { imageIndex } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  if (imageIndex < 0 || imageIndex >= product.images.length) {
    return next(new AppError("Imagen no encontrada", 400));
  }

  product.images.splice(imageIndex, 1);

  if (!product.images.length) {
    return next(new AppError("El producto debe tener al menos una imagen", 400));
  }

  if (!product.images.find((img) => img.url === product.mainImage)) {
    product.mainImage = product.images[0].url;
  }

  await product.save();

  res.status(200).json({
    status: "success",
    images: product.images,
    mainImage: product.mainImage,
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

exports.uploadTempImages = catchAsync(async (req, res, next) => {
  if (!req.files?.length) {
    return next(new AppError("Debes enviar al menos una imagen", 400));
  }
  const uploaded = await uploadProductImages(req.files);
  res.status(200).json({ status: "success", images: uploaded });
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
