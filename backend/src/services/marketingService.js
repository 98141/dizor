const validator = require("validator");
const MarketingSettings = require("../models/marketingSettings");
const NewsletterSubscriber = require("../models/newsletterSubscriber");
const AbandonedCart = require("../models/abandonedCart");
const AppError = require("../utils/AppError");
const { resolveCartItems } = require("./cartService");
const { sendAbandonedCartEmail } = require("./emailService");
const {
  formatMarketingSettings,
  formatPublicMarketingConfig,
  isCartReminderFeatureEnabled,
} = require("../utils/formatMarketingSettings");
const { PURPOSES } = require("../config/legalTexts");
const {
  normalizeEmail,
  isAffirmative,
  recordConsent,
  hasValidMarketingConsent,
  suppressMarketing,
  liftSuppression,
} = require("./consentService");
const {
  isUnsubscribeConfigured,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} = require("../utils/opaqueTokens");
const { isWithinCommercialWindow } = require("../utils/contactWindow");

exports.getOrCreateSettings = async () => {
  let doc = await MarketingSettings.findOne({ key: "default" });
  if (!doc) {
    doc = await MarketingSettings.create({
      key: "default",
      popup: {
        enabled: true,
        title: "Bienvenido a Dizor",
        text: "Suscríbete y entérate de nuevas colecciones artesanales.",
        delaySeconds: 4,
        showNewsletterForm: true,
      },
    });
  }
  return doc;
};

exports.getFormattedSettings = async () => {
  const doc = await exports.getOrCreateSettings();
  return formatMarketingSettings(doc);
};

exports.getPublicConfig = async () => {
  const doc = await exports.getOrCreateSettings();
  return formatPublicMarketingConfig(doc);
};

/**
 * Suscripción a la newsletter. Exige autorización comercial afirmativa
 * (`marketingConsent === true`) y deja evidencia versionada (H-03, H-04).
 */
exports.subscribeNewsletter = async ({ email, name, source, marketingConsent }) => {
  if (!email?.trim() || !validator.isEmail(email.trim())) {
    throw new AppError("Correo inválido", 400);
  }
  if (!isAffirmative(marketingConsent)) {
    throw new AppError(
      "Para suscribirte debes aceptar recibir correos comerciales",
      400
    );
  }

  const normalized = normalizeEmail(email);
  let sub = await NewsletterSubscriber.findOne({ email: normalized });
  let alreadySubscribed = false;

  if (sub) {
    alreadySubscribed = sub.isActive;
    if (!sub.isActive) {
      // Nueva acción afirmativa del titular tras una baja: se reactiva y
      // queda registrada (antes ocurría en silencio).
      sub.isActive = true;
      sub.unsubscribedAt = null;
    }
    sub.name = name?.trim() || sub.name;
    sub.source = source || sub.source;
  } else {
    sub = new NewsletterSubscriber({
      email: normalized,
      name: name?.trim() || "",
      source: source || "footer",
    });
  }

  const record = await recordConsent({
    purpose: PURPOSES.MARKETING_NEWSLETTER,
    subjectEmail: normalized,
    source: `newsletter_form:${sub.source}`,
    referenceType: "NewsletterSubscriber",
    referenceId: sub._id,
  });
  sub.lastConsentRecord = record._id;
  await sub.save();
  await liftSuppression(normalized, PURPOSES.MARKETING_NEWSLETTER);

  return { subscriber: sub, alreadySubscribed };
};

/**
 * Guarda un carrito para recordatorio por correo. Solo con autorización
 * comercial afirmativa del titular (H-05). Ya no se invoca desde la
 * sincronización del carrito de usuarios registrados.
 */
