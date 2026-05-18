const mongoose = require("mongoose");

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

const specialRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      required: true,
    },
    type: {
      type: String,
      enum: ["customization", "wholesale"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pendiente",
        "en_revision",
        "cotizado",
        "aprobado",
        "rechazado",
        "completado",
        "cancelado",
      ],
      default: "pendiente",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    contact: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      company: { type: String, trim: true, default: "" },
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productName: { type: String, trim: true, default: "" },
    productSlug: { type: String, trim: true, default: "" },
    variantSummary: { type: String, trim: true, default: "" },
    quantity: { type: Number, min: 1, default: 1 },
    customizationDetails: { type: String, trim: true, default: "" },
    selectedOptions: { type: [String], default: [] },
    productsDescription: { type: String, trim: true, default: "" },
    estimatedQuantity: { type: Number, min: 1, default: null },
    estimatedBudget: { type: Number, min: 0, default: null },
    deliveryDepartment: { type: String, trim: true, default: "" },
    desiredTimeline: { type: String, trim: true, default: "" },
    customerNotes: { type: String, trim: true, default: "" },
    adminNotes: { type: String, trim: true, default: "" },
    quotedAmount: { type: Number, min: 0, default: null },
    quotedCurrency: { type: String, default: "COP" },
    quotedAt: { type: Date, default: null },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

specialRequestSchema.index({ requestNumber: 1 });
specialRequestSchema.index({ type: 1, status: 1, createdAt: -1 });
specialRequestSchema.index({ "contact.email": 1 });
specialRequestSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("SpecialRequest", specialRequestSchema);
