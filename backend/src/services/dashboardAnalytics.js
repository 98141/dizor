// Read-only commercial analytics for the admin home (Sprint 01).
// Reuses the audited criteria; it never writes, never exposes costs and never
// introduces a new financial rule:
// - Reconciled sales: financeCriteria.reconciledSalesFilter (same as Finanzas).
// - Accounting date: order createdAt, Colombian civil days (same basis as Finanzas, F7-01).
// - Review indicator: orderWorkspace.trayFilter("review") (same as the Pedidos tray).
// - Inventory: inventoryCriteria (centralised threshold and validity rule).
const Order = require("../models/order");
const Product = require("../models/product");
const Size = require("../models/size");
const Color = require("../models/color");
const AppError = require("../utils/AppError");
const { reconciledSalesFilter } = require("./financeCriteria");
const { trayFilter, dateBoundary } = require("./orderWorkspace");
const { inventoryStages, variantStatusExpression, LOW_STOCK_THRESHOLD } = require("./inventoryCriteria");
const { financePeriodKey } = require("../utils/financePeriod");

const TZ = "America/Bogota", DAY = 86400000, HOUR = 3600000, OFFSET = 5 * HOUR, MAX_DAYS = 731;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = { today: "Hoy", "7d": "Últimos 7 días", "30d": "Últimos 30 días", month: "Este mes", custom: "Rango personalizado" };
const STATUS_GROUPS = [
  ["pending", "Pendientes", ["pendiente", "pago_pendiente", "pagado"]],
  ["preparing", "En preparación", ["en_preparacion"]],
  ["shipped", "Enviados", ["enviado"]],
  ["delivered", "Entregados", ["entregado"]],
  ["cancelled", "Cancelados o rechazados", ["cancelado", "rechazado"]],
  ["returned", "Devueltos", ["devuelto"]],
];
const civilKey = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const shiftDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const spanOf = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
const round = (n) => Math.round(Number(n) || 0);
const deltaPct = (current, previous) => current == null || previous == null || previous <= 0 ? null
  : Math.round(((current - previous) / previous) * 1000) / 10;

exports.resolvePeriod = (query = {}, now = new Date()) => {
  const key = query.period === undefined ? "30d" : query.period;
  if (typeof key !== "string" || !Object.hasOwn(PERIODS, key)) throw new AppError("Periodo inválido", 400);
  const today = civilKey(now);
  let from, to = today;
  if (key === "custom") {
    if (typeof query.from !== "string" || typeof query.to !== "string" || !DATE.test(query.from) || !DATE.test(query.to)) {
      throw new AppError("El rango personalizado requiere fechas desde y hasta (AAAA-MM-DD)", 400);
    }
    ({ from, to } = query);
    dateBoundary(from); dateBoundary(to); // rejects impossible civil dates
    if (from > to) throw new AppError("La fecha inicial debe ser anterior o igual a la final", 400);
    if (from > today) throw new AppError("El rango no puede empezar en una fecha futura", 400);
    if (spanOf(from, to) > MAX_DAYS) throw new AppError(`El rango máximo es de ${MAX_DAYS} días`, 400);
  } else if (key === "month") from = `${today.slice(0, 7)}-01`;
  else from = shiftDays(today, -{ today: 0, "7d": 6, "30d": 29 }[key]);
  const start = dateBoundary(from), end = dateBoundary(to, true), spanDays = spanOf(from, to);
  const granularity = spanDays === 1 ? "hour" : spanDays <= 62 ? "day" : spanDays <= 371 ? "week" : "month";
  return { key, label: key === "custom" ? `Del ${from} al ${to}` : PERIODS[key], from, to, start, end, spanDays, granularity,
    effectiveEnd: new Date(Math.min(+end, +now)), basis: "createdAt" };
};

// Equivalent previous window: same elapsed duration, aligned to the same civil
// starting point. Returns `available:false` instead of a misleading comparison.
exports.previousWindow = (period, firstOrderAt) => {
  const elapsed = period.effectiveEnd - period.start;
  let start;
  if (period.key === "month") {
    const d = new Date(`${period.from}T00:00:00Z`);
    start = dateBoundary(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10));
    if (+start + elapsed > +period.start) return { available: false, reason: "El mes anterior es más corto que el tramo transcurrido de este mes; no hay un periodo equivalente." };
  } else start = new Date(+period.start - period.spanDays * DAY);
  if (!firstOrderAt || firstOrderAt > start) return { available: false, reason: "No hay historial suficiente para comparar con el periodo anterior equivalente." };
  const end = new Date(+start + elapsed);
  return { available: true, start, end, previousFrom: civilKey(start), previousTo: civilKey(new Date(+end - 1)) };
};

