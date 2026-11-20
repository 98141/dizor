const mongoose = require("mongoose");

// Durable inbox: preserve financial evidence even if fulfillment fails afterwards.
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  transactionId: { type: String, required: true },
  status: { type: String, required: true },
  amountInCents: Number, currency: String, reference: String, environment: String,
  checksum: String, providerTimestamp: Number,
  processedAt: { type: Date, default: null },
  notificationQueuedAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
}, { timestamps: true });
schema.index({ order: 1, createdAt: -1 });
module.exports = mongoose.model("PaymentEvent", schema);
