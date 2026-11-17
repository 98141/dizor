const mongoose = require("mongoose");

const storeSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "default",
    },
    taxEnabled: { type: Boolean, default: false },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    shippingMode: {
      type: String,
      enum: ["included", "fixed", "free_threshold", "by_department"],
      // "included": el envío está incluido en el precio de cada producto
      // (decisión del negocio 2026-11-16). Ver settingsService.isShippingIncluded.
      default: "included",
    },
    shippingFixedCost: { type: Number, default: 15000 },
    freeShippingMinAmount: { type: Number, default: 200000 },
    shippingByDepartment: {
      type: Map,
      of: Number,
      default: {},
    },
    currency: { type: String, default: "COP" },
    carriers: {
      type: [String],
      default: ["interrapidisimo", "servientrega"],
    },
    appearance: {
      siteName: { type: String, default: "" },
      primaryColor: { type: String, default: "" },
      accentColor: { type: String, default: "" },
      bgColor: { type: String, default: "" },
      faviconUrl: { type: String, default: "" },
      logoUrl: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StoreSettings", storeSettingsSchema);
