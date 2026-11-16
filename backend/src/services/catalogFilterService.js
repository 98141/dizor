/**
 * Catálogo público — filtros y facetas contextuales.
 *
 * Alcance (scope): lo que el cliente está mirando — categoría (navbar),
 * destacados, novedades o búsqueda. No se muestra como filtro editable.
 *
 * Refinamientos: tejido, horma, talla, color (multiselección: `?size=s,m`),
 * precio, disponibles, promoción. Dentro de un grupo las opciones se suman
 * (O); entre grupos se combinan (Y). Talla/color/stock se evalúan sobre la
 * misma variante ("talla S en negro" exige una variante S-negro).
 *
 * Las taxonomías se aceptan por slug (URLs legibles) o por ObjectId (enlaces
 * antiguos, CMS del home).
 *
 * Facetas: una sola agregación Mongo ($facet) sobre el alcance, con conteo
 * "disyuntivo": cada grupo cuenta con todos los demás refinamientos aplicados
 * excepto el propio, así las opciones visibles siempre llevan a resultados.
 */
const Product = require("../models/product");
const Category = require("../models/category");
const WeaveType = require("../models/weaveType");
const Style = require("../models/style");
const Size = require("../models/size");
const Color = require("../models/color");
const {
  isValidObjectId,
  pickQueryValue,
  toObjectId,
} = require("../utils/objectIdUtils");

/** Máximo de valores por grupo en la URL. */
const MAX_TOKENS = 20;
/** Slug o ObjectId (ya en minúsculas). */
const TOKEN_RE = /^[a-z0-9-]{1,80}$/;

const REFINE_GROUPS = [
  { key: "weaveType", Model: WeaveType },
  { key: "style", Model: Style },
  { key: "size", Model: Size },
  { key: "color", Model: Color },
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePrice = (raw) => {
  const str = String(raw ?? "").trim();
  // Solo enteros/decimales no negativos; cualquier otra cosa se ignora.
  if (!/^\d+(\.\d+)?$/.test(str)) return null;
  return Math.round(Number(str));
};

const splitTokens = (raw) =>
  [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => TOKEN_RE.test(t))
    ),
  ].slice(0, MAX_TOKENS);

/**
 * Resuelve slugs / ids → ids existentes (string). Lo que no existe se ignora.
 */
async function resolveRefs(Model, tokens) {
  if (!tokens.length) return [];
  const ids = tokens.filter(isValidObjectId).map(toObjectId);
  const slugs = tokens.filter((t) => !isValidObjectId(t));
  const or = [];
  if (ids.length) or.push({ _id: { $in: ids } });
  if (slugs.length) or.push({ slug: { $in: slugs } });
  const docs = await Model.find({ $or: or }).select("_id").lean();
  return docs.map((d) => String(d._id));
}

/** Normaliza query → { scope, refine } con ids resueltos. Ignora lo inválido. */
async function parseCatalogQuery(query = {}) {
  const pv = (key) => pickQueryValue(query, key);

  const [category, ...groups] = await Promise.all([
    resolveRefs(Category, splitTokens(pv("category")).slice(0, 1)),
    ...REFINE_GROUPS.map(({ key, Model }) =>
      resolveRefs(Model, splitTokens(pv(key)))
    ),
  ]);
  const refs = Object.fromEntries(
    REFINE_GROUPS.map(({ key }, i) => [key, groups[i]])
  );

  let minPrice = parsePrice(pv("minPrice"));
  let maxPrice = parsePrice(pv("maxPrice"));
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    scope: {
      category: category[0] || null,
      featured: pv("featured") === "true",
      isNew: pv("isNew") === "true",
      term: (pv("term") || "").trim().slice(0, 80) || null,
    },
    refine: {
      ...refs,
      inStock: pv("inStock") === "true",
      onPromotion: pv("onPromotion") === "true",
      minPrice,
      maxPrice,
    },
  };
}

/* ─── Expresiones Mongo ─── */

const oids = (ids) => ids.map(toObjectId);

const promoActiveQuery = (now) => ({
  onPromotion: true,
  discountPercent: { $gt: 0 },
  $or: [{ promotionEndsAt: null }, { promotionEndsAt: { $gt: now } }],
});

