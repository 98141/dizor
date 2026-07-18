const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    authorName: {
      type: String,
      required: [true, "El nombre del autor es obligatorio"],
      trim: true,
      maxlength: [80, "Máximo 80 caracteres"],
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: [80, "Máximo 80 caracteres"],
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: [true, "El comentario es obligatorio"],
      trim: true,
      maxlength: [1000, "Máximo 1000 caracteres"],
    },
    aprobado: {
      type: Boolean,
      default: false,
    },
    isBrandReview: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ aprobado: 1, createdAt: -1 });
reviewSchema.index({ product: 1, aprobado: 1 });
reviewSchema.index(
  { user: 1, product: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: "objectId" },
      product: { $type: "objectId" },
      isBrandReview: false,
    },
  }
);

module.exports = mongoose.model("Review", reviewSchema);
