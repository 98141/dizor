const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user");
const SpecialRequest = require("../models/specialRequest");
const NewsletterSubscriber = require("../models/newsletterSubscriber");
const AuditLog = require("../models/AuditLog");
const catchAsync = require("../utils/catchAsync");

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const countProductStockHealth = async () => {
  const products = await Product.find({ isActive: true }).select(
    "variants.stock variants.isActive"
  );

  let outOfStock = 0;
  let lowStock = 0;

  products.forEach((product) => {
    const activeVariants = product.variants.filter((v) => v.isActive);
    const total = activeVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
    if (total === 0) outOfStock += 1;
    else if (total <= 5) lowStock += 1;
  });

  return {
    active: products.length,
    outOfStock,
    lowStock,
  };
};

const formatAuditPreview = (log) => ({
  id: log._id,
  action: log.action,
  module: log.module,
  userEmail: log.userEmail,
  role: log.role,
  summary: log.summary,
  success: log.success,
  createdAt: log.createdAt,
});

exports.getDashboard = catchAsync(async (req, res) => {
  const today = startOfToday();
  const monthStart = startOfMonth();

  const [
    ordersTotal,
    pendingPayment,
    toPrepare,
    shippedToday,
    ordersToday,
    revenueMonthAgg,
    specialTotal,
    specialPending,
    specialInReview,
    specialQuoted,
    activeProducts,
    stockHealth,
    clientsCount,
    staffCount,
    newsletterActive,
    auditToday,
    recentActivity,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({
      paymentStatus: "pendiente",
      orderStatus: { $nin: ["cancelado", "rechazado"] },
    }),
    Order.countDocuments({ orderStatus: "pagado" }),
    Order.countDocuments({
      orderStatus: "enviado",
      updatedAt: { $gte: today },
    }),
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.aggregate([
      {
        $match: {
          paymentStatus: "pagado",
          createdAt: { $gte: monthStart },
          orderStatus: { $nin: ["cancelado", "rechazado"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    SpecialRequest.countDocuments(),
    SpecialRequest.countDocuments({ status: "pendiente" }),
    SpecialRequest.countDocuments({ status: "en_revision" }),
    SpecialRequest.countDocuments({ status: "cotizado" }),
    Product.countDocuments({ isActive: true }),
    countProductStockHealth(),
    User.countDocuments({ role: "cliente", isActive: true }),
    User.countDocuments({
      role: { $in: ["superadmin", "admin", "vendedor"] },
      isActive: true,
    }),
    NewsletterSubscriber.countDocuments({ isActive: true }),
    AuditLog.countDocuments({ createdAt: { $gte: today } }),
    AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "action module userEmail role summary success createdAt"
      )
      .lean(),
  ]);

  const revenueMonth = revenueMonthAgg[0]?.total || 0;

  res.status(200).json({
    status: "success",
    dashboard: {
      orders: {
        total: ordersTotal,
        pendingPayment,
        toPrepare,
        shippedToday,
        ordersToday,
        revenueMonth,
      },
      specialRequests: {
        total: specialTotal,
        pending: specialPending,
        inReview: specialInReview,
        quoted: specialQuoted,
      },
      catalog: {
        activeProducts,
        outOfStock: stockHealth.outOfStock,
        lowStock: stockHealth.lowStock,
      },
      users: {
        clients: clientsCount,
        staff: staffCount,
      },
      marketing: {
        newsletterSubscribers: newsletterActive,
      },
      audit: {
        eventsToday: auditToday,
        recent: recentActivity.map(formatAuditPreview),
      },
    },
  });
});
