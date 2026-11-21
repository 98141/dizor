const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const catalog = require("../services/catalogWorkspace");
const { mutateCatalog } = require("../services/catalogMutationService");
const { formatProductAdmin } = require("../utils/productFormatter");
const { uploadProductImages } = require("../services/cloudinaryService");
const { isCloudinaryConfigured } = require("../config/cloudinary");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  logProductCreated,
  logProductUpdates,
  snapshotProductForHistory,
} = require("../services/productHistoryService");

const { inTransaction } = require("../services/transactionService");
const ProductHistory = require("../models/productHistory");

const cloudinaryConfigured = () => isCloudinaryConfigured();

const populateAll =
  "category weaveType style variants.size variants.color";

/** Tejido / horma opcionales: "" (No aplica) → null. */
function normalizeOptionalRefs(body) {
  if (!body) return;
  if (Array.isArray(body.variants)) for (const v of body.variants) { v.size ||= null; v.color ||= null; }
  for (const key of ["weaveType", "style"]) {
    if (key in body && !body[key]) body[key] = null;
  }
}

const canDelete = (role) => ["superadmin", "admin"].includes(role);
const canViewCosts = (role) => ["superadmin", "admin"].includes(role);
function validateCatalogPayload(body, current = null) {
  for (const field of ["salePrice", "internalCost", "discountPercent"]) if (body[field] !== undefined &&
    (body[field] === "" || !Number.isFinite(Number(body[field])) || Number(body[field]) < 0 || (field === "discountPercent" && Number(body[field]) > 100))) throw new AppError("Revisa precio, costo y descuento", 400);
  if (body.variants !== undefined && !Array.isArray(body.variants)) throw new AppError("Variantes inválidas", 400);
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length < 1 || body.images.length > 10) throw new AppError("Registra entre 1 y 10 imágenes", 400);
    const previous = new Set((current?.images || []).map((i) => i.url));
    for (const image of body.images) if (typeof image.url !== "string" || (!previous.has(image.url) && !/^(https?:\/\/|\/(?!\/))/i.test(image.url))) throw new AppError("URL de imagen inválida", 400);
    if (!body.images.some((i) => i.url === (body.mainImage ?? current?.mainImage ?? body.images[0]?.url))) throw new AppError("La imagen principal debe pertenecer a la galería", 400);
  }
}

