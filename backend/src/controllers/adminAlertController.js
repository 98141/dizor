const catchAsync = require("../utils/catchAsync");
const Product = require("../models/product");
const Order = require("../models/order");
const SpecialRequest = require("../models/specialRequest");
const Coupon = require("../models/coupon");

const LOW_STOCK_THRESHOLD = 5;

exports.getAlerts = catchAsync(async (req, res) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [products, newOrders, pendingPaymentOrders, specialRequests, expiringCoupons] =
    await Promise.all([
      Product.find({ isActive: true })
        .select("name slug variants")
        .lean(),
      Order.find({
        createdAt: { $gte: yesterday },
        orderStatus: { $nin: ["cancelado", "rechazado", "entregado"] },
      })
        .select("orderNumber buyer total createdAt orderStatus paymentStatus paymentMethod")
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({
        paymentMethod: "nequi_manual",
        paymentStatus: "pendiente",
        orderStatus: { $nin: ["cancelado", "rechazado"] },
      })
        .select("orderNumber buyer total createdAt")
        .sort({ createdAt: 1 })
        .lean(),
      SpecialRequest.find({ status: "pendiente" })
        .select("requestNumber type contact createdAt")
        .sort({ createdAt: 1 })
        .lean(),
      Coupon.find({
        isActive: true,
        expiresAt: { $gte: now, $lte: in3Days },
      })
        .select("code expiresAt usedCount maxUses")
        .sort({ expiresAt: 1 })
        .lean(),
    ]);

  const lowStockProducts = [];
  const outOfStockProducts = [];

  for (const p of products) {
    const totalStock = (p.variants || []).reduce(
      (s, v) => s + (v.isActive !== false ? v.stock || 0 : 0),
      0
    );
    if (totalStock === 0) {
      outOfStockProducts.push({ id: p._id, name: p.name, slug: p.slug, totalStock: 0 });
    } else if (totalStock <= LOW_STOCK_THRESHOLD) {
      lowStockProducts.push({ id: p._id, name: p.name, slug: p.slug, totalStock });
    }
  }

  outOfStockProducts.sort((a, b) => a.name.localeCompare(b.name));
  lowStockProducts.sort((a, b) => a.totalStock - b.totalStock);

  const alerts = {
    newOrders: {
      count: newOrders.length,
      items: newOrders.slice(0, 10),
    },
    pendingPayments: {
      count: pendingPaymentOrders.length,
      items: pendingPaymentOrders.slice(0, 10),
    },
    lowStock: {
      count: lowStockProducts.length,
      threshold: LOW_STOCK_THRESHOLD,
      items: lowStockProducts.slice(0, 10),
    },
    outOfStock: {
      count: outOfStockProducts.length,
      items: outOfStockProducts.slice(0, 10),
    },
    specialRequests: {
      count: specialRequests.length,
      items: specialRequests.slice(0, 10),
    },
    expiringCoupons: {
      count: expiringCoupons.length,
      items: expiringCoupons.slice(0, 10),
    },
  };

  const totalCount = Object.values(alerts).reduce((s, a) => s + a.count, 0);

  res.json({
    status: "success",
    totalCount,
    alerts,
    generatedAt: now,
  });
});
