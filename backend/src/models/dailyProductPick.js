const mongoose = require("mongoose");

/**
 * Curaduría diaria del home (America/Bogota, dateKey YYYY-MM-DD).
 * - productIds: hasta 5 piezas para «Descubre hoy»
 * - categoryIds: categorías usadas al armar esa selección
 * - weaveTypeIds: hasta 3 tejidos para «Colección / Nuestros tejidos»
 */
const dailyProductPickSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    weaveTypeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WeaveType",
      },
    ],
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailyProductPick", dailyProductPickSchema);
