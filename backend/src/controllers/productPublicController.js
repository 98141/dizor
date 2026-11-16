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

const populateList = "category weaveType style variants.size variants.color";
const populateDetail = "category weaveType style variants.size variants.color";

const {
  parseCatalogQuery,
  buildCatalogFilter,
  effectivePriceExpr,
  getCatalogFacets,
} = require("../services/catalogFilterService");

const buildProductFilter = async (query) => {
  const filter = { isActive: true };

  const idsRaw = pickQueryValue(query, "ids");
  if (idsRaw) {
    const idList = String(idsRaw)
      .split(",")
      .map((s) => s.trim())
      .filter((id) => isValidObjectId(id))
      .slice(0, 48)
      .map((id) => toObjectId(id))
      .filter(Boolean);
    if (idList.length > 0) {
      filter._id = { $in: idList };
    } else {
      // ids inválidos → ningún resultado
      filter._id = { $in: [] };
    }
    return filter;
  }

  // Alcance + refinamientos (slugs o ids; precio efectivo, promo vigente, variantes).
  return buildCatalogFilter(await parseCatalogQuery(query));
};

/** Orden del listado; `_id` desempata para paginación estable. */
const getSort = (sort) => {
  switch (sort) {
    case "price_asc":
      return { _effectivePrice: 1, _id: 1 };
    case "price_desc":
      return { _effectivePrice: -1, _id: -1 };
    case "popular":
      return { salesCount: -1, viewsCount: -1, _id: -1 };
    case "name_asc":
      return { name: 1, _id: 1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
};

const isPriceSort = (sort) => sort === "price_asc" || sort === "price_desc";

const normalizeSlugParam = (raw) =>
  decodeURIComponent(String(raw || ""))
    .trim()
    .toLowerCase();

const canPreviewInactive = (role) => ["superadmin", "admin"].includes(role);

/**
 * Taxonomía completa (navbar, home, admin) + `facets` contextuales:
 * opciones con conteo según lo que se está mirando (mismos query params
 * que GET /products).
 */
exports.getCatalogFilters = catchAsync(async (req, res) => {
  const [categories, colors, sizes, weaveTypes, styles, facets] =
    await Promise.all([
      Category.find({ isActive: true }).sort("sortOrder name"),
      Color.find({ isActive: true }).sort("sortOrder name"),
      Size.find({ isActive: true }).sort("sortOrder name"),
      WeaveType.find({ isActive: true }).sort("sortOrder name"),
      Style.find({ isActive: true }).sort("sortOrder name"),
      parseCatalogQuery(req.query).then((parsed) => getCatalogFacets(parsed)),
    ]);

  res.status(200).json({
    status: "success",
    filters: { categories, colors, sizes, weaveTypes, styles },
    facets,
  });
});

exports.getProducts = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  const filter = await buildProductFilter(req.query);
  const sort = getSort(req.query.sort);

  // Orden por precio efectivo (con descuento vigente) requiere agregación.
  const listQuery = isPriceSort(req.query.sort)
    ? Product.aggregate([
        { $match: filter },
        { $addFields: { _effectivePrice: effectivePriceExpr(new Date()) } },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
        { $unset: "_effectivePrice" },
      ]).then(async (docs) => {
        const hydrated = docs.map((d) => Product.hydrate(d));
        await Product.populate(hydrated, populateList);
        return hydrated;
      })
    : Product.find(filter)
        .populate(populateList)
        .sort(sort)
        .skip(skip)
        .limit(limit);

  const [products, total] = await Promise.all([
    listQuery,
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

  const products = await Product.find({
    isActive: true,
    isFeatured: true,
  })
    .populate(populateList)
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: products.length,
    products: products.map(formatProductPublic),
  });
});

/**
 * Carrusel catálogo del home (hasta 10, sin nuevo/destacado).
 * Selección estable 24h — medianoche America/Bogota.
 * Query: limit (1–10).
 */
exports.getRandomSampleProducts = catchAsync(async (req, res) => {
  const {
    getOrCreateExplorePicks,
    EXPLORE_SLOT_COUNT,
  } = require("../services/dailyProductService");
  const limit = Math.min(
    EXPLORE_SLOT_COUNT,
    Math.max(1, parseInt(req.query.limit, 10) || EXPLORE_SLOT_COUNT)
  );
  const { dateKey, products } = await getOrCreateExplorePicks(limit);

  res.status(200).json({
    status: "success",
    dateKey,
    results: products.length,
    products,
  });
});

/** Selección aleatoria cacheada 24h (día America/Bogota). */
exports.getDailyRandomProducts = catchAsync(async (req, res) => {
  const {
    getOrCreateDailyPicks,
    PRODUCT_SLOT_COUNT,
  } = require("../services/dailyProductService");
  const limit = Math.min(
    PRODUCT_SLOT_COUNT,
    Math.max(1, parseInt(req.query.limit, 10) || PRODUCT_SLOT_COUNT)
  );
  const { dateKey, categoryIds, weaveTypes, products } =
    await getOrCreateDailyPicks(limit);

  res.status(200).json({
    status: "success",
    dateKey,
    categoryIds,
    weaveTypes,
    results: products.length,
    products,
  });
});

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
          "i",
        ),
      },
    };

    if (!staffPreview) {
      looseFilter.isActive = true;
    }

    product = await Product.findOne(looseFilter).populate(populateDetail);
  }

  if (!product && /^[a-f\d]{24}$/i.test(slug) && staffPreview) {
    product = await Product.findById(slug).populate(populateDetail);
  }

  if (!product && isValidObjectId(slug)) {
    const byIdFilter = { _id: slug };

    if (!staffPreview) {
      byIdFilter.isActive = true;
    }

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
    $or: [
      ...(categoryId ? [{ category: categoryId }] : []),
      ...(styleId ? [{ style: styleId }] : []),
    ],
  };

  let related = [];

  if (relatedFilter.$or.length > 0) {
    const relatedCandidates = await Product.find(relatedFilter)
      .populate(populateList)
      .sort({ salesCount: -1 })
      .limit(8);

    related = relatedCandidates
      .filter((item) => String(item._id) !== String(product._id))
      .slice(0, 4);
  }

  const formatted = formatProductPublic(product);

  res.status(200).json({
    status: "success",
    product: formatted,
    preview: staffPreview && !product.isActive,
    related: related.map(formatProductPublic),
  });
});
