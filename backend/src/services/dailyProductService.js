const Product = require("../models/product");
const DailyProductPick = require("../models/dailyProductPick");
const { formatProductPublic } = require("../utils/productFormatter");

const populateList = "category weaveType style variants.size variants.color";
const MAX_PICKS = 10;

/**
 * Ventana de 24h = día calendario en America/Bogota (UTC-5, sin DST).
 * dateKey = YYYY-MM-DD. Misma lista para todos hasta que cambia el día.
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

async function pickRandomActiveIds(limit) {
  const sampled = await Product.aggregate([
    { $match: { isActive: true } },
    { $sample: { size: limit } },
    { $project: { _id: 1 } },
  ]);
  return sampled.map((p) => p._id);
}

exports.getOrCreateDailyPicks = async (limit = MAX_PICKS) => {
  const capped = Math.min(MAX_PICKS, Math.max(1, Number(limit) || MAX_PICKS));
  const dateKey = exports.getBogotaDateKey();

  let pick = await DailyProductPick.findOne({ dateKey });

  if (!pick) {
    const productIds = await pickRandomActiveIds(capped);
    try {
      pick = await DailyProductPick.create({ dateKey, productIds });
    } catch (err) {
      // Carrera entre requests concurrentes: reutilizar el documento creado
      if (err?.code === 11000) {
        pick = await DailyProductPick.findOne({ dateKey });
      } else {
        throw err;
      }
    }
  }

  if (!pick?.productIds?.length) {
    return { dateKey, products: [] };
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
    products: ordered.map(formatProductPublic),
  };
};
