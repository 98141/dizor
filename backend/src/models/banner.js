const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título es obligatorio"],
      trim: true,
      maxlength: 120,
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    linkHref: {
      type: String,
      trim: true,
      default: "/catalogo",
    },
    ctaLabel: {
      type: String,
      trim: true,
      default: "Ver más",
    },
    placement: {
      type: String,
      enum: ["home_mid", "catalog_top"],
      default: "home_mid",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bannerSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model("Banner", bannerSchema);
