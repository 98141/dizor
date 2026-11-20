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

const { inTransaction } = require("../services/transactionService");
const ProductHistory = require("../models/productHistory");

const cloudinaryConfigured = () => isCloudinaryConfigured();

const populateAll =
  "category weaveType style variants.size variants.color";

/** Tejido / horma opcionales: "" (No aplica) → null. */
function normalizeOptionalRefs(body) {
  if (!body) return;
  for (const key of ["weaveType", "style"]) {
    if (key in body && !body[key]) body[key] = null;
  }
}

const canDelete = (role) => ["superadmin", "admin"].includes(role);
const canViewCosts = (role) => ["superadmin", "admin"].includes(role);

async function assertUniqueVariantSkus(variants, { excludeProductId } = {}) {
  if (!Array.isArray(variants)) return;

  const incomingSkus = variants.map((v) =>
    String(v.sku || "").trim().toUpperCase()
  );

  if (incomingSkus.some((sku) => !sku)) {
    throw new AppError("Cada variante debe tener un SKU", 400);
  }

  if (new Set(incomingSkus).size !== incomingSkus.length) {
    throw new AppError(
      "El producto tiene SKUs duplicados entre sus variantes",
      400
    );
  }

  const combos = variants.map(
    (v) => `${String(v.size || "")}|${String(v.color || "")}`
  );
  if (new Set(combos).size !== combos.length) {
    throw new AppError(
      "Hay variantes duplicadas (misma talla y color)",
      400
    );
  }

  const filter = { "variants.sku": { $in: incomingSkus } };
  if (excludeProductId) {
    filter._id = { $ne: excludeProductId };
  }

  const conflict = await Product.findOne(filter);
  if (conflict) {
    const dup = conflict.variants.find((v) =>
      incomingSkus.includes(String(v.sku || "").trim().toUpperCase())
    );
    throw new AppError(
      `El SKU "${dup?.sku}" ya está en uso por otro producto`,
      400
    );
  }
}

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
  normalizeOptionalRefs(req.body);

  await assertUniqueVariantSkus(req.body.variants);

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
  normalizeOptionalRefs(req.body);

  const { product, productBefore } = await inTransaction(async (session) => {
    let query = Product.findById(req.params.id).session(session);

    if (canViewCosts(req.user.role)) {
      query = query.select("+internalCost");
    }

    const product = await query;

    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }

    await assertUniqueVariantSkus(req.body.variants, {
      excludeProductId: product._id,
  });

  await product.populate(populateAll);
  const productBefore = snapshotProductForHistory(product);

  // Actualizar variantes por su _id en vez de reemplazar el array completo:
  // si se reasigna con Object.assign, Mongoose trata cada entrada entrante
  // (sin _id) como un subdocumento nuevo y le genera un _id distinto, aunque
  // sea la misma variante — eso rompe cualquier referencia existente
  // (carritos, pedidos en curso) y hace que el historial de inventario la
  // registre como "variante nueva" en vez de un ajuste de stock.
  if (Array.isArray(req.body.variants)) {
    const keepIds = [];

    for (const incoming of req.body.variants) {
      const vid = incoming.id || incoming._id;
      const existing = vid ? product.variants.id(vid) : null;

      if (incoming.stock !== undefined && (!Number.isSafeInteger(incoming.stock) || incoming.stock < 0)) throw new AppError("Stock entero no negativo requerido", 400);
      if (vid && !existing) throw new AppError("La variante ya no existe; recarga el producto", 409);
      if (existing) {
        existing.set({
          size: incoming.size,
          color: incoming.color,
          sku: incoming.sku,
          price: incoming.price,
          isActive: incoming.isActive,
        });
        keepIds.push(String(existing._id));
      } else {
        product.variants.push({
          size: incoming.size,
          color: incoming.color,
          sku: incoming.sku,
          stock: incoming.stock,
          price: incoming.price,
          isActive: incoming.isActive,
        });
        keepIds.push(String(product.variants[product.variants.length - 1]._id));
      }
    }

    for (const v of [...product.variants]) {
      if (!keepIds.includes(String(v._id))) {
        v.isActive = false; // retain historical variant references and its stock
      }
    }


  }

  const fields = ["name", "shortDescription", "fullDescription", "category", "weaveType", "style", "material", "salePrice", "internalCost", "discountPercent", "promotionEndsAt", "images", "mainImage", "seoTitle", "seoDescription", "isActive", "isFeatured", "isNew", "onPromotion", "allowsCustomization", "customizationOptions"];
  for (const key of fields) if (req.body[key] !== undefined) product[key] = req.body[key];
  await product.save({ session, validateModifiedOnly: true });
  await product.populate(populateAll);

  return { product, productBefore };
  });
  safeLogProductHistory(logProductUpdates({ productBefore, productAfter: snapshotProductForHistory(product), user: req.user }));
  safeLog(logAuditEvent({ req, user: req.user, action: "product_updated", module: "catalog",
    entityId: product._id, entityType: "product", summary: `Producto actualizado · ${product.name}` }));

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

exports.adjustStock = catchAsync(async (req, res) => {
  const { variantId, delta, reason, operationKey } = req.body;
  if (!Number.isSafeInteger(delta) || delta === 0 || typeof reason !== "string" || !reason.trim()
      || typeof operationKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(operationKey)) {
    throw new AppError("Registra ajuste entero, motivo y clave de operación válida", 400);
  }
  const result = await inTransaction(async (session) => {
    const old = await ProductHistory.findOne({ movementKey: operationKey }).session(session);
    if (old) {
      if (String(old.productId) !== req.params.id || String(old.variantId) !== variantId || old.quantityChange !== delta || old.summary !== reason.trim() || String(old.userId) !== String(req.user.id)) throw new AppError("Clave usada para otro movimiento", 409);
      return { stock: old.stockAfter, repeated: true };
    }
    const product = await Product.findOneAndUpdate({ _id: req.params.id,
      variants: { $elemMatch: { _id: variantId, stock: { $gte: Math.max(0, -delta) } } } },
      { $inc: { "variants.$.stock": delta } }, { session, new: true });
    if (!product) throw new AppError("Variante no disponible o stock insuficiente", 409);
    const variant = product.variants.id(variantId);
    if (!Number.isSafeInteger(variant.stock)) throw new AppError("El stock histórico requiere conciliación previa", 409);
    await ProductHistory.create([{
      movementKey: operationKey, productId: product._id, productName: product.name, variantId,
      sku: variant.sku, eventType: "stock_adjustment", quantityChange: delta,
      stockBefore: variant.stock - delta, stockAfter: variant.stock, summary: reason.trim(),
      userId: req.user.id, role: req.user.role, referenceType: "admin",
    }], { session });
    return { stock: variant.stock, repeated: false };
  });
  res.json({ status: "success", ...result });
});
