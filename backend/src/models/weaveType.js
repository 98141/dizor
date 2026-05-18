const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

const weaveTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [60, "Máximo 60 caracteres"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, "Máximo 300 caracteres"],
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

weaveTypeSchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugifyText(this.name);
  }
});

module.exports = mongoose.model("WeaveType", weaveTypeSchema);