const BUCKET_FORMAT = { hour: "%Y-%m-%dT%H", day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m" };
exports.bucketKey = (date, granularity) => granularity === "hour"
  ? new Date(+date - OFFSET).toISOString().slice(0, 13) : financePeriodKey(date, granularity);
// Every bucket between the period start and now/end, so gaps are real zeros of a successful query.
exports.buckets = (period) => {
  const step = period.granularity === "hour" ? HOUR : DAY, list = [], seen = new Set();
  for (let t = +period.start; t < +period.effectiveEnd; t += step) {
    const key = exports.bucketKey(new Date(t), period.granularity);
    if (!seen.has(key)) { seen.add(key); list.push({ key, start: new Date(t).toISOString() }); }
  }
  return list;
};

const reconciledTotals = { $group: { _id: null, sales: { $sum: "$total" }, orders: { $sum: 1 }, units: { $sum: { $sum: "$items.quantity" } } } };
const lineRevenue = { $ifNull: ["$items.lineTotal", { $multiply: [{ $ifNull: ["$items.unitPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] }] };

const inventoryAttention = async () => {
  const [result] = await Product.aggregate([
    { $match: { isActive: true } },
    { $project: { name: 1, variants: { $filter: { input: { $ifNull: ["$variants", []] }, as: "v", cond: { $ne: ["$$v.isActive", false] } } } } },
    { $unwind: "$variants" },
    { $set: { _status: variantStatusExpression("$variants") } },
    { $match: { _status: { $in: ["out", "low", "review"] } } },
    { $facet: {
      counts: [{ $group: { _id: "$_status", count: { $sum: 1 } } }],
      items: [
        { $set: { _rank: { $switch: { branches: [{ case: { $eq: ["$_status", "out"] }, then: 0 }, { case: { $eq: ["$_status", "review"] }, then: 1 }], default: 2 } } } },
        { $sort: { _rank: 1, "variants.stock": 1, name: 1, _id: 1, "variants._id": 1 } }, { $limit: 6 },
        { $lookup: { from: Size.collection.name, localField: "variants.size", foreignField: "_id", as: "_size" } },
        { $lookup: { from: Color.collection.name, localField: "variants.color", foreignField: "_id", as: "_color" } },
        { $project: { name: 1, status: "$_status", variant: "$variants", size: { $arrayElemAt: ["$_size.name", 0] }, color: { $arrayElemAt: ["$_color.name", 0] } } },
      ],
    } },
  ]);
  const count = (status) => result.counts.find((c) => c._id === status)?.count || 0;
  return { threshold: LOW_STOCK_THRESHOLD, outVariants: count("out"), lowVariants: count("low"), reviewVariants: count("review"),
    items: result.items.map((r) => ({ productId: String(r._id), productName: r.name, variantId: String(r.variant._id), sku: r.variant.sku || "",
      size: r.size || null, color: r.color || null, status: r.status,
      // Invalid historical stock is reported as "review", never as a number.
      stock: r.status === "review" ? null : r.variant.stock })) };
};

exports.buildDashboardAnalytics = async (query = {}, now = new Date()) => {
  const period = exports.resolvePeriod(query, now);
  const reconciled = reconciledSalesFilter();
  const [[main], first, inventory] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: period.start, $lt: period.end } } },
      { $facet: {
        registered: [{ $count: "n" }],
        statuses: [{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }],
        review: [{ $match: trayFilter("review") }, { $count: "n" }],
        reconciled: [{ $match: reconciled }, reconciledTotals],
        series: [{ $match: reconciled }, { $group: { _id: { $dateToString: { format: BUCKET_FORMAT[period.granularity], date: "$createdAt", timezone: TZ } }, sales: { $sum: "$total" }, orders: { $sum: 1 } } }],
        products: [{ $match: reconciled }, { $unwind: "$items" }, { $sort: { createdAt: -1, _id: -1 } },
          { $group: { _id: "$items.product", units: { $sum: "$items.quantity" }, sales: { $sum: lineRevenue }, name: { $first: "$items.productName" }, image: { $first: "$items.productImage" } } }],
      } },
    ]),
    Order.findOne({}).sort({ createdAt: 1 }).select("createdAt").lean(),
    inventoryAttention(),
  ]);
  const totals = main.reconciled[0] || { sales: 0, orders: 0, units: 0 };
  const current = { reconciledSales: round(totals.sales), reconciledOrders: totals.orders, unitsSold: totals.units,
    ordersRegistered: main.registered[0]?.n || 0, averageTicket: totals.orders ? round(totals.sales / totals.orders) : null };

  const firstOrderAt = first?.createdAt || null;
  const window = exports.previousWindow(period, firstOrderAt);
  let comparison = { available: false, reason: window.reason };
  if (window.available) {
    const [prev] = await Order.aggregate([{ $match: { createdAt: { $gte: window.start, $lt: window.end } } },
      { $facet: { registered: [{ $count: "n" }], reconciled: [{ $match: reconciled }, reconciledTotals] } }]);
    const p = prev.reconciled[0] || { sales: 0, orders: 0, units: 0 };
    const previous = { reconciledSales: round(p.sales), ordersRegistered: prev.registered[0]?.n || 0, unitsSold: p.units,
      averageTicket: p.orders ? round(p.sales / p.orders) : null };
    comparison = { available: true, previousFrom: window.previousFrom, previousTo: window.previousTo,
      metrics: Object.fromEntries(Object.keys(previous).map((k) => [k, { previous: previous[k], deltaPct: deltaPct(current[k], previous[k]) }])) };
  }

  const bySeries = new Map(main.series.map((s) => [s._id, s]));
  const series = exports.buckets(period).map((b) => ({ ...b, sales: round(bySeries.get(b.key)?.sales), orders: bySeries.get(b.key)?.orders || 0 }));

  const counts = new Map(main.statuses.map((s) => [s._id, s.count]));
  const known = new Set(STATUS_GROUPS.flatMap((g) => g[2]));
  const statuses = STATUS_GROUPS.map(([key, label, list]) => ({ key, label, count: list.reduce((s, st) => s + (counts.get(st) || 0), 0) }));
  const other = [...counts].filter(([st]) => !known.has(st)).reduce((s, [, n]) => s + n, 0);
  if (other) statuses.push({ key: "other", label: "Otros estados", count: other });

  const sold = main.products.filter((p) => p._id);
  const topRows = [...sold].sort((a, b) => b.units - a.units || b.sales - a.sales || String(a.name).localeCompare(String(b.name), "es")).slice(0, 5);
  const [current5, withoutSalesAgg] = await Promise.all([
    Product.find({ _id: { $in: topRows.map((r) => r._id) } }).select("name mainImage").lean(),
    Product.aggregate([{ $match: { isActive: true, _id: { $nin: sold.map((p) => p._id) } } }, ...inventoryStages(),
      { $facet: { count: [{ $count: "n" }], items: [{ $sort: { "_inventory.validStock": -1, name: 1, _id: 1 } }, { $limit: 5 },
        { $project: { name: 1, mainImage: 1, "_inventory.validStock": 1, "_inventory.stockStatus": 1 } }] } }]),
  ]);
  const catalog = new Map(current5.map((p) => [String(p._id), p]));
  const top = topRows.map((r) => { const p = catalog.get(String(r._id));
    return { id: String(r._id), name: p?.name || r.name || "Producto sin nombre registrado", image: p?.mainImage || r.image || null,
      units: r.units, sales: round(r.sales), exists: !!p }; });
  const [ws] = withoutSalesAgg;

  return {
    timeZone: TZ, generatedAt: now.toISOString(),
    period: { key: period.key, label: period.label, from: period.from, to: period.to, start: period.start.toISOString(), end: period.end.toISOString(),
      granularity: period.granularity, basis: period.basis },
    sales: { ...current, comparison },
    series,
    distribution: { total: current.ordersRegistered, statuses, review: main.review[0]?.n || 0 },
    products: { top, withoutSales: { count: ws.count[0]?.n || 0, items: ws.items.map((p) => ({ id: String(p._id), name: p.name, image: p.mainImage || null,
      availableStock: p._inventory.validStock, stockStatus: p._inventory.stockStatus })) } },
    inventory,
    history: { firstOrderAt: firstOrderAt ? firstOrderAt.toISOString() : null },
  };
};
