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
    newSection: {
      title: { type: String, trim: true, default: "Novedades" },
      linkLabel: { type: String, trim: true, default: "Ver novedades" },
      linkHref: { type: String, trim: true, default: "/catalogo?isNew=true" },
      isActive: { type: Boolean, default: true },
    },
    craftSection: {
      title: { type: String, trim: true, default: "Nuestros tejidos" },
      subtitle: {
        type: String,
        trim: true,
        default: "Cada tipo de tejido tiene su propio carácter, finura y tiempo de elaboración.",
      },
      linkLabel: { type: String, trim: true, default: "Explorar" },
    },
    historia: {
      title: {
        type: String,
        trim: true,
        default: "Tejidos de Sandoná, historia en cada puntada",
      },
      body: {
        type: String,
        trim: true,
        default:
          "Desde las manos de las artesanas de Sandoná, Nariño, nace cada sombrero Dizor. La palma de iraca se corta, se blanquea y se teje con una disciplina que se transmite de generación en generación. Cada puntada es un acto de memoria cultural, una forma de decir que lo hecho a mano tiene valor, permanencia y alma.",
      },
      imageUrl: { type: String, trim: true, default: "" },
      ctaLabel: { type: String, trim: true, default: "Sobre Dizor" },
      ctaHref: { type: String, trim: true, default: "/pagina/sobre-dizor" },
    },
    bestsellerSection: {
      title: { type: String, trim: true, default: "Más vendidos" },
      linkLabel: { type: String, trim: true, default: "Ver todos" },
      linkHref: { type: String, trim: true, default: "/catalogo?sort=popular" },
      // Mantener en false hasta tener suficiente historial de ventas
      isActive: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeContent", homeContentSchema);