exports.trackAbandonedCart = async ({ email, name, items, userId, marketingConsent }) => {
  // Función desactivada: no se guarda carrito ni correo ni evidencia.
  if (!isCartReminderFeatureEnabled()) {
    throw new AppError("Los recordatorios de carrito no están disponibles", 503);
  }
  if (!email?.trim() || !items?.length) {
    throw new AppError("Correo e ítems del carrito son obligatorios", 400);
  }
  if (!validator.isEmail(email.trim())) {
    throw new AppError("Correo inválido", 400);
  }
  if (!isAffirmative(marketingConsent)) {
    throw new AppError(
      "Para guardar el recordatorio debes aceptar recibirlo por correo",
      400
    );
  }

  const resolved = await resolveCartItems(items);
  const subtotal = resolved.reduce((s, i) => s + i.lineTotal, 0);
  const itemCount = resolved.reduce((s, i) => s + i.quantity, 0);
  const normalized = normalizeEmail(email);

  const payload = {
    email: normalized,
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

  const record = await recordConsent({
    purpose: PURPOSES.MARKETING_CART_REMINDER,
    subjectEmail: normalized,
    userId,
    source: "cart_reminder_form",
    referenceType: "AbandonedCart",
    referenceId: cart._id,
  });
  cart.consentRecord = record._id;
  await cart.save();
  await liftSuppression(normalized, PURPOSES.MARKETING_CART_REMINDER);

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

/**
 * Envío de recordatorios. La autorización vigente y la supresión se
 * comprueban carrito por carrito JUSTO ANTES de enviar, de modo que una baja
 * posterior a guardar el carrito sí se respeta.
 */
exports.sendDueAbandonedReminders = async ({ now = new Date() } = {}) => {
  if (!isCartReminderFeatureEnabled()) {
    return { sent: 0, skipped: 0, reason: "feature_disabled" };
  }
  const settings = await exports.getOrCreateSettings();
  if (!settings.abandonedCart?.enabled) {
    return { sent: 0, skipped: 0, reason: "disabled" };
  }
  if (!isUnsubscribeConfigured()) {
    // Sin secreto no hay enlace de baja: no se envía publicidad sin baja.
    return { sent: 0, skipped: 0, reason: "unsubscribe_not_configured" };
  }
  if (!isWithinCommercialWindow(now)) {
    return { sent: 0, skipped: 0, reason: "outside_contact_window" };
  }

  const delayMs = (settings.abandonedCart.delayHours || 24) * 60 * 60 * 1000;
  const maxReminders = settings.abandonedCart.maxReminders || 2;
  const cutoff = new Date(now.getTime() - delayMs);

  const carts = await AbandonedCart.find({
    recoveredAt: null,
    itemCount: { $gt: 0 },
    remindersSent: { $lt: maxReminders },
    updatedAt: { $lte: cutoff },
    // Carritos sin evidencia de autorización (registros previos a esta
    // corrección) quedan excluidos sin borrarse.
    consentRecord: { $ne: null },
    $or: [{ lastReminderAt: null }, { lastReminderAt: { $lte: cutoff } }],
  }).limit(50);

  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  let sent = 0;
  let skipped = 0;

  for (const cart of carts) {
    const allowed = await hasValidMarketingConsent(
      cart.email,
      PURPOSES.MARKETING_CART_REMINDER
    );
    if (!allowed) {
      skipped += 1;
      continue;
    }
    const token = createUnsubscribeToken(PURPOSES.MARKETING_CART_REMINDER, cart._id);
    try {
      await sendAbandonedCartEmail({
        to: cart.email,
        name: cart.name,
        items: cart.items,
        subtotal: cart.subtotal,
        cartUrl: `${clientUrl}/carrito`,
        unsubscribeUrl: `${clientUrl}/baja?t=${encodeURIComponent(token)}`,
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

/** Enlace de baja para un suscriptor (para la herramienta de envío externa). */
exports.getNewsletterUnsubscribeToken = (subscriberId) =>
  createUnsubscribeToken(PURPOSES.MARKETING_NEWSLETTER, subscriberId);

/**
 * Baja pública por token. Idempotente: repetirla devuelve éxito sin crear
 * registros nuevos. No requiere iniciar sesión.
 */
exports.unsubscribeByToken = async (token) => {
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) throw new AppError("Enlace de baja inválido o vencido", 400);

  let email = null;
  if (parsed.purpose === PURPOSES.MARKETING_NEWSLETTER) {
    const sub = await NewsletterSubscriber.findById(parsed.docId);
    if (sub) {
      email = sub.email;
      if (sub.isActive) {
        sub.isActive = false;
        sub.unsubscribedAt = new Date();
        await sub.save();
      }
    }
  } else if (parsed.purpose === PURPOSES.MARKETING_CART_REMINDER) {
    const cart = await AbandonedCart.findById(parsed.docId);
    if (cart) email = cart.email;
  } else {
    throw new AppError("Enlace de baja inválido o vencido", 400);
  }

  if (!email) throw new AppError("Enlace de baja inválido o vencido", 400);

  await suppressMarketing({ email, purpose: parsed.purpose, source: "unsubscribe_link" });
  return { purpose: parsed.purpose };
};
