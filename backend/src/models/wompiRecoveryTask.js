const mongoose = require("mongoose");

// Lookup work, not evidence of payment. In particular a buyer-supplied ID must
// never be inserted into PaymentEvent or Order.wompi.transactionId as proof.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  environment: { type: String, enum: ["test", "prod"], required: true, immutable: true },
  kind: { type: String, enum: ["payment_event", "buyer_return"], required: true, immutable: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentEvent", immutable: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", immutable: true },
  transactionId: { type: String, required: true, immutable: true },
  status: { type: String, enum: ["queued", "running", "waiting", "complete", "review", "rejected"], default: "queued" },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lastAttemptAt: { type: Date, default: null },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: "" },
  lastCode: { type: String, default: "" },
  completedAt: { type: Date, default: null },
}, { timestamps: true });
// Identity uses MongoDB's built-in unique _id. This performance index is not a
// financial uniqueness prerequisite and is never created by production startup.
schema.index({ environment: 1, status: 1, nextAttemptAt: 1 });
module.exports = mongoose.model("WompiRecoveryTask", schema);
