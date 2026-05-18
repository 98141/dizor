const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [50, "Máximo 50 caracteres"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    hexCode: {
      type: String,
      trim: true,
      match: [/^#([0-9A-Fa-f]{3}){1,2}$/, "Código hex inválido"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

colorSchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugifyText(this.name);
  }
});

module.exports = mongoose.model("Color", colorSchema);
