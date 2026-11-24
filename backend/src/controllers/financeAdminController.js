const catchAsync = require("../utils/catchAsync");
const { buildFinanceReport } = require("../services/financeService");
const { reconciledSalesFilter } = require("../services/financeCriteria");
const {
  buildFinanceCsv,
  buildFinanceXlsx,
  buildFinancePdf,
} = require("../utils/financeExport");
const Product = require("../models/product");
const { financeProductListQuery, financeHistoryPage, emptyRollup, addLine, assess } = require("../services/financePresentation");
const Order = require("../models/order");
const AppError = require("../utils/AppError");

const round = (n) => Math.round(Number(n) || 0);

exports.getReport = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const summary = report.inventory.catalogSummary || [];
  report.inventory.catalogCount = summary.length;
  report.inventory.investmentTop = summary.slice(0, 10);
  report.inventory.catalogSummary = undefined;

  res.status(200).json({
    status: "success",
    ...report,
  });
});

/** @deprecated use getReport */
exports.getOverview = exports.getReport;

exports.exportCsv = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const csv = buildFinanceCsv(report);
  const filename = `dizor-finanzas-${Date.now()}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

exports.exportXlsx = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const buffer = await buildFinanceXlsx(report);
  const filename = `dizor-finanzas-${Date.now()}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
});

const productListMatch = (query) => {
  const match = {};
  if (query.regex) {
    const rx = new RegExp(query.regex, "i");
    match.$or = [{ name: rx }, { "variants.sku": rx }];
  }
  if (query.filter === "active") match.isActive = true;
  if (query.filter === "missing") match.internalCost = null;
  if (query.filter === "withCost") match.internalCost = { $ne: null };
  if (query.filter === "lowMargin") {
    match.internalCost = { $ne: null };
    match.salePrice = { $gt: 0 };
    match.$expr = { $lt: [{ $divide: [{ $subtract: ["$salePrice", "$internalCost"] }, "$salePrice"] }, 0.25] };
  }
  return match;
};

const financeProductRow = (p) => {
  const activeVariants = (p.variants || []).filter((v) => v.isActive !== false);
  const totalStock = activeVariants.reduce((s, v) => s + (v.stock || 0), 0);
  const cost = p.internalCost ?? null;
  const price = p.salePrice || 0;
  const margin = cost != null && price > 0 ? price - cost : null;
  const marginPct = margin != null && price > 0 ? Math.round((margin / price) * 1000) / 10 : null;
  return {
    id: p._id,
    name: p.name,
    slug: p.slug,
    isActive: p.isActive,
    totalStock,
    internalCost: cost,
    salePrice: price,
    margin,
    marginPct,
    stockValue: cost != null ? cost * totalStock : null,
    salesCount: p.salesCount || 0,
    variants: activeVariants.map((v) => ({
      id: v._id,
      sizeName: v.size?.name || "",
      colorName: v.color?.name || "",
      sku: v.sku,
      stock: v.stock || 0,
      price: v.price ?? null,
    })),
  };
};

const productSort = (query) => {
  const id = { _id: 1 };
  if (query.sort === "stock") return { unknownStock: 1, totalStock: query.dir, ...id };
  if (query.sort === "price") return { salePrice: query.dir, ...id };
  if (query.sort === "cost") return { costRank: 1, internalCost: query.dir, ...id };
  if (query.sort === "margin") return { marginRank: 1, marginSort: query.dir, ...id };
  return { name: query.dir, ...id };
};

