const ConsentRecord = require("../models/consentRecord");
const MarketingSuppression = require("../models/marketingSuppression");
const AppError = require("../utils/AppError");
const { getText, isMarketingPurpose } = require("../config/legalTexts");

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

// Solo `true` (booleano) cuenta como acción afirmativa. "true", 1, "on" o la
// ausencia del campo NO se interpretan como autorización.
const isAffirmative = (value) => value === true;

// Las evidencias registradas con un texto en borrador no son autorizaciones
// válidas para envíos comerciales. Solo en entornos de prueba explícitos se
// permite tratarlas como válidas, para poder ejercitar el flujo completo.
const draftAcceptedForTesting = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.CONSENT_ACCEPT_DRAFT_FOR_TESTS === "true";

/**
 * ¿La evidencia registrada con este estado de texto sirve como autorización?
 * - "approved" y "published" (texto definitivo mostrado sin marcas): sí.
 * - "draft" (fase 1, mostrado como "Texto en revisión"): no; no se
 *   regulariza retroactivamente. Solo en pruebas locales explícitas.
 */
const isUsableTextStatus = (status) =>
  status === "approved" ||
  status === "published" ||
  (status === "draft" && draftAcceptedForTesting());

/**
 * Exige la autorización de una finalidad obligatoria para el trámite.
 * Lanza 400 si el cliente no envió `true`.
 */
const requireAuthorization = (value, purpose) => {
  const text = getText(purpose);
  if (!text || !text.required) return;
  if (!isAffirmative(value)) {
    // Mensaje pensado también para quien tiene abierta una versión anterior
    // del sitio (sin la casilla): al recargar obtiene el formulario nuevo.
    throw new AppError(
      "Debes aceptar el tratamiento de datos para continuar. Si no ves la casilla de autorización, recarga la página.",
      400
    );
  }
};

/**
 * Registra un acto de autorización o revocación. La versión y el estado del
 * texto los fija el servidor; cualquier versión/fecha enviada por el cliente
 * se ignora.
 */
const recordConsent = async ({
  purpose,
  action = "granted",
  subjectEmail = null,
  userId = null,
  source,
  referenceType = null,
  referenceId = null,
}) => {
  const text = getText(purpose);
  if (!text) throw new Error(`Finalidad desconocida: ${purpose}`);
  if (!source) throw new Error("source es obligatorio");

  return ConsentRecord.create({
    purpose,
    action,
    textVersion: text.version,
    textStatus: text.status,
    subjectEmail: subjectEmail ? normalizeEmail(subjectEmail) : null,
    user: userId || null,
    source,
    referenceType,
    referenceId,
    recordedAt: new Date(),
  });
};

const isSuppressed = async (email, purpose) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return true;
  const hit = await MarketingSuppression.exists({ email: normalized, purpose });
  return Boolean(hit);
};

/**
 * ¿Hay autorización comercial vigente para este correo y finalidad?
 * Se evalúa en el momento del envío: última fila del registro + supresión.
 */
const hasValidMarketingConsent = async (email, purpose) => {
  if (!isMarketingPurpose(purpose)) return false;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (await isSuppressed(normalized, purpose)) return false;

  const latest = await ConsentRecord.findOne({
    subjectEmail: normalized,
    purpose,
  })
    .sort({ recordedAt: -1, _id: -1 })
    .lean();

  if (!latest || latest.action !== "granted") return false;
  return isUsableTextStatus(latest.textStatus);
};

/**
 * Baja idempotente: añade a la lista de supresión y registra la revocación
 * (solo la primera vez, para no inflar el registro con clics repetidos).
 */
const suppressMarketing = async ({ email, purpose, source, userId = null }) => {
  const normalized = normalizeEmail(email);
  if (!normalized || !isMarketingPurpose(purpose)) return { changed: false };

  const res = await MarketingSuppression.updateOne(
    { email: normalized, purpose },
    { $setOnInsert: { email: normalized, purpose, source } },
    { upsert: true }
  );

  const changed = Boolean(res.upsertedCount);
  if (changed) {
    await recordConsent({
      purpose,
      action: "revoked",
      subjectEmail: normalized,
      userId,
      source,
    });
  }
  return { changed };
};

/** Nueva autorización afirmativa: levanta la supresión previa, si la había. */
const liftSuppression = async (email, purpose) => {
  await MarketingSuppression.deleteOne({ email: normalizeEmail(email), purpose });
};

module.exports = {
  normalizeEmail,
  isAffirmative,
  isUsableTextStatus,
  requireAuthorization,
  recordConsent,
  isSuppressed,
  hasValidMarketingConsent,
  suppressMarketing,
  liftSuppression,
};
