const mongoose = require("mongoose");

const posItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    sizeName: { type: String, default: "" },
    colorName: { type: String, default: "" },
    sku: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: true }
);

const posOrderSchema = new mongoose.Schema(
  {
    posOrderNumber: { type: String, unique: true, required: true },
    customerName: { type: String, default: "Cliente mostrador", trim: true },
    items: [posItemSchema],
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["efectivo", "tarjeta", "nequi", "transferencia"],
      required: true,
    },
    cashReceived: { type: Number, default: 0 },
    changeGiven: { type: Number, default: 0 },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
    isVoided: { type: Boolean, default: false },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: "" },
  },
  { timestamps: true }
);

posOrderSchema.index({ soldBy: 1, createdAt: -1 });
posOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PosOrder", posOrderSchema);