async function assertUniqueVariantSkus(variants, { excludeProductId, session } = {}) {
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

  const ref = (v) => String(v?._id || v || "");
  const combos = variants.filter((v) => v.isActive !== false).map((v) => `${ref(v.size)}|${ref(v.color)}`);
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

  const conflict = await Product.findOne(filter).session(session || null);
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

async function assertCanDeactivate(before, after, session) {
  const disabled = after.variants.filter((v) => v.isActive === false && before.variants.some((old) => String(old._id) === String(v._id) && old.isActive !== false)).map((v) => v._id);
  const productDisabled = before.isActive !== false && after.isActive === false;
  if (!productDisabled && !disabled.length) return;
  const Order = require("../models/order");
  const referenced = await Order.exists({ orderStatus: { $in: ["pendiente", "pago_pendiente", "pagado", "en_preparacion"] }, stockDeducted: { $ne: true },
    items: { $elemMatch: { product: after._id, ...(!productDisabled ? { variantId: { $in: disabled } } : {}) } } }).session(session);
  if (referenced) throw new AppError("Hay pedidos abiertos pendientes de aplicar inventario. Revisa esos pedidos antes de desactivar el producto o su variante.", 409);
}

exports.getProducts = catchAsync(async (req, res) => {
  res.json(await catalog.query(req.query, req.user.role));
});

exports.getProduct = catchAsync(async (req, res, next) => {
  let query = Product.findById(req.params.id).populate(populateAll);

  if (canViewCosts(req.user.role)) {
    query = query.select("+internalCost");
  }

  const product = await query.lean();

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  const formatted = catalog.format(product, req.user.role);
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
    stockStatus: require("../services/inventoryCriteria").variantStatus(v),
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
  validateCatalogPayload(req.body);

  const product = await mutateCatalog(async (session) => {
    await assertUniqueVariantSkus(req.body.variants, { session });
    const [created] = await Product.create([req.body], { session });
    await created.populate(populateAll);
    await logProductCreated({ product: created, user: req.user, session });
    return created;
  });

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

  const { product } = await mutateCatalog(async (session) => {
    let query = Product.findById(req.params.id).session(session);

    if (canViewCosts(req.user.role)) {
      query = query.select("+internalCost");
    }

    const product = await query;

    if (!product) {
      throw new AppError("Producto no encontrado", 404);
    }
    validateCatalogPayload(req.body, product);
    if (Array.isArray(req.body.variants)) {
      const raw = await Product.collection.findOne({ _id: product._id }, { session, projection: { variants: 1 } });
      if ((raw.variants || []).some((v) => !Number.isSafeInteger(v.stock) || v.stock < 0)) throw new AppError("Las existencias históricas requieren revisión antes de modificar variantes; no se normalizarán al guardar", 409);
    }

    await assertUniqueVariantSkus(req.body.variants, {
      excludeProductId: product._id, session,
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
  const incomingIds = req.body.variants.map((v) => v.id || v._id).filter(Boolean).map(String);
  if (new Set(incomingIds).size !== incomingIds.length) throw new AppError("Variante repetida en la solicitud", 400);

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
  if (Array.isArray(req.body.variants)) await assertUniqueVariantSkus(product.variants, { excludeProductId: product._id, session });
  await assertCanDeactivate(productBefore, product, session);
  await product.save({ session, validateModifiedOnly: true });
  await product.populate(populateAll);

  await logProductUpdates({ productBefore, productAfter: snapshotProductForHistory(product), user: req.user, session });
  return { product };
  });
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

  const product = await mutateCatalog(async (session) => {
    const current = await Product.findById(req.params.id).session(session);
    if (!current) throw new AppError("Producto no encontrado", 404);
    const before = snapshotProductForHistory(current);
    current.isActive = false;
    await assertCanDeactivate(before, current, session);
    await current.save({ session, validateModifiedOnly: true });
    await logProductUpdates({ productBefore: before, productAfter: snapshotProductForHistory(current), user: req.user, session });
    return current;
  });
  safeLog(logAuditEvent({ req, user: req.user, action: "product_updated", module: "catalog", entityId: product._id,
    entityType: "product", summary: `Publicación desactivada; referencias conservadas · ${product.name}` }));
  res.json({ status: "success", message: "Producto desactivado. Se conservan variantes, pedidos e historial.", product: catalog.format(product, req.user.role) });
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
  const result = await catalog.query(req.query, req.user.role);
  res.json({ ...result, inventory: result.products.map((p) => ({ ...p, stockStatus: p.inventory.stockStatus })) });
});

exports.adjustStock = catchAsync(async (req, res) => {
  const { variantId, delta, reason, operationKey } = req.body;
  if (!Number.isSafeInteger(delta) || delta === 0 || typeof reason !== "string" || !reason.trim() || reason.trim().length > 500
      || typeof operationKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(operationKey)) {
    throw new AppError("Registra ajuste entero, motivo y clave de operación válida", 400);
  }
  catalog.objectId(variantId);
  const existingMovement = await ProductHistory.findOne({ movementKey: operationKey }).lean();
  if (existingMovement && (String(existingMovement.productId) !== req.params.id || String(existingMovement.variantId) !== variantId || existingMovement.quantityChange !== delta || existingMovement.summary !== reason.trim() || String(existingMovement.userId) !== String(req.user.id))) throw new AppError("Clave usada para otro movimiento", 409);
  const StockAdjustment = require("../models/stockAdjustment");
  try { await StockAdjustment.updateOne({ _id: operationKey }, { $setOnInsert: {
    productId: req.params.id, variantId, userId: req.user.id, delta, reason: reason.trim(), state: "pending", revision: 0,
  } }, { upsert: true }); } catch (err) { if (err.code !== 11000) throw err; }
  const result = await inTransaction(async (session) => {
    const intent = await StockAdjustment.findById(operationKey).session(session);
    if (String(intent.productId) !== req.params.id || String(intent.variantId) !== variantId || String(intent.userId) !== String(req.user.id) || intent.delta !== delta || intent.reason !== reason.trim()) throw new AppError("Clave usada para otro movimiento", 409);
    // Every attempt writes the same intent inside the stock transaction. A
    // rejected intent fences any delayed request from applying it afterwards.
    intent.revision += 1; await intent.save({ session });
    if (intent.state === "rejected") return { rejection: intent.rejection };
    const old = await ProductHistory.findOne({ movementKey: operationKey }).session(session);
    if (old) {
      if (String(old.productId) !== req.params.id || String(old.variantId) !== variantId || old.quantityChange !== delta || old.summary !== reason.trim() || String(old.userId) !== String(req.user.id)) throw new AppError("Clave usada para otro movimiento", 409);
      const current = await Product.findById(old.productId).select("variants").session(session).lean();
      intent.state = "applied"; await intent.save({ session });
      return { stock: old.stockAfter, currentStock: current?.variants.find((v) => String(v._id) === variantId)?.stock ?? null, movementId: old._id, repeated: true };
    }
    if (intent.state === "applied") throw new AppError("La evidencia del movimiento requiere revisión; no se repetirá el ajuste", 409);
    const source = await Product.findById(req.params.id).select("variants").session(session).lean();
    const target = source?.variants.find((v) => String(v._id) === variantId);
    let rejection = !target ? "Variante no disponible" : !Number.isSafeInteger(target.stock) || !Number.isSafeInteger(target.stock + delta) ? "El stock histórico requiere conciliación previa" : target.stock + delta < 0 ? "Stock insuficiente" : "";
    if (rejection) { intent.state = "rejected"; intent.rejection = rejection; await intent.save({ session }); return { rejection }; }
    const product = await Product.findOneAndUpdate({ _id: req.params.id,
      variants: { $elemMatch: { _id: variantId, stock: { $gte: Math.max(0, -delta) } } } },
      { $inc: { "variants.$.stock": delta } }, { session, new: true });
    if (!product) throw new AppError("Variante no disponible o stock insuficiente", 409);
    const variant = product.variants.id(variantId);
    if (!Number.isSafeInteger(variant.stock)) throw new AppError("El stock histórico requiere conciliación previa", 409);
    await product.populate("variants.size variants.color");
    const [movement] = await ProductHistory.create([{
      movementKey: operationKey, productId: product._id, productName: product.name, productSlug: product.slug, variantId,
      sku: variant.sku, eventType: "stock_adjustment", quantityChange: delta,
      sizeName: variant.size?.name || null, colorName: variant.color?.name || null,
      stockBefore: variant.stock - delta, stockAfter: variant.stock, summary: reason.trim(),
      userId: req.user.id, userEmail: req.user.email, role: req.user.role, referenceType: "admin",
    }], { session });
    intent.state = "applied"; await intent.save({ session });
    return { stock: variant.stock, currentStock: variant.stock, movementId: movement._id, repeated: false };
  });
  if (result.rejection) return res.status(409).json({ status: "fail", message: result.rejection, operationRejected: true });
  res.json({ status: "success", ...result });
});

exports.getStockOperation = catchAsync(async (req, res) => {
  const { operationKey } = req.params;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(operationKey)) throw new AppError("Clave inválida", 400);
  const movement = await ProductHistory.findOne({ movementKey: operationKey, productId: req.params.id, userId: req.user.id }).lean();
  if (!movement) {
    const intent = await require("../models/stockAdjustment").findOne({ _id: operationKey, productId: req.params.id, userId: req.user.id }).lean();
    return res.json({ status: "success", found: false, rejected: intent?.state === "rejected", message: intent?.state === "rejected" ? intent.rejection : undefined });
  }
  const current = await Product.findById(movement.productId).select("variants").lean();
  res.json({ status: "success", found: true, movementId: movement._id, variantId: movement.variantId,
    delta: movement.quantityChange, reason: movement.summary, stock: movement.stockAfter,
    currentStock: current?.variants.find((v) => String(v._id) === String(movement.variantId))?.stock ?? null, createdAt: movement.createdAt });
});
