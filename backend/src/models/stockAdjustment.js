const mongoose = require("mongoose");
// Durable intent/fence, separate from the immutable ledger of REAL movements.
module.exports = mongoose.model("StockAdjustment", new mongoose.Schema({
  _id: String, productId: mongoose.Schema.Types.ObjectId, variantId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId, delta: Number, reason: String,
  state: { type: String, enum: ["pending", "applied", "rejected"], default: "pending" },
  revision: { type: Number, default: 0 }, rejection: String,
}, { timestamps: true, versionKey: false }));
