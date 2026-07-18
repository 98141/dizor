const mongoose = require("mongoose");

/**
 * Selección diaria de productos aleatorios para el home.
 * Una fila por día (dateKey = YYYY-MM-DD en America/Bogota).
 * Todos los visitantes ven la misma lista hasta que cambia el día.
 */
const dailyProductPickSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
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
