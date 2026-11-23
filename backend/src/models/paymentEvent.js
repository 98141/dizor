const mongoose = require("mongoose");

// Durable inbox: preserve financial evidence even if fulfillment fails afterwards.
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  transactionId: { type: String, required: true },
  status: { type: String, required: true },
  amountInCents: Number, currency: String, reference: String, environment: String,
  paymentLinkId: { type: String, default: "" },
  processingState: { type: String, enum: ["unassociated", "associated", "processed", "failed"], default: "unassociated" },
  associationError: { type: String, default: "" },
  source: { type: String, enum: ["webhook", "provider_query"], default: "webhook" },
  providerObservation: { status: String, paymentLinkId: String, amountInCents: Number, currency: String, checkedAt: Date },
  checksum: String, providerTimestamp: Number,
  processedAt: { type: Date, default: null },
  notificationQueuedAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
}, { timestamps: true });
schema.index({ order: 1, createdAt: -1 });
module.exports = mongoose.model("PaymentEvent", schema);
