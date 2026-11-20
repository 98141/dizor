const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  eventKey: { type: String, required: true, unique: true },
  manualKey: { type: String, default: undefined },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  event: { type: String, required: true },
  audience: { type: String, enum: ["buyer", "admin"], required: true },
  recipient: { type: String, default: "", select: false },
  channel: { type: String, enum: ["email"], default: "email" },
  status: { type: String, enum: ["pending", "processing", "sent", "failed", "skipped", "delivered"], default: "pending" },
  snapshot: { type: mongoose.Schema.Types.Mixed, select: false },
  message: { type: mongoose.Schema.Types.Mixed, select: false },
  attempts: { type: Number, default: 0 },
  firstAttemptAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  providerId: { type: String, default: "" },
  errorCode: { type: String, default: "" },
  retryable: { type: Boolean, default: true },
  ambiguous: { type: Boolean, default: false },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: "", select: false },
  history: [{ at: Date, outcome: String, attempt: Number, code: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null } }],
  resendOf: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", default: null },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", default: null },
  lastResendRequest: { type: String, default: "", select: false },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reason: { type: String, default: "", select: false },
}, { timestamps: true });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
schema.index({ order: 1, createdAt: -1 });
schema.index({ manualKey: 1 }, { unique: true, partialFilterExpression: { manualKey: { $type: "string" } } });
module.exports = mongoose.model("Notification", schema);