/** Promoción vigente como expresión de agregación. */
const promoActiveExpr = (now) => ({
  $and: [
    { $eq: ["$onPromotion", true] },
    { $gt: ["$discountPercent", 0] },
    {
      $or: [
        { $eq: [{ $ifNull: ["$promotionEndsAt", null] }, null] },
        { $gt: ["$promotionEndsAt", now] },
      ],
    },
  ],
});

/**
 * Precio efectivo (= Product#getEffectivePrice) como expresión de agregación.
 * Redondeo como Math.round ($round de Mongo redondea .5 al par).
 */
const effectivePriceExpr = (now) => ({
  $cond: [
    promoActiveExpr(now),
    {
      $floor: {
        $add: [
          {
            $multiply: [
              "$salePrice",
              { $subtract: [1, { $divide: ["$discountPercent", 100] }] },
            ],
          },
          0.5,
        ],
      },
    },
    "$salePrice",
  ],
});

function buildScopeFilter(scope) {
  const filter = { isActive: true };
  if (scope.category) filter.category = toObjectId(scope.category);
  if (scope.featured) filter.isFeatured = true;
  if (scope.isNew) filter.isNew = true;
  if (scope.term) {
    const regex = new RegExp(escapeRegex(scope.term), "i");
    filter.$or = [
      { name: regex },
      { shortDescription: regex },
      { material: regex },
      { slug: regex },
    ];
  }
  return filter;
}

/** Variante que cumple talla/color/stock (omitiendo `skip`) — para $elemMatch. */
function variantElemMatch(refine, skip) {
  const match = { isActive: true };
  let any = false;
  if (skip !== "size" && refine.size.length) {
    match.size = { $in: oids(refine.size) };
    any = true;
  }
  if (skip !== "color" && refine.color.length) {
    match.color = { $in: oids(refine.color) };
    any = true;
  }
  if (skip !== "inStock" && refine.inStock) {
    match.stock = { $gt: 0 };
    any = true;
  }
  return any ? match : null;
}

/** La misma condición como expresión sobre `$$v` (para $filter). */
function variantExpr(refine, skip) {
  const conds = [{ $eq: ["$$v.isActive", true] }];
  if (skip !== "size" && refine.size.length)
    conds.push({ $in: ["$$v.size", oids(refine.size)] });
  if (skip !== "color" && refine.color.length)
    conds.push({ $in: ["$$v.color", oids(refine.color)] });
  if (skip !== "inStock" && refine.inStock) conds.push({ $gt: ["$$v.stock", 0] });
  return { $and: conds };
}

/**
 * Condiciones de refinamiento (para $and), omitiendo el grupo `skip`.
 * - mode "find": sobre productos (precio vía $expr).
 * - mode "facet": sobre la proyección de facetas (_eff y _promo precalculados).
 */
function refineConditions(refine, now, { skip = null, mode = "find" } = {}) {
  const and = [];
  for (const key of ["weaveType", "style"]) {
    if (skip !== key && refine[key].length) {
      and.push({ [key]: { $in: oids(refine[key]) } });
    }
  }
  if (skip !== "onPromotion" && refine.onPromotion) {
    and.push(mode === "facet" ? { _promo: true } : promoActiveQuery(now));
  }
  const hasPrice = refine.minPrice != null || refine.maxPrice != null;
  if (skip !== "price" && hasPrice) {
    if (mode === "facet") {
      const range = {};
      if (refine.minPrice != null) range.$gte = refine.minPrice;
      if (refine.maxPrice != null) range.$lte = refine.maxPrice;
      and.push({ _eff: range });
    } else {
      const eff = effectivePriceExpr(now);
      const conds = [];
      if (refine.minPrice != null) conds.push({ $gte: [eff, refine.minPrice] });
      if (refine.maxPrice != null) conds.push({ $lte: [eff, refine.maxPrice] });
      and.push({ $expr: conds.length === 1 ? conds[0] : { $and: conds } });
    }
  }
  const variant = variantElemMatch(refine, skip);
  if (variant) and.push({ variants: { $elemMatch: variant } });
  return and;
}

const andOf = (conds) => (conds.length ? { $and: conds } : {});