exports.getFinanceProducts = catchAsync(async (req, res) => {
  const listQuery = financeProductListQuery(req.query);
  if (!listQuery.legacy) {
    const activeStock = {
      $sum: {
        $map: {
          input: { $filter: { input: "$variants", as: "v", cond: { $ne: ["$$v.isActive", false] } } },
          as: "v",
          in: { $ifNull: ["$$v.stock", 0] },
        },
      },
    };
    const [facet, summaryAgg] = await Promise.all([
      Product.aggregate([
        { $match: productListMatch(listQuery) },
        { $addFields: {
          totalStock: activeStock,
          costRank: { $cond: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, 1, 0] },
          marginSort: { $cond: [
            { $or: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, { $lte: ["$salePrice", 0] }] },
            null,
            { $divide: [{ $subtract: ["$salePrice", "$internalCost"] }, "$salePrice"] },
          ] },
          marginRank: { $cond: [
            { $or: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, { $lte: ["$salePrice", 0] }] },
            1, 0,
          ] },
          unknownStock: 0,
        } },
        { $sort: productSort(listQuery) },
        { $facet: {
          meta: [{ $count: "total" }],
          ids: [{ $skip: listQuery.skip }, { $limit: listQuery.limit }, { $project: { _id: 1 } }],
        } },
      ]),
      Product.aggregate([
        { $addFields: { stock: activeStock } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ["$isActive", 1, 0] } },
          missingCost: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, 1, 0] } },
          withMargin: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ["$internalCost", null] }, null] }, { $gt: ["$salePrice", 0] }] }, 1, 0] } },
          marginSum: { $sum: { $cond: [
            { $and: [{ $ne: [{ $ifNull: ["$internalCost", null] }, null] }, { $gt: ["$salePrice", 0] }] },
            { $divide: [{ $subtract: ["$salePrice", "$internalCost"] }, "$salePrice"] },
            0,
          ] } },
          totalStockValue: { $sum: { $cond: [
            { $eq: [{ $ifNull: ["$internalCost", null] }, null] },
            0,
            { $multiply: ["$internalCost", "$stock"] },
          ] } },
        } },
      ]),
    ]);
    const totalMatching = facet[0]?.meta[0]?.total || 0;
    const pages = Math.max(1, Math.ceil(totalMatching / listQuery.limit));
    const page = Math.min(listQuery.page, pages);
    const ids = page === listQuery.page
      ? (facet[0]?.ids || []).map((row) => row._id)
      : (await Product.aggregate([
        { $match: productListMatch(listQuery) },
        { $addFields: {
          totalStock: activeStock,
          costRank: { $cond: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, 1, 0] },
          marginSort: { $cond: [
            { $or: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, { $lte: ["$salePrice", 0] }] },
            null,
            { $divide: [{ $subtract: ["$salePrice", "$internalCost"] }, "$salePrice"] },
          ] },
          marginRank: { $cond: [
            { $or: [{ $eq: [{ $ifNull: ["$internalCost", null] }, null] }, { $lte: ["$salePrice", 0] }] },
            1, 0,
          ] },
        } },
        { $sort: productSort(listQuery) },
        { $skip: (page - 1) * listQuery.limit },
        { $limit: listQuery.limit },
        { $project: { _id: 1 } },
      ])).map((row) => row._id);
    const found = await Product.find({ _id: { $in: ids } })
      .select("+internalCost name slug salePrice isActive variants salesCount")
      .populate("variants.size", "name")
      .populate("variants.color", "name")
      .lean();
    const byId = new Map(found.map((product) => [String(product._id), product]));
    const products = ids.map((id) => byId.get(String(id))).filter(Boolean);
    const summary = summaryAgg[0] || { total: 0, active: 0, missingCost: 0, withMargin: 0, marginSum: 0, totalStockValue: 0 };
    return res.json({
      products: products.map(financeProductRow),
      summary: {
        total: summary.total,
        active: summary.active,
        missingCost: summary.missingCost,
        totalStockValue: Math.round(summary.totalStockValue || 0),
        avgMarginPct: summary.withMargin > 0 ? Math.round((summary.marginSum / summary.withMargin) * 1000) / 10 : null,
        withMargin: summary.withMargin,
      },
      total: totalMatching,
      page,
      pages,
      limit: listQuery.limit,
      filter: listQuery.filter,
      sort: listQuery.sort,
    });
  }

  const products = await Product.find()
    .select("+internalCost name slug salePrice isActive variants salesCount")
    .populate("variants.size", "name")
    .populate("variants.color", "name")
    .sort({ name: 1 })
    .lean();

  const rows = products.map(financeProductRow);

  const missingCost = rows.filter((r) => r.internalCost == null).length;
  const totalStockValue = rows.reduce((s, r) => s + (r.stockValue || 0), 0);
  const withMargin = rows.filter((r) => r.marginPct != null);
  const avgMarginPct =
    withMargin.length > 0
      ? Math.round(
          (withMargin.reduce((s, r) => s + r.marginPct, 0) / withMargin.length) * 10
        ) / 10
      : 0;

  res.json({
    products: rows,
    summary: {
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      missingCost,
      totalStockValue: Math.round(totalStockValue),
      avgMarginPct,
    },
  });
});

exports.updateProductCost = catchAsync(async (req, res, next) => {
  const { internalCost } = req.body;

  const existing = await Product.findById(req.params.id).select("name");
  if (!existing) return next(new AppError("Producto no encontrado", 404));

  let update;
  if (internalCost === null || internalCost === undefined || internalCost === "") {
    update = { $unset: { internalCost: "" } };
  } else {
    const val = Number(internalCost);
    if (Number.isNaN(val) || val < 0) {
      return next(new AppError("El costo debe ser un número mayor o igual a 0", 400));
    }
    update = { $set: { internalCost: val } };
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, select: "+internalCost name" }
  );

  res.json({
    product: {
      id: product._id,
      name: product.name,
      internalCost: product.internalCost ?? null,
    },
  });
});

