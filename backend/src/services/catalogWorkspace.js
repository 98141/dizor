const mongoose = require("mongoose");
const Product = require("../models/product");
const AppError = require("../utils/AppError");
const { formatProductAdmin } = require("../utils/productFormatter");
const criteria = require("./inventoryCriteria");
const admin = (role) => ["admin", "superadmin"].includes(role);
exports.objectId = (value) => {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) throw new AppError("Identificador inválido", 400);
  return new mongoose.Types.ObjectId(value);
};
exports.page = (query, max = 100) => {
  for (const field of ["page", "limit"]) if (query[field] !== undefined && !/^\d{1,7}$/.test(String(query[field]))) throw new AppError("Paginación inválida", 400);
  return { page: Math.max(1, Number(query.page) || 1), limit: Math.max(1, Math.min(max, Number(query.limit) || 20)) };
};
exports.filter = (query) => {
  const filter = {};
  if (query.isActive !== undefined && query.isActive !== "") {
    if (!["true", "false"].includes(query.isActive)) throw new AppError("Estado de publicación inválido", 400);
    filter.isActive = query.isActive === "true";
  }
  for (const field of ["category", "weaveType"]) if (query[field]) filter[field] = exports.objectId(query[field]);
  if (query.productId) filter._id = exports.objectId(query.productId);
  if (query.q) {
    if (typeof query.q !== "string" || query.q.length > 160) throw new AppError("Búsqueda inválida", 400);
    const q = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (q) filter.$or = ["name", "slug", "variants.sku"].map((key) => ({ [key]: { $regex: q, $options: "i" } }));
  }
  return filter;
};
exports.format = (product, role) => {
  const result = formatProductAdmin(product, role);
  result.inventory = criteria.summarize(product);
  result.effectivePrice = Product.schema.methods.getEffectivePrice.call(product);
  if (admin(role)) result.margin = result.internalCost != null ? result.effectivePrice - result.internalCost : null;
  result.inStock = result.inventory.availableStock > 0;
  result.totalStock = result.inventory.totalStock;
  result.variants = result.variants.map((v) => ({ ...v, stockStatus: criteria.variantStatus(v) }));
  return result;
};
exports.query = async (query, role) => {
  const { page, limit } = exports.page(query);
  const stages = [{ $match: exports.filter(query) }, ...criteria.inventoryStages()];
  if (query.stock) {
    if (!["available", "low", "out", "healthy", "review"].includes(query.stock)) throw new AppError("Filtro de existencias inválido", 400);
    stages.push({ $match: query.stock === "available" ? { "_inventory.validStock": { $gt: 0 } } : { "_inventory.stockStatus": query.stock } });
  }
  if (!admin(role)) stages.push({ $unset: "internalCost" });
  stages.push({ $facet: { total: [{ $count: "count" }], rows: [
    { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $unset: ["_activeVariants", "_inventory"] },
  ] } });
  const [result] = await Product.aggregate(stages);
  const docs = result.rows;
  await Product.populate(docs, "category weaveType style variants.size variants.color");
  const total = result.total[0]?.count || 0;
  return { status: "success", results: docs.length, total, page, totalPages: Math.max(1, Math.ceil(total / limit)),
    threshold: criteria.LOW_STOCK_THRESHOLD, products: docs.map((p) => exports.format(p, role)) };
};
