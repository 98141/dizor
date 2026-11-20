const mongoose = require("mongoose");

const HOME_IMAGE_SECTIONS = [
  "hero",
  "historia",
  "personalizacion",
  "pormayor",
  "inspiracion",
  "coleccion",
  /** Pausas visuales Home (solo fotografía, sin copy) */
  "editorial1",
  "editorial2",
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
    /**
     * Asociación explícita tejido ↔ imagen (sección coleccion).
     * Preferida frente a matching por título/linkHref.
     * Varias imágenes pueden compartir el mismo weaveType (orden define la secuencia).
     */
    weaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WeaveType",
      default: null,
    },
    /**
     * Punto de enfoque opcional (porcentaje 0–100) para recortar la foto en
     * marcos de proporción fija (galería Inspiración). Sin valor = centrado.
     */
    focalX: {
      type: Number,
      min: [0, "El enfoque horizontal debe estar entre 0 y 100"],
      max: [100, "El enfoque horizontal debe estar entre 0 y 100"],
    },
    focalY: {
      type: Number,
      min: [0, "El enfoque vertical debe estar entre 0 y 100"],
      max: [100, "El enfoque vertical debe estar entre 0 y 100"],
    },
  },
  { timestamps: true }
);

homeImageSchema.index({ seccion: 1, activo: 1, orden: 1 });
homeImageSchema.index({ seccion: 1, weaveType: 1, activo: 1, orden: 1 });

module.exports = mongoose.model("HomeImage", homeImageSchema);
module.exports.HOME_IMAGE_SECTIONS = HOME_IMAGE_SECTIONS;
