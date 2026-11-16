const mongoose = require("mongoose");

// Peticiones, quejas y reclamos de consumo (Ley 1480, art. 50 lit. g) y
// solicitudes de titulares de datos (Ley 1581, arts. 8, 14, 15).
// Comparten infraestructura pero se separan por `category` (H-22, H-11).

const CATEGORY_TYPES = Object.freeze({
  consumo: ["peticion", "queja", "reclamo"],
  datos_personales: ["consulta", "actualizacion", "rectificacion", "supresion", "revocatoria"],
});

const STATUSES = ["recibida", "en_tramite", "respondida", "cerrada"];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    // Nota visible para el solicitante en el seguimiento (opcional).
    publicNote: { type: String, trim: true, maxlength: 2000, default: "" },
    // Nota interna, nunca expuesta en endpoints públicos.
    internalNote: { type: String, trim: true, maxlength: 2000, default: "" },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customerRequestSchema = new mongoose.Schema(
  {
    radicado: { type: String, required: true, unique: true },
    category: { type: String, enum: Object.keys(CATEGORY_TYPES), required: true },
    type: { type: String, required: true },
    contact: {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
      phone: { type: String, trim: true, maxlength: 30, default: "" },
    },
    orderNumber: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: STATUSES, default: "recibida" },
    history: { type: [historySchema], default: [] },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    accessTokenHash: { type: String, required: true, select: false },
    // Fecha y hora de radicación: la del servidor, inmutable.
    receivedAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: true }
);

customerRequestSchema.index({ category: 1, status: 1, receivedAt: -1 });
customerRequestSchema.index({ "contact.email": 1 });

customerRequestSchema.path("type").validate(function (value) {
  return (CATEGORY_TYPES[this.category] || []).includes(value);
}, "Tipo de solicitud inválido para la categoría");

const CustomerRequest = mongoose.model("CustomerRequest", customerRequestSchema);

module.exports = CustomerRequest;
module.exports.CATEGORY_TYPES = CATEGORY_TYPES;
module.exports.STATUSES = STATUSES;
