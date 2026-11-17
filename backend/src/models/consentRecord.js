const mongoose = require("mongoose");

// Registro append-only de autorizaciones y revocaciones (H-03, H-04, H-05).
// Cada fila documenta un acto: qué finalidad, qué versión exacta del texto,
// cuándo (fecha del servidor), desde qué formulario y a qué titular/trámite
// se refiere. No se guardan IP, user-agent ni huellas: no se ha justificado
// su necesidad (ver informe de implementación).
//
// Nunca se actualizan ni se borran filas desde la aplicación: una revocación
// es una fila nueva con action "revoked".
const consentRecordSchema = new mongoose.Schema(
  {
    purpose: { type: String, required: true, trim: true },
    action: { type: String, enum: ["granted", "revoked"], required: true },
    textVersion: { type: String, default: null },
    textStatus: {
      type: String,
      enum: ["approved", "published", "draft", "missing", "not_applicable"],
      required: true,
    },
    subjectEmail: { type: String, lowercase: true, trim: true, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    source: { type: String, trim: true, required: true },
    referenceType: { type: String, trim: true, default: null },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // Fecha del servidor. timestamps:createdAt también la guarda; se deja
    // explícita para que no dependa de opciones del schema.
    recordedAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

consentRecordSchema.index({ subjectEmail: 1, purpose: 1, recordedAt: -1 });
consentRecordSchema.index({ referenceType: 1, referenceId: 1 });

// Defensa contra modificaciones accidentales: el registro es inmutable.
const blockMutation = function () {
  throw new Error("ConsentRecord es inmutable: registra una nueva fila");
};
consentRecordSchema.pre("updateOne", blockMutation);
consentRecordSchema.pre("updateMany", blockMutation);
consentRecordSchema.pre("findOneAndUpdate", blockMutation);
consentRecordSchema.pre("deleteOne", blockMutation);
consentRecordSchema.pre("deleteMany", blockMutation);
consentRecordSchema.pre("findOneAndDelete", blockMutation);

module.exports = mongoose.model("ConsentRecord", consentRecordSchema);
