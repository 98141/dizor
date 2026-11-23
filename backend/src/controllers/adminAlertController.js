const catchAsync = require("../utils/catchAsync");

const Order = require("../models/order");
const SpecialRequest = require("../models/specialRequest");
const Coupon = require("../models/coupon");

const { alertGroups } = require("../services/inventoryCriteria");

exports.getAlerts = catchAsync(async (req, res) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [inventoryAlerts, newOrders, pendingPaymentOrders, specialRequests, expiringCoupons] =
    await Promise.all([
      alertGroups(),
      Order.find({
        createdAt: { $gte: yesterday },
        orderStatus: { $nin: ["cancelado", "rechazado", "entregado"] },
      })
        .select("orderNumber buyer total createdAt orderStatus paymentStatus paymentMethod")
        .sort({ createdAt: -1 })
        .lean(),
      Order.find(require("../services/orderWorkspace").trayFilter("review"))
        .select("orderNumber buyer total createdAt incidents requiresReview")
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

  const alerts = {
    paymentEvents: {
      count: await require("../models/paymentEvent").countDocuments({ processedAt: null }),
      items: await require("../models/paymentEvent").find({ processedAt: null }).sort({ createdAt: 1 }).limit(10)
        .select("transactionId status environment processingState associationError lastError createdAt").lean(),
    },
    oldPendingPayments: {
      count: await Order.countDocuments({ paymentMethod: "wompi", paymentStatus: "pendiente", createdAt: { $lte: yesterday }, orderStatus: { $nin: ["cancelado", "devuelto", "rechazado"] } }),
      items: await Order.find({ paymentMethod: "wompi", paymentStatus: "pendiente", createdAt: { $lte: yesterday }, orderStatus: { $nin: ["cancelado", "devuelto", "rechazado"] } })
        .sort({ createdAt: 1 }).limit(10).select("orderNumber total createdAt").lean(),
    },
    communications: await require("./notificationAdminController").communicationAlerts(),
    newOrders: {
      count: newOrders.length,
      items: newOrders.slice(0, 10),
    },
    pendingPayments: {
      count: pendingPaymentOrders.length,
      items: pendingPaymentOrders.slice(0, 10),
    },
    ...inventoryAlerts,
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
