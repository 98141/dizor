const Product = require("../models/product");
const Category = require("../models/category");
const Color = require("../models/color");
const Size = require("../models/size");
const WeaveType = require("../models/weaveType");
const Style = require("../models/style");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { formatProductPublic } = require("../utils/productFormatter");

const populateList =
  "category weaveType style variants.size variants.color";
const populateDetail =
  "category weaveType style variants.size variants.color";

const buildProductFilter = (query) => {
  const filter = { isActive: true };

  if (query.category) filter.category = query.category;
  if (query.weaveType) filter.weaveType = query.weaveType;
  if (query.style) filter.style = query.style;
  if (query.onPromotion === "true") filter.onPromotion = true;
  if (query.featured === "true") filter.isFeatured = true;
  if (query.isNew === "true") filter.isNew = true;

  if (query.minPrice || query.maxPrice) {
    filter.salePrice = {};
    if (query.minPrice) filter.salePrice.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.salePrice.$lte = Number(query.maxPrice);
  }

  if (query.q?.trim()) {
    filter.$text = { $search: query.q.trim() };
  }

  const variantMatch = { isActive: true };
  if (query.size) variantMatch.size = query.size;
  if (query.color) variantMatch.color = query.color;
  if (query.inStock === "true") variantMatch.stock = { $gt: 0 };

  if (query.size || query.color || query.inStock === "true") {
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

  if (!product) {
    return next(new AppError("Producto no encontrado", 404));
  }

  if (product.isActive) {
    product.viewsCount += 1;
    await product.save({ validateBeforeSave: false });
  }

  const relatedFilter = {
    isActive: true,
    _id: { $ne: product._id },
    $or: [{ category: product.category }, { style: product.style }],
  };

  const related = await Product.find(relatedFilter)
    .populate(populateList)
    .sort({ salesCount: -1 })
    .limit(4);

  const formatted = formatProductPublic(product);

  res.status(200).json({
    status: "success",
    product: formatted,
    preview: staffPreview && !product.isActive,
    related: related.map(formatProductPublic),
  });
});