exports.exportPdf = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const buffer = await buildFinancePdf(report);
  const filename = `dizor-finanzas-${Date.now()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

/* ─── Historial financiero ─────────────────────────────────── */

const { historyBounds, financePeriodKey: getPeriodKey } = require("../utils/financePeriod");

const getPeriodLabel = (key, groupBy) => {
  if (groupBy === "day") {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("es-CO", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  if (groupBy === "week") {
    const [yearStr, weekStr] = key.split("-W");
    return `Sem. ${weekStr} / ${yearStr}`;
  }
  if (groupBy === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CO", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
  }
  return key;
};

const getPeriodShortLabel = (key, groupBy) => {
  if (groupBy === "year") return key;
  if (groupBy === "week") return `S${key.split("-W")[1]}`;
  if (groupBy === "day") {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("es-CO", { timeZone: "UTC", day: "numeric", month: "short" });
  }
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CO", { timeZone: "UTC", month: "short", year: "2-digit" });
};

exports.getFinanceHistory = catchAsync(async (req, res) => {
  const paging = financeHistoryPage(req.query);
  const groupBy = ["day", "week", "month", "year"].includes(req.query.groupBy)
    ? req.query.groupBy
    : "month";

  const { start, end } = historyBounds(groupBy, req.query.from, req.query.to);

  const [products, orders] = await Promise.all([
    Product.find().select("+internalCost _id").lean(),
    Order.find(reconciledSalesFilter({ createdAt: { $gte: start, $lte: end } }))
      .select("items total subtotal createdAt")
      .lean(),
  ]);

  const costMap = new Map(
    products.map((p) => [String(p._id), p.internalCost ?? null])
  );

  const periodMap = new Map();

  const getOrCreate = (key) => {
    if (!periodMap.has(key)) {
      periodMap.set(key, {
        periodKey: key,
        label: getPeriodLabel(key, groupBy),
        shortLabel: getPeriodShortLabel(key, groupBy),
        ordersCount: 0,
        totalRevenue: 0,
        roll: emptyRollup(),
      });
    }
    return periodMap.get(key);
  };

  for (const order of orders) {
    const row = getOrCreate(getPeriodKey(order.createdAt, groupBy));
    row.ordersCount += 1;
    row.totalRevenue += order.total || 0;
    for (const item of order.items || []) {
      const productId = item.product && item.product._id ? String(item.product._id) : String(item.product || "");
      addLine(row.roll, item, costMap.has(productId) ? costMap.get(productId) : null);
    }
  }

  const rows = [...periodMap.values()]
    .map((row) => {
      const view = assess(row.roll);
      return {
        periodKey: row.periodKey,
        label: row.label,
        shortLabel: row.shortLabel,
        ordersCount: row.ordersCount,
        onlineRevenue: view.revenue,
        totalRevenue: round(row.totalRevenue),
        cogs: view.cogs,
        grossProfit: view.grossProfit,
        grossMarginPct: view.grossMarginPct,
        knownProfit: view.knownProfit,
        knownMarginPct: view.knownMarginPct,
        marginReliable: view.marginReliable,
        costCoveragePct: view.costCoveragePct,
        profitabilityStatus: view.status,
        unitsSold: view.units,
        itemsMissingCost: view.missingUnits,
      };
    })
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const productRevenue = rows.reduce((s, r) => s + r.onlineRevenue, 0);
  const totalProfit = rows.reduce((s, r) => s + r.grossProfit, 0);
  const knownProfit = rows.reduce((s, r) => s + r.knownProfit, 0);
  const totalOrders = rows.reduce((s, r) => s + r.ordersCount, 0);
  const marginReliable = rows.every((r) => r.marginReliable);
  const pages = paging.paged ? Math.max(1, Math.ceil(rows.length / paging.limit)) : 1;
  const page = paging.paged ? Math.min(paging.page, pages) : 1;
  const visible = paging.paged ? rows.slice((page - 1) * paging.limit, page * paging.limit) : rows;

  res.json({
    groupBy,
    from: start,
    to: end,
    rows: visible,
    page,
    pages,
    limit: paging.paged ? paging.limit : rows.length,
    total: rows.length,
    summary: {
      totalRevenue: round(totalRevenue),
      totalProfit: round(totalProfit),
      knownProfit: round(knownProfit),
      marginReliable,
      profitabilityStatus: productRevenue === 0 ? "empty" : marginReliable ? "complete" : knownProfit === 0 && !marginReliable ? "pending" : "partial",
      grossMarginPct:
        productRevenue > 0
          ? Math.round((totalProfit / productRevenue) * 1000) / 10
          : 0,
      totalOrders,
      periodsWithSales: rows.filter((r) => r.totalRevenue > 0).length,
    },
  });
});
