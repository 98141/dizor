const mongoose = require("mongoose");

const abandonedItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    productName: String,
    productSlug: String,
    productImage: String,
    quantity: { type: Number, min: 1 },
    unitPrice: Number,
    lineTotal: Number,
  },
  { _id: false }
);

const abandonedCartSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, trim: true, default: "" },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    items: { type: [abandonedItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
    remindersSent: { type: Number, default: 0 },
    lastReminderAt: { type: Date, default: null },
    recoveredAt: { type: Date, default: null },
    recoveryOrderNumber: { type: String, default: "" },
  },
  { timestamps: true }
);

abandonedCartSchema.index({ email: 1 });
abandonedCartSchema.index({ recoveredAt: 1, updatedAt: -1 });

module.exports = mongoose.model("AbandonedCart", abandonedCartSchema);
