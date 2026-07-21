const mongoose = require("mongoose");

const marketingSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "default",
    },
    popup: {
      enabled: { type: Boolean, default: false },
      title: { type: String, trim: true, default: "10% en tu primera compra" },
      text: {
        type: String,
        trim: true,
        default: "Suscríbete y recibe novedades de colecciones artesanales.",
      },
      ctaLabel: { type: String, trim: true, default: "Suscribirme" },
      ctaHref: { type: String, trim: true, default: "" },
      imageUrl: { type: String, trim: true, default: "" },
      delaySeconds: { type: Number, default: 4, min: 0, max: 60 },
      showNewsletterForm: { type: Boolean, default: true },
      variant: {
        type: String,
        enum: ["newsletter", "coupon", "info"],
        default: "newsletter",
      },
      couponCode: { type: String, trim: true, uppercase: true, default: "" },
    },
    newsletter: {
      footerTitle: { type: String, trim: true, default: "Newsletter Dizor" },
      footerText: {
        type: String,
        trim: true,
        default: "Recibe lanzamientos y ofertas de sombreros artesanales.",
      },
      successMessage: {
        type: String,
        trim: true,
        default: "¡Gracias! Te hemos suscrito correctamente.",
      },
    },
    abandonedCart: {
      enabled: { type: Boolean, default: true },
      delayHours: { type: Number, default: 24, min: 1, max: 168 },
      maxReminders: { type: Number, default: 2, min: 1, max: 5 },
      emailSubject: {
        type: String,
        trim: true,
        default: "Tu carrito te espera — Dizor",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MarketingSettings", marketingSettingsSchema);
