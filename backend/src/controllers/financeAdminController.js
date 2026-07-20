const catchAsync = require("../utils/catchAsync");
const { buildFinanceReport } = require("../services/financeService");
const {
  buildFinanceCsv,
  buildFinanceXlsx,
  buildFinancePdf,
} = require("../utils/financeExport");
const Product = require("../models/product");
const Order = require("../models/order");
const AppError = require("../utils/AppError");

const round = (n) => Math.round(Number(n) || 0);

exports.getReport = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);

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

exports.getFinanceProducts = catchAsync(async (req, res) => {
  const products = await Product.find()
    .select("+internalCost name slug salePrice isActive variants salesCount")
    .populate("variants.size", "name")
    .populate("variants.color", "name")
    .sort({ name: 1 })
    .lean();

  const rows = products.map((p) => {
    const activeVariants = (p.variants || []).filter((v) => v.isActive !== false);
    const totalStock = activeVariants.reduce((s, v) => s + (v.stock || 0), 0);
    const cost = p.internalCost ?? null;
    const price = p.salePrice || 0;
    const margin = cost != null && price > 0 ? price - cost : null;
    const marginPct = margin != null && price > 0 ? Math.round((margin / price) * 1000) / 10 : null;
    const stockValue = cost != null ? cost * totalStock : null;

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
      stockValue,
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
  });

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

const getIsoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
};

const getPeriodKey = (date, groupBy) => {
  const d = new Date(date);
  if (groupBy === "day") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (groupBy === "week") {
    const { week, year } = getIsoWeek(d);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (groupBy === "year") {
    return String(d.getFullYear());
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const getPeriodLabel = (key, groupBy) => {
  if (groupBy === "day") {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("es-CO", {
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
    return new Date(y, m - 1, 1).toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    });
  }
  return key;
};

exports.getFinanceHistory = catchAsync(async (req, res) => {
  const groupBy = ["day", "week", "month", "year"].includes(req.query.groupBy)
    ? req.query.groupBy
    : "month";

  const now = new Date();
  let start, end;

  if (req.query.from && req.query.to) {
    start = new Date(req.query.from);
    start.setHours(0, 0, 0, 0);
    end = new Date(req.query.to);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (groupBy === "day") {
      start = new Date(now);
      start.setDate(start.getDate() - 29);
    } else if (groupBy === "week") {
      start = new Date(now);
      start.setDate(start.getDate() - 83);
    } else if (groupBy === "year") {
      start = new Date(now.getFullYear() - 4, 0, 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }
    start.setHours(0, 0, 0, 0);
  }

  const [products, orders] = await Promise.all([
    Product.find().select("+internalCost _id").lean(),
    Order.find({ paymentStatus: "pagado", createdAt: { $gte: start, $lte: end } })
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
        ordersCount: 0,
        onlineRevenue: 0,
        totalRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        unitsSold: 0,
      });
    }
    return periodMap.get(key);
  };

  for (const order of orders) {
    const row = getOrCreate(getPeriodKey(order.createdAt, groupBy));
    row.ordersCount += 1;
    for (const item of order.items || []) {
      const qty = item.quantity || 0;
      const lineRev = item.lineTotal != null ? item.lineTotal : (item.unitPrice || 0) * qty;
      row.onlineRevenue += lineRev;
      row.unitsSold += qty;
      const unitCost = item.unitCost ?? costMap.get(String(item.product)) ?? null;
      if (unitCost != null) row.cogs += unitCost * qty;
    }
  }

  const rows = [...periodMap.values()]
    .map((row) => {
      row.onlineRevenue = round(row.onlineRevenue);
      row.totalRevenue = row.onlineRevenue;
      row.cogs = round(row.cogs);
      row.grossProfit = row.totalRevenue - row.cogs;
      row.grossMarginPct =
        row.totalRevenue > 0
          ? Math.round((row.grossProfit / row.totalRevenue) * 1000) / 10
          : 0;
      return row;
    })
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const totalProfit = rows.reduce((s, r) => s + r.grossProfit, 0);
  const totalOrders = rows.reduce((s, r) => s + r.ordersCount, 0);

  res.json({
    groupBy,
    from: start,
    to: end,
    rows,
    summary: {
      totalRevenue: round(totalRevenue),
      totalProfit: round(totalProfit),
      grossMarginPct:
        totalRevenue > 0
          ? Math.round((totalProfit / totalRevenue) * 1000) / 10
          : 0,
      totalOrders,
      periodsWithSales: rows.filter((r) => r.totalRevenue > 0).length,
    },
  });
});
