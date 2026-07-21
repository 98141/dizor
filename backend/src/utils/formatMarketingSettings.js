const DEFAULTS = {
  popup: {
    enabled: false,
    title: "10% en tu primera compra",
    text: "Suscríbete y recibe novedades de colecciones artesanales.",
    ctaLabel: "Suscribirme",
    ctaHref: "",
    imageUrl: "",
    delaySeconds: 4,
    showNewsletterForm: true,
    variant: "newsletter",
    couponCode: "",
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

const pick = (source, defaults) => ({
  ...defaults,
  ...(source && typeof source === "object"
    ? typeof source.toObject === "function"
      ? source.toObject()
      : source
    : {}),
});

exports.formatMarketingSettings = (doc) => {
  if (!doc) return { ...DEFAULTS };

  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;

  return {
    key: raw.key || "default",
    popup: pick(raw.popup, DEFAULTS.popup),
    newsletter: pick(raw.newsletter, DEFAULTS.newsletter),
    abandonedCart: pick(raw.abandonedCart, DEFAULTS.abandonedCart),
  };
};

exports.formatPublicMarketingConfig = (doc) => {
  const settings = exports.formatMarketingSettings(doc);
  return {
    popup: settings.popup,
    newsletter: settings.newsletter,
  };
};
