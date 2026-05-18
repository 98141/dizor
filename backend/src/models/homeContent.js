const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    text: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const homeContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "default",
    },
    hero: {
      title: {
        type: String,
        trim: true,
        default: "Sombreros artesanales de Sandoná",
      },
      subtitle: {
        type: String,
        trim: true,
        default:
          "Palma de iraca tejida a mano en Nariño, Colombia. Tradición, elegancia y calidad en cada pieza.",
      },
      ctaLabel: { type: String, trim: true, default: "Ver catálogo" },
      ctaHref: { type: String, trim: true, default: "/catalogo" },
      imageUrl: { type: String, trim: true, default: "" },
    },
    features: {
      type: [featureSchema],
      default: [],
    },
    featuredSection: {
      title: { type: String, trim: true, default: "Destacados" },
      linkLabel: { type: String, trim: true, default: "Ver todos" },
      linkHref: { type: String, trim: true, default: "/catalogo?featured=true" },
    },
    announcement: {
      text: { type: String, trim: true, default: "" },
      linkHref: { type: String, trim: true, default: "" },
      isActive: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeContent", homeContentSchema);
