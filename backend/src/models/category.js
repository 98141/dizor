const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [80, "Máximo 80 caracteres"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Máximo 500 caracteres"],
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

categorySchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugifyText(this.name);
  }
});

module.exports = mongoose.model("Category", categorySchema);
