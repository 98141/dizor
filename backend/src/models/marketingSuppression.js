const mongoose = require("mongoose");

// Lista de supresión por correo y finalidad comercial (H-04, H-05).
// Una entrada aquí impide CUALQUIER envío comercial de esa finalidad,
// aunque el correo siga en otra colección (suscriptor, carrito guardado).
// Se consulta en el momento del envío, no solo al encolar.
const marketingSuppressionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    source: { type: String, trim: true, default: "unsubscribe_link" },
  },
  { timestamps: true }
);

marketingSuppressionSchema.index({ email: 1, purpose: 1 }, { unique: true });

module.exports = mongoose.model("MarketingSuppression", marketingSuppressionSchema);
