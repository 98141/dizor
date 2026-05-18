const MarketingSettings = require("../models/marketingSettings");
const NewsletterSubscriber = require("../models/newsletterSubscriber");
const AbandonedCart = require("../models/abandonedCart");
const AppError = require("../utils/AppError");
const { resolveCartItems } = require("./cartService");
const { sendAbandonedCartEmail } = require("./emailService");

const DEFAULT_SETTINGS = {
  popup: {
    enabled: false,
    title: "10% en tu primera compra",
    text: "Suscríbete y recibe novedades de colecciones artesanales.",
    ctaLabel: "Suscribirme",
    ctaHref: "",
    imageUrl: "",
    delaySeconds: 4,
    showNewsletterForm: true,
  },
  newsletter: {
    footerTitle: "Newsletter Dizor",
    footerText: "Recibe lanzamientos y ofertas de sombreros artesanales.",
    successMessage: "¡Gracias! Te hemos suscrito correctamente.",
  },
  abandonedCart: {
    enabled: true,
    delayHours: 24,
    maxReminders: 2,
    emailSubject: "Tu carrito te espera — Dizor",
  },
};

exports.getOrCreateSettings = async () => {
  let doc = await MarketingSettings.findOne({ key: "default" });
  if (!doc) {
    doc = await MarketingSettings.create({ key: "default", ...DEFAULT_SETTINGS });
  }
  return doc;
};

exports.getPublicConfig = async () => {
  const settings = await exports.getOrCreateSettings();
  return {
    popup: settings.popup,
    newsletter: settings.newsletter,
  };
};

exports.subscribeNewsletter = async ({ email, name, source }) => {
  const normalized = email.trim().toLowerCase();
  let sub = await NewsletterSubscriber.findOne({ email: normalized });

  if (sub) {
    if (!sub.isActive) {
      sub.isActive = true;
      sub.unsubscribedAt = null;
      sub.name = name?.trim() || sub.name;
      sub.source = source || sub.source;
      await sub.save();
    }
    return { subscriber: sub, alreadySubscribed: true };
  }

  sub = await NewsletterSubscriber.create({
    email: normalized,
    name: name?.trim() || "",
    source: source || "footer",
  });

  return { subscriber: sub, alreadySubscribed: false };
};

exports.trackAbandonedCart = async ({ email, name, items, userId }) => {
  if (!email?.trim() || !items?.length) {
    throw new AppError("Correo e ítems del carrito son obligatorios", 400);
  }

  const resolved = await resolveCartItems(items);
  const subtotal = resolved.reduce((s, i) => s + i.lineTotal, 0);
  const itemCount = resolved.reduce((s, i) => s + i.quantity, 0);

  const payload = {
    email: email.trim().toLowerCase(),
    name: name?.trim() || "",
    user: userId || null,
    items: resolved.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      productSlug: i.productSlug,
      productImage: i.productImage,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal,
    itemCount,
    recoveredAt: null,
    recoveryOrderNumber: "",
  };

  const cart = await AbandonedCart.findOneAndUpdate(
    { email: payload.email, recoveredAt: null },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return cart;
};

exports.markAbandonedCartRecovered = async (email, orderNumber) => {
  if (!email) return;
  await AbandonedCart.updateMany(
    { email: email.toLowerCase(), recoveredAt: null },
    {
      recoveredAt: new Date(),
      recoveryOrderNumber: orderNumber || "",
    }
  );
};

exports.sendDueAbandonedReminders = async () => {
  const settings = await exports.getOrCreateSettings();
  if (!settings.abandonedCart?.enabled) {
    return { sent: 0, skipped: 0 };
  }

  const delayMs = (settings.abandonedCart.delayHours || 24) * 60 * 60 * 1000;
  const maxReminders = settings.abandonedCart.maxReminders || 2;
  const cutoff = new Date(Date.now() - delayMs);

  const carts = await AbandonedCart.find({
    recoveredAt: null,
    itemCount: { $gt: 0 },
    remindersSent: { $lt: maxReminders },
    updatedAt: { $lte: cutoff },
    $or: [{ lastReminderAt: null }, { lastReminderAt: { $lte: cutoff } }],
  }).limit(50);

  let sent = 0;
  let skipped = 0;

  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

  for (const cart of carts) {
    try {
      await sendAbandonedCartEmail({
        to: cart.email,
        name: cart.name,
        items: cart.items,
        subtotal: cart.subtotal,
        cartUrl: `${clientUrl}/carrito`,
        subject: settings.abandonedCart.emailSubject,
      });
      cart.remindersSent += 1;
      cart.lastReminderAt = new Date();
      await cart.save();
      sent += 1;
    } catch {
      skipped += 1;
    }
  }

  return { sent, skipped };
};
