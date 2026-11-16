const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const NewsletterSubscriber = require("../models/newsletterSubscriber");
const AbandonedCart = require("../models/abandonedCart");
const Order = require("../models/order");
const { toCsv } = require("../utils/csvExport");
const {
  getOrCreateSettings,
  getFormattedSettings,
  sendDueAbandonedReminders,
  getNewsletterUnsubscribeToken,
} = require("../services/marketingService");
const ConsentRecord = require("../models/consentRecord");
const MarketingSuppression = require("../models/marketingSuppression");
const { PURPOSES } = require("../config/legalTexts");
const { suppressMarketing } = require("../services/consentService");

// Una evidencia cuenta para exportar/enviar solo si el texto estaba aprobado
// (o, en pruebas locales explícitas, en borrador). Ver consentService.
const evidenceIsUsable = (record) =>
  Boolean(record) &&
  record.purpose === PURPOSES.MARKETING_NEWSLETTER &&
  record.action === "granted" &&
  (record.textStatus === "approved" ||
    (record.textStatus === "draft" &&
      process.env.NODE_ENV !== "production" &&
      process.env.CONSENT_ACCEPT_DRAFT_FOR_TESTS === "true"));

exports.getSettings = catchAsync(async (req, res) => {
  const settings = await getFormattedSettings();
  res.status(200).json({ status: "success", settings });
});

exports.updateSettings = catchAsync(async (req, res) => {
  const settings = await getOrCreateSettings();
  const { popup, newsletter, abandonedCart } = req.body;

  if (popup) {
    Object.assign(settings.popup, popup);
    settings.markModified("popup");
  }
  if (newsletter) {
    Object.assign(settings.newsletter, newsletter);
    settings.markModified("newsletter");
  }
  if (abandonedCart) {
    Object.assign(settings.abandonedCart, abandonedCart);
    settings.markModified("abandonedCart");
  }

  await settings.save();

  res.status(200).json({
    status: "success",
    message: "Configuración de marketing actualizada",
    settings: await getFormattedSettings(),
  });
});

exports.getSubscribers = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
  const skip = (page - 1) * limit;
  const filter = { isActive: true };

  if (req.query.q?.trim()) {
    filter.email = { $regex: req.query.q.trim(), $options: "i" };
  }

  const [subscribers, total] = await Promise.all([
    NewsletterSubscriber.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    NewsletterSubscriber.countDocuments(filter),
  ]);

  res.status(200).json({
    status: "success",
    results: subscribers.length,
    total,
    page,
    // hasConsentEvidence: false → suscriptor sin evidencia de autorización
    // (registros previos a la corrección H-04). Se conserva, pero no se
    // exporta para envíos comerciales.
    subscribers: subscribers.map((s) => ({
      ...s.toObject(),
      hasConsentEvidence: Boolean(s.lastConsentRecord),
    })),
  });
});

exports.getAbandonedCarts = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = { recoveredAt: null, itemCount: { $gt: 0 } };

  const [carts, total] = await Promise.all([
    AbandonedCart.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    AbandonedCart.countDocuments(filter),
  ]);

  res.status(200).json({
    status: "success",
    results: carts.length,
    total,
    page,
    carts,
  });
});

exports.sendAbandonedReminders = catchAsync(async (req, res) => {
  const result = await sendDueAbandonedReminders();
  res.status(200).json({
    status: "success",
    message: `Recordatorios enviados: ${result.sent}`,
    ...result,
  });
});

exports.exportNewsletterCsv = catchAsync(async (req, res) => {
  // Solo suscriptores activos, con evidencia de autorización utilizable y
  // sin baja registrada (H-04). Los demás se conservan pero no se exportan.
  const subscribers = await NewsletterSubscriber.find({
    isActive: true,
    lastConsentRecord: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(10000);

  const [records, suppressed] = await Promise.all([
    ConsentRecord.find({
      _id: { $in: subscribers.map((s) => s.lastConsentRecord) },
    }).lean(),
    MarketingSuppression.find({
      purpose: PURPOSES.MARKETING_NEWSLETTER,
      email: { $in: subscribers.map((s) => s.email) },
    }).lean(),
  ]);
  const recordById = new Map(records.map((r) => [String(r._id), r]));
  const suppressedEmails = new Set(suppressed.map((x) => x.email));
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  const exportable = subscribers.filter(
    (s) =>
      !suppressedEmails.has(s.email) &&
      evidenceIsUsable(recordById.get(String(s.lastConsentRecord)))
  );

  const csv = toCsv(
    ["email", "name", "source", "createdAt", "consentRecordedAt", "consentTextVersion", "unsubscribeUrl"],
    exportable.map((s) => {
      const rec = recordById.get(String(s.lastConsentRecord));
      const token = getNewsletterUnsubscribeToken(s._id);
      return [
        s.email,
        s.name,
        s.source,
        s.createdAt?.toISOString(),
        rec?.recordedAt?.toISOString(),
        rec?.textVersion,
        token ? `${clientUrl}/baja?t=${encodeURIComponent(token)}` : "",
      ];
    })
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="newsletter-dizor.csv"'
  );
  res.send(`\uFEFF${csv}`);
});

exports.exportOrdersCsv = catchAsync(async (req, res) => {
  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(5000)
    .select(
      "orderNumber buyer total paymentMethod paymentStatus orderStatus createdAt"
    );

  const csv = toCsv(
    [
      "orderNumber",
      "buyerName",
      "buyerEmail",
      "total",
      "paymentMethod",
      "paymentStatus",
      "orderStatus",
      "createdAt",
    ],
    orders.map((o) => [
      o.orderNumber,
      o.buyer?.name,
      o.buyer?.email,
      o.total,
      o.paymentMethod,
      o.paymentStatus,
      o.orderStatus,
      o.createdAt?.toISOString(),
    ])
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="pedidos-dizor.csv"');
  res.send(`\uFEFF${csv}`);
});

exports.exportAbandonedCartsCsv = catchAsync(async (req, res) => {
  const carts = await AbandonedCart.find({ recoveredAt: null })
    .sort({ updatedAt: -1 })
    .limit(5000);

  const csv = toCsv(
    ["email", "name", "itemCount", "subtotal", "remindersSent", "updatedAt"],
    carts.map((c) => [
      c.email,
      c.name,
      c.itemCount,
      c.subtotal,
      c.remindersSent,
      c.updatedAt?.toISOString(),
    ])
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="carritos-abandonados-dizor.csv"'
  );
  res.send(`\uFEFF${csv}`);
});

exports.unsubscribeSubscriber = catchAsync(async (req, res, next) => {
  const sub = await NewsletterSubscriber.findById(req.params.id);
  if (!sub) {
    return next(new AppError("Suscriptor no encontrado", 404));
  }
  sub.isActive = false;
  sub.unsubscribedAt = new Date();
  await sub.save();
  await suppressMarketing({
    email: sub.email,
    purpose: PURPOSES.MARKETING_NEWSLETTER,
    source: "admin_panel",
    userId: req.user?.id || null,
  });
  res.status(200).json({ status: "success", message: "Suscriptor dado de baja" });
});
