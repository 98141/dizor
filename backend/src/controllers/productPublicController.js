const Product = require("../models/product");
const Category = require("../models/category");
const Color = require("../models/color");
const Size = require("../models/size");
const WeaveType = require("../models/weaveType");
const Style = require("../models/style");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { formatProductPublic } = require("../utils/productFormatter");
const {
  isValidObjectId,
  pickQueryValue,
  toObjectId,
} = require("../utils/objectIdUtils");

const populateList =
  "category weaveType style variants.size variants.color";
const populateDetail =
  "category weaveType style variants.size variants.color";

const assignObjectIdFilter = (filter, key, rawValue) => {
  const value = pickQueryValue({ [key]: rawValue }, key);
  if (!value || !isValidObjectId(value)) return;
  filter[key] = toObjectId(value);
};

const buildProductFilter = (query) => {
  const filter = { isActive: true };

  assignObjectIdFilter(filter, "category", query.category);
  assignObjectIdFilter(filter, "weaveType", query.weaveType);
  assignObjectIdFilter(filter, "style", query.style);

  if (query.onPromotion === "true") filter.onPromotion = true;
  if (query.featured === "true") filter.isFeatured = true;
  if (query.isNew === "true") filter.isNew = true;

  if (query.minPrice || query.maxPrice) {
    filter.salePrice = {};
    if (query.minPrice) filter.salePrice.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.salePrice.$lte = Number(query.maxPrice);
  }

  if (query.q?.trim()) {
    const term = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { shortDescription: { $regex: term, $options: "i" } },
      { slug: { $regex: term, $options: "i" } },
    ];
  }

  const sizeId = pickQueryValue(query, "size");
  const colorId = pickQueryValue(query, "color");
  const variantMatch = { isActive: true };
  const sizeOid = toObjectId(sizeId);
  const colorOid = toObjectId(colorId);
  if (sizeOid) variantMatch.size = sizeOid;
  if (colorOid) variantMatch.color = colorOid;
  if (query.inStock === "true") variantMatch.stock = { $gt: 0 };

  if (sizeOid || colorOid || query.inStock === "true") {
    filter.variants = { $elemMatch: variantMatch };
  }

  return filter;
};

const getSort = (sort) => {
  switch (sort) {
    case "price_asc":
      return { salePrice: 1 };
    case "price_desc":
      return { salePrice: -1 };
    case "popular":
      return { salesCount: -1, viewsCount: -1 };
    case "name_asc":
      return { name: 1 };
    default:
      return { createdAt: -1 };
  }
};

exports.getCatalogFilters = catchAsync(async (req, res) => {
  const [categories, colors, sizes, weaveTypes, styles] = await Promise.all([
    Category.find({ isActive: true }).sort("sortOrder name"),
    Color.find({ isActive: true }).sort("sortOrder name"),
    Size.find({ isActive: true }).sort("sortOrder name"),
    WeaveType.find({ isActive: true }).sort("sortOrder name"),
    Style.find({ isActive: true }).sort("sortOrder name"),
  ]);

  res.status(200).json({
    status: "success",
    filters: { categories, colors, sizes, weaveTypes, styles },
  });
});

exports.getProducts = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  const filter = buildProductFilter(req.query);
  const sort = getSort(req.query.sort);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate(populateList)
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    status: "success",
    results: products.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    products: products.map(formatProductPublic),
  });
});

exports.getFeaturedProducts = catchAsync(async (req, res) => {
  const limit = Math.min(12, parseInt(req.query.limit, 10) || 8);

  const products = await Product.find({ isActive: true, isFeatured: true })
    .populate(populateList)
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: products.length,
    products: products.map(formatProductPublic),
  });
});

const normalizeSlugParam = (raw) =>
  decodeURIComponent(String(raw || ""))
    .trim()
    .toLowerCase();

const canPreviewInactive = (role) =>
  ["superadmin", "admin"].includes(role);

exports.getProductBySlug = catchAsync(async (req, res, next) => {
  const slug = normalizeSlugParam(req.params.slug);

  if (!slug) {
    return next(new AppError("Producto no encontrado", 404));
  }

  const staffPreview = canPreviewInactive(req.user?.role);
  const filter = { slug };
  if (!staffPreview) {
    filter.isActive = true;
  }

  let product = await Product.findOne(filter).populate(populateDetail);

  if (!product) {
    const looseFilter = {
      slug: {
        $regex: new RegExp(
          `^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    };
    if (!staffPreview) looseFilter.isActive = true;
    product = await Product.findOne(looseFilter).populate(populateDetail);
  }

  if (!product && /^[a-f\d]{24}$/i.test(slug) && staffPreview) {
    product = await Product.findById(slug).populate(populateDetail);
  }

  if (!product && isValidObjectId(slug)) {
    const byIdFilter = { _id: slug };
    if (!staffPreview) byIdFilter.isActive = true;
    product = await Product.findOne(byIdFilter).populate(populateDetail);
  }

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  if (product.isActive) {
    await Product.updateOne({ _id: product._id }, { $inc: { viewsCount: 1 } });
  }

  const categoryId = product.category?._id || product.category;
  const styleId = product.style?._id || product.style;

  const relatedFilter = {
    isActive: true,
    _id: { $ne: product._id },
    $or: [
      ...(categoryId ? [{ category: categoryId }] : []),
      ...(styleId ? [{ style: styleId }] : []),
    ],
  };

  const related =
    relatedFilter.$or?.length > 0
      ? await Product.find(relatedFilter)
          .populate(populateList)
          .sort({ salesCount: -1 })
          .limit(4)
      : [];

  const formatted = formatProductPublic(product);

  res.status(200).json({
    status: "success",
    product: formatted,
    preview: staffPreview && !product.isActive,
    related: related.map(formatProductPublic),
  });
});
