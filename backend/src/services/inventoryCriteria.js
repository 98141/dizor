const LOW_STOCK_THRESHOLD = 5;
exports.LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;
exports.variantStatus = (variant) => variant.isActive === false ? "inactive"
  : !Number.isSafeInteger(variant.stock) || variant.stock < 0 ? "review"
    : variant.stock === 0 ? "out" : variant.stock <= LOW_STOCK_THRESHOLD ? "low" : "healthy";
exports.summarize = (product) => {
  const variants = product.variants || [], active = variants.filter((v) => v.isActive !== false);
  const totalStock = active.reduce((sum, v) => sum + (typeof v.stock === "number" ? v.stock : 0), 0);
  const outCount = active.filter((v) => exports.variantStatus(v) === "out").length;
  const lowCount = active.filter((v) => exports.variantStatus(v) === "low").length;
  const reviewCount = active.filter((v) => exports.variantStatus(v) === "review").length;
  const validStock = active.filter((v) => exports.variantStatus(v) !== "review").reduce((sum, v) => sum + v.stock, 0);
  return { threshold: LOW_STOCK_THRESHOLD, totalStock, availableStock: product.isActive === false ? 0 : validStock,
    variantCount: variants.length, activeVariantCount: active.length, outCount, lowCount, reviewCount,
    stockStatus: reviewCount ? "review" : !active.length || outCount ? "out" : lowCount ? "low" : "healthy",
    unavailable: !active.length || active.every((v) => v.stock === 0),
  };
};
const countWhere = (cond) => ({ $size: { $filter: { input: "$_activeVariants", as: "v", cond } } });
const validStock = { $cond: [{ $isNumber: "$$v.stock" }, { $and: [
  { $gte: ["$$v.stock", 0] }, { $lte: ["$$v.stock", Number.MAX_SAFE_INTEGER] }, { $eq: ["$$v.stock", { $trunc: "$$v.stock" }] },
] }, false] };
// MongoDB equivalent of summarize(), reused by filters, counts and alerts.
exports.inventoryStages = () => [
  { $set: { _activeVariants: { $filter: { input: { $ifNull: ["$variants", []] }, as: "v", cond: { $ne: ["$$v.isActive", false] } } } } },
  { $set: { _inventory: {
    totalStock: { $sum: "$_activeVariants.stock" }, activeVariantCount: { $size: "$_activeVariants" },
    validStock: { $sum: { $map: { input: "$_activeVariants", as: "v", in: { $cond: [validStock, "$$v.stock", 0] } } } },
    outCount: countWhere({ $eq: ["$$v.stock", 0] }),
    lowCount: countWhere({ $and: [validStock, { $gt: ["$$v.stock", 0] }, { $lte: ["$$v.stock", LOW_STOCK_THRESHOLD] }] }),
    reviewCount: countWhere({ $not: [validStock] }),
  } } },
  { $set: { "_inventory.stockStatus": { $switch: { branches: [
    { case: { $gt: ["$_inventory.reviewCount", 0] }, then: "review" },
    { case: { $or: [{ $eq: ["$_inventory.activeVariantCount", 0] }, { $gt: ["$_inventory.outCount", 0] }] }, then: "out" },
    { case: { $gt: ["$_inventory.lowCount", 0] }, then: "low" },
  ], default: "healthy" } } } },
];
// MongoDB equivalent of variantStatus() for one variant (same threshold and validity rule).
// Read-only analytics use it to count variants without loading the catalogue in memory.
exports.variantStatusExpression = (variant) => ({ $let: { vars: { v: variant }, in: { $switch: { branches: [
  { case: { $eq: ["$$v.isActive", false] }, then: "inactive" },
  { case: { $not: [validStock] }, then: "review" },
  { case: { $eq: ["$$v.stock", 0] }, then: "out" },
  { case: { $lte: ["$$v.stock", LOW_STOCK_THRESHOLD] }, then: "low" },
], default: "healthy" } } } });
exports.alertGroups = async () => {
  const Product = require("../models/product");
  const [result] = await Product.aggregate([{ $match: { isActive: true } }, ...exports.inventoryStages(),
    { $facet: Object.fromEntries(["out", "low", "review"].flatMap((status) => [
      [status, [{ $match: { "_inventory.stockStatus": status } }, { $sort: { name: 1, _id: 1 } }, { $limit: 10 }, { $project: { name: 1, slug: 1, variants: 1 } }]],
      [status + "Count", [{ $match: { "_inventory.stockStatus": status } }, { $count: "count" }]],
    ])) }]);
  const group = (status) => ({ count: result[status + "Count"][0]?.count || 0, threshold: LOW_STOCK_THRESHOLD,
    items: result[status].map((p) => ({ id: p._id, name: p.name, slug: p.slug, ...exports.summarize(p),
      affectedVariants: p.variants.filter((v) => ["out", "low", "review"].includes(exports.variantStatus(v))).map((v) => ({ id: v._id, sku: v.sku, stock: v.stock, stockStatus: exports.variantStatus(v) })),
    })) });
  return { outOfStock: group("out"), lowStock: group("low"), inventoryReview: group("review") };
};
