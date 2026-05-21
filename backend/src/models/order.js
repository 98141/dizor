const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productName: String,
    productSlug: String,
    productImage: String,
    sizeName: String,
    colorName: String,
    sku: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    unitCost: { type: Number, default: null, min: 0 },
    customizationNotes: { type: String, default: "" },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isGuest: { type: Boolean, default: false },
    source: { type: String, enum: ["web", "manual"], default: "web" },
    channelOrigin: { type: String, default: "" },
    shippingRequired: { type: Boolean, default: true },
    buyer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, default: "", trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
    },
    shippingAddress: {
      address: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
      department: { type: String, default: "", trim: true },
      postalCode: { type: String, trim: true, default: "" },
      country: { type: String, default: "Colombia" },
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["wompi", "nequi_manual", "contra_entrega", "efectivo", "nequi_presencial", "tarjeta", "transferencia"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pendiente", "pagado", "rechazado", "reembolsado"],
      default: "pendiente",
    },
    paymentProofUrl: { type: String, default: "" },
    paymentConfirmedAt: { type: Date, default: null },
    paymentConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    orderStatus: {
      type: String,
      enum: [
        "pendiente",
        "pago_pendiente",
        "pagado",
        "en_preparacion",
        "enviado",
        "entregado",
        "cancelado",
        "rechazado",
        "devuelto",
      ],
      default: "pendiente",
    },
    carrier: {
      type: String,
      enum: ["interrapidisimo", "envia", "coordinadora", ""],
      default: "",
    },
    trackingNumber: { type: String, default: "" },
    shippingNotes: { type: String, default: "" },
    customerNotes: { type: String, default: "" },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusHistory: [statusHistorySchema],
    wompi: {
      paymentLinkId: { type: String, default: "" },
      paymentLinkUrl: { type: String, default: "" },
      transactionId: { type: String, default: "" },
      reference: { type: String, default: "" },
      status: { type: String, default: "" },
    },
    stockDeducted: { type: Boolean, default: true },
    idempotencyKey: { type: String, default: null },
    couponCode: { type: String, default: "" },
    couponConsumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ orderNumber: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "buyer.email": 1 });
orderSchema.index({ idempotencyKey: 1 }, { sparse: true, unique: true });

module.exports = mongoose.model("Order", orderSchema);