/** Filtro Mongo completo (alcance + refinamientos) para el listado. */
function buildCatalogFilter({ scope, refine }, now = new Date()) {
  const filter = buildScopeFilter(scope);
  const and = refineConditions(refine, now);
  if (and.length) filter.$and = and;
  return filter;
}

/* ─── Facetas (agregación) ─── */

const activeVariants = (refine, skip) => ({
  $filter: {
    input: { $ifNull: ["$variants", []] },
    as: "v",
    cond: variantExpr(refine, skip),
  },
});

/** Conteo de productos distintos por talla/color de sus variantes válidas. */
const variantFacet = (refine, field, match) => [
  { $match: match },
  {
    $project: {
      ids: {
        $setUnion: [
          { $map: { input: activeVariants(refine, field), as: "v", in: `$$v.${field}` } },
        ],
      },
    },
  },
  { $unwind: "$ids" },
  { $group: { _id: "$ids", count: { $sum: 1 } } },
];

/** Une conteos con la taxonomía (solo activas), ordenadas como en el admin. */
async function decorate(Model, rows, extraFields = "") {
  const counts = new Map(
    rows.filter((r) => r._id).map((r) => [String(r._id), r.count])
  );
  if (!counts.size) return [];
  const docs = await Model.find({
    _id: { $in: oids([...counts.keys()]) },
    isActive: { $ne: false },
  })
    .select(`name slug sortOrder ${extraFields}`.trim())
    .lean();
  return docs
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name, "es")
    )
    .map((d) => ({
      _id: String(d._id),
      slug: d.slug,
      name: d.name,
      ...(d.hexCode ? { hexCode: d.hexCode } : {}),
      count: counts.get(String(d._id)),
    }));
}

/**
 * Facetas contextuales del catálogo.
 * @param {object} parsed resultado de parseCatalogQuery
 * @returns {Promise<{ total:number, weaveTypes, styles, sizes, colors,
 *   inStock:{count,total}, onPromotion:{count,total}, price:{min,max}|null }>}
 *   Cada opción: { _id, slug, name, hexCode?, count }.
 */
async function getCatalogFacets(parsed, now = new Date()) {
  const { scope, refine } = parsed;
  const match = (skip) =>
    andOf(refineConditions(refine, now, { skip, mode: "facet" }));
  const groupBy = (field) => [
    { $match: match(field) },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ];

  const [res] = await Product.aggregate([
    { $match: buildScopeFilter(scope) },
    {
      $project: {
        weaveType: 1,
        style: 1,
        variants: 1,
        _eff: effectivePriceExpr(now),
        _promo: promoActiveExpr(now),
      },
    },
    {
      $facet: {
        total: [{ $match: match(null) }, { $count: "n" }],
        weaveTypes: groupBy("weaveType"),
        styles: groupBy("style"),
        sizes: variantFacet(refine, "size", match("size")),
        colors: variantFacet(refine, "color", match("color")),
        inStock: [
          { $match: match("inStock") },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              count: {
                $sum: {
                  $cond: [
                    {
                      $gt: [
                        { $size: activeVariants({ ...refine, inStock: true }, null) },
                        0,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        onPromotion: [
          { $match: match("onPromotion") },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              count: { $sum: { $cond: ["$_promo", 1, 0] } },
            },
          },
        ],
        price: [
          { $match: match("price") },
          { $group: { _id: null, min: { $min: "$_eff" }, max: { $max: "$_eff" } } },
        ],
      },
    },
  ]);

  const [weaveTypes, styles, sizes, colors] = await Promise.all([
    decorate(WeaveType, res.weaveTypes),
    decorate(Style, res.styles),
    decorate(Size, res.sizes),
    decorate(Color, res.colors, "hexCode"),
  ]);
  const stat = (row) => ({ count: row?.count || 0, total: row?.total || 0 });
  const price = res.price[0];

  return {
    total: res.total[0]?.n || 0,
    weaveTypes,
    styles,
    sizes,
    colors,
    inStock: stat(res.inStock[0]),
    onPromotion: stat(res.onPromotion[0]),
    price: price && price.min != null ? { min: price.min, max: price.max } : null,
  };
}

module.exports = {
  parseCatalogQuery,
  buildCatalogFilter,
  effectivePriceExpr,
  getCatalogFacets,
};
