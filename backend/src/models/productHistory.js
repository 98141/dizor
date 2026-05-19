const mongoose = require("mongoose");

const productHistorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    productSlug: {
      type: String,
      trim: true,
      default: null,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    sku: {
      type: String,
      trim: true,
      default: null,
    },
    sizeName: {
      type: String,
      trim: true,
      default: null,
    },
    colorName: {
      type: String,
      trim: true,
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "created",
        "updated",
        "stock_adjustment",
        "sale",
        "deleted",
        "price_change",
        "status_change",
      ],
    },
    quantityChange: {
      type: Number,
      default: 0,
    },
    stockBefore: {
      type: Number,
      default: null,
    },
    stockAfter: {
      type: Number,
      default: null,
    },
    referenceType: {
      type: String,
      enum: ["order", "admin", "system", null],
      default: null,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceLabel: {
      type: String,
      trim: true,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userEmail: {
      type: String,
      trim: true,
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

productHistorySchema.index({ createdAt: -1 });
productHistorySchema.index({ productId: 1, createdAt: -1 });
productHistorySchema.index({ eventType: 1, createdAt: -1 });
productHistorySchema.index({ referenceLabel: 1 });

module.exports = mongoose.model("ProductHistory", productHistorySchema);
