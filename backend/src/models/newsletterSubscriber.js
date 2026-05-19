const mongoose = require("mongoose");
const validator = require("validator");

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Correo inválido"],
    },
    name: { type: String, trim: true, default: "" },
    source: {
      type: String,
      enum: ["footer", "popup", "checkout", "admin", "other"],
      default: "footer",
    },
    isActive: { type: Boolean, default: true },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

newsletterSubscriberSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
