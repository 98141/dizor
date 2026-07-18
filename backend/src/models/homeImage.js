const mongoose = require("mongoose");

const HOME_IMAGE_SECTIONS = [
  "hero",
  "historia",
  "personalizacion",
  "pormayor",
  "inspiracion",
  "coleccion",
];

const homeImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "La URL de la imagen es obligatoria"],
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
      default: "",
    },
    altText: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "Máximo 200 caracteres"],
    },
    seccion: {
      type: String,
      required: true,
      enum: HOME_IMAGE_SECTIONS,
    },
    orden: {
      type: Number,
      default: 0,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    /** Título visible (colecciones / inspiración) */
    titulo: {
      type: String,
      trim: true,
      default: "",
      maxlength: [120, "Máximo 120 caracteres"],
    },
    /** Enlace al hacer clic (colecciones → catálogo, inspiración → Instagram, etc.) */
    linkHref: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

homeImageSchema.index({ seccion: 1, activo: 1, orden: 1 });

module.exports = mongoose.model("HomeImage", homeImageSchema);
module.exports.HOME_IMAGE_SECTIONS = HOME_IMAGE_SECTIONS;
