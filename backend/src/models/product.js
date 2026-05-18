const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Size",
      required: true,
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    stock: {
      type: Number,
      required: true,
      min: [0, "El stock no puede ser negativo"],
      default: 0,
    },
    price: {
      type: Number,
      min: [0, "El precio no puede ser negativo"],
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
      maxlength: [150, "Máximo 150 caracteres"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, "Máximo 300 caracteres"],
    },
    fullDescription: {
      type: String,
      trim: true,
      maxlength: [5000, "Máximo 5000 caracteres"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "La categoría es obligatoria"],
    },
    weaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WeaveType",
      required: [true, "El tipo de tejido es obligatorio"],
    },
    style: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Style",
      required: [true, "El estilo/horma es obligatorio"],
    },
    material: {
      type: String,
      trim: true,
      maxlength: [120, "Máximo 120 caracteres"],
      default: "Palma de iraca",
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Debe tener al menos una variante",
      },
    },
    salePrice: {
      type: Number,
      required: [true, "El precio de venta es obligatorio"],
      min: [0, "El precio no puede ser negativo"],
    },
    internalCost: {
      type: Number,
      min: [0, "El costo no puede ser negativo"],
      select: false,
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    promotionEndsAt: {
      type: Date,
      default: null,
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, default: null },
          alt: { type: String, default: "" },
        },
      ],
      validate: {
        validator: (v) => v.length >= 1 && v.length <= 10,
        message: "Entre 1 y 10 imágenes",
      },
    },
    mainImage: {
      type: String,
      required: [true, "La imagen principal es obligatoria"],
    },
    seoTitle: {
      type: String,
      trim: true,
      maxlength: [70, "Máximo 70 caracteres"],
    },
    seoDescription: {
      type: String,
      trim: true,
      maxlength: [160, "Máximo 160 caracteres"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    onPromotion: {
      type: Boolean,
      default: false,
    },
    allowsCustomization: {
      type: Boolean,
      default: false,
    },
    customizationOptions: {
      type: [String],
      default: [],
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    cartAddsCount: {
      type: Number,
      default: 0,
    },
    salesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

productSchema.index({ slug: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ category: 1, weaveType: 1, style: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ name: "text", shortDescription: "text" });

productSchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugifyText(this.name);
  }

  if (!this.seoTitle) {
    this.seoTitle = this.name;
  }

  if (!this.mainImage && this.images?.length) {
    this.mainImage = this.images[0].url;
  }
});

productSchema.methods.getEffectivePrice = function () {
  const now = new Date();
  const promoActive =
    this.onPromotion &&
    this.discountPercent > 0 &&
    (!this.promotionEndsAt || this.promotionEndsAt > now);

  if (promoActive) {
    return Math.round(this.salePrice * (1 - this.discountPercent / 100));
  }

  return this.salePrice;
};

productSchema.methods.getTotalStock = function () {
  return this.variants
    .filter((v) => v.isActive)
    .reduce((sum, v) => sum + v.stock, 0);
};

productSchema.methods.isInStock = function () {
  return this.getTotalStock() > 0;
};

module.exports = mongoose.model("Product", productSchema);
