const ProductHistory = require("../models/productHistory");
const catchAsync = require("../utils/catchAsync");

const formatEntry = (doc) => ({
  id: doc._id,
  productId: doc.productId,
  productName: doc.productName,
  productSlug: doc.productSlug,
  variantId: doc.variantId,
  sku: doc.sku,
  sizeName: doc.sizeName,
  colorName: doc.colorName,
  eventType: doc.eventType,
  quantityChange: doc.quantityChange,
  stockBefore: doc.stockBefore,
  stockAfter: doc.stockAfter,
  referenceType: doc.referenceType,
  referenceId: doc.referenceId,
  referenceLabel: doc.referenceLabel,
  userEmail: doc.userEmail,
  role: doc.role,
  summary: doc.summary,
  details: doc.details,
  createdAt: doc.createdAt,
});

exports.getHistory = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.productId) filter.productId = req.query.productId;
  if (req.query.eventType) filter.eventType = req.query.eventType;
  if (req.query.referenceType) filter.referenceType = req.query.referenceType;

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }

  const term = req.query.term?.trim();
  if (term) {
    const regex = new RegExp(
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    filter.$or = [
      { productName: regex },
      { sku: regex },
      { summary: regex },
      { referenceLabel: regex },
      { userEmail: regex },
    ];
  }

  const [entries, total, eventTypes, productsAgg] = await Promise.all([
    ProductHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductHistory.countDocuments(filter),
    ProductHistory.distinct("eventType"),
    ProductHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$productId",
          productName: { $last: "$productName" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
  ]);

  res.status(200).json({
    status: "success",
    results: entries.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    filters: {
      eventTypes: eventTypes.sort(),
      products: productsAgg.map((p) => ({
        id: p._id,
        name: p.productName,
        count: p.count,
      })),
    },
    history: entries.map(formatEntry),
  });
});

exports.getStats = catchAsync(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, todayCount, salesToday, stockMovesToday, byType] =
    await Promise.all([
      ProductHistory.countDocuments(),
      ProductHistory.countDocuments({ createdAt: { $gte: today } }),
      ProductHistory.aggregate([
        {
          $match: {
            eventType: "sale",
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            units: { $sum: { $abs: "$quantityChange" } },
            count: { $sum: 1 },
          },
        },
      ]),
      ProductHistory.countDocuments({
        eventType: "stock_adjustment",
        createdAt: { $gte: today },
      }),
      ProductHistory.aggregate([
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

  const sales = salesToday[0] || { units: 0, count: 0 };

  res.status(200).json({
    status: "success",
    stats: {
      total,
      today: todayCount,
      salesToday: sales.count,
      unitsSoldToday: sales.units,
      stockAdjustmentsToday: stockMovesToday,
      byType: byType.map((row) => ({
        eventType: row._id,
        count: row.count,
      })),
    },
  });
});
