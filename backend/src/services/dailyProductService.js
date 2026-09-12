const Product = require("../models/product");
const WeaveType = require("../models/weaveType");
const DailyProductPick = require("../models/dailyProductPick");
const { formatProductPublic } = require("../utils/productFormatter");

const populateList = "category weaveType style variants.size variants.color";

/** Descubre hoy: 1 grande + 2×2 (hasta 5 piezas). */
const PRODUCT_SLOT_COUNT = 5;
/** Diversidad: hasta 3 categorías al armar la selección de productos. */
const CATEGORY_SAMPLE = 3;
/** Colección / tejidos: 1 grande + 2 medias. */
const WEAVE_SLOT_COUNT = 3;

/**
 * Ventana de 24h = día calendario en America/Bogota (UTC-5, sin DST).
 * dateKey = YYYY-MM-DD. Misma lista para todos hasta las 00:00 Bogotá.
 */
exports.getBogotaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

exports.PRODUCT_SLOT_COUNT = PRODUCT_SLOT_COUNT;
exports.WEAVE_SLOT_COUNT = WEAVE_SLOT_COUNT;
/** @deprecated alias */
exports.SLOT_COUNT = PRODUCT_SLOT_COUNT;

async function pickCategoriesAndProducts(limit = PRODUCT_SLOT_COUNT) {
  const capped = Math.min(
    PRODUCT_SLOT_COUNT,
    Math.max(1, Number(limit) || PRODUCT_SLOT_COUNT)
  );
  const categorySample = Math.min(CATEGORY_SAMPLE, capped);

  const sampledCategories = await Product.aggregate([
    { $match: { isActive: true, category: { $exists: true, $ne: null } } },
    { $group: { _id: "$category" } },
    { $sample: { size: categorySample } },
  ]);

  const categoryIds = sampledCategories.map((c) => c._id).filter(Boolean);
  const productIds = [];

  for (const categoryId of categoryIds) {
    const sampled = await Product.aggregate([
      { $match: { isActive: true, category: categoryId } },
      { $sample: { size: 1 } },
      { $project: { _id: 1 } },
    ]);
    if (sampled[0]?._id) productIds.push(sampled[0]._id);
  }

  if (productIds.length < capped) {
    const filler = await Product.aggregate([
      {
        $match: {
          isActive: true,
          ...(productIds.length ? { _id: { $nin: productIds } } : {}),
        },
      },
      { $sample: { size: capped - productIds.length } },
      { $project: { _id: 1 } },
    ]);
    for (const doc of filler) {
      if (doc?._id) productIds.push(doc._id);
    }
  }

  return { categoryIds, productIds: productIds.slice(0, capped) };
}

async function pickRandomWeaveIds(limit = WEAVE_SLOT_COUNT) {
  const capped = Math.min(
    WEAVE_SLOT_COUNT,
    Math.max(1, Number(limit) || WEAVE_SLOT_COUNT)
  );
  const sampled = await WeaveType.aggregate([
    { $match: { isActive: true } },
    { $sample: { size: capped } },
    { $project: { _id: 1 } },
  ]);
  return sampled.map((w) => w._id);
}

async function loadWeaveTypes(ids = []) {
  if (!ids.length) return [];
  const weaves = await WeaveType.find({
    _id: { $in: ids },
    isActive: true,
  }).sort("sortOrder name");
  const byId = new Map(weaves.map((w) => [String(w._id), w]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((w) => ({
      _id: String(w._id),
      id: String(w._id),
      name: w.name,
      slug: w.slug,
      description: w.description || "",
    }));
}

exports.getOrCreateDailyPicks = async (limit = PRODUCT_SLOT_COUNT) => {
  const capped = Math.min(
    PRODUCT_SLOT_COUNT,
    Math.max(1, Number(limit) || PRODUCT_SLOT_COUNT)
  );
  const dateKey = exports.getBogotaDateKey();

  let pick = await DailyProductPick.findOne({ dateKey });

  if (!pick) {
    const { categoryIds, productIds } = await pickCategoriesAndProducts(capped);
    const weaveTypeIds = await pickRandomWeaveIds(WEAVE_SLOT_COUNT);
    try {
      pick = await DailyProductPick.create({
        dateKey,
        productIds,
        categoryIds,
        weaveTypeIds,
      });
    } catch (err) {
      if (err?.code === 11000) {
        pick = await DailyProductPick.findOne({ dateKey });
      } else {
        throw err;
      }
    }
  }

  if (pick && (!pick.weaveTypeIds || pick.weaveTypeIds.length === 0)) {
    pick.weaveTypeIds = await pickRandomWeaveIds(WEAVE_SLOT_COUNT);
    await pick.save();
  }

  const weaveTypes = await loadWeaveTypes(pick?.weaveTypeIds || []);

  if (!pick?.productIds?.length) {
    return { dateKey, categoryIds: [], weaveTypes, products: [] };
  }

  const products = await Product.find({
    _id: { $in: pick.productIds },
    isActive: true,
  }).populate(populateList);

  const byId = new Map(products.map((p) => [String(p._id), p]));
  const ordered = pick.productIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .slice(0, capped);

  return {
    dateKey,
    categoryIds: (pick.categoryIds || []).map((id) => String(id)),
    weaveTypes,
    products: ordered.map(formatProductPublic),
  };
};
