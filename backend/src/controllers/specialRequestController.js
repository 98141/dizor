const SpecialRequest = require("../models/specialRequest");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  createRequest,
  formatRequestPublic,
} = require("../services/specialRequestService");
const { sendSpecialRequestEmail } = require("../services/emailService");
const { requireAuthorization, recordConsent } = require("../services/consentService");
const { PURPOSES } = require("../config/legalTexts");

exports.createRequest = catchAsync(async (req, res, next) => {
  // Autorización de tratamiento validada en el servidor (H-03).
  requireAuthorization(req.body?.privacyAuthorization, PURPOSES.SPECIAL_REQUEST);

  try {
    const doc = await createRequest({ body: req.body, user: req.user });
    await recordConsent({
      purpose: PURPOSES.SPECIAL_REQUEST,
      subjectEmail: doc.contact.email,
      userId: req.user?.id || null,
      source: `special_request:${doc.type}`,
      referenceType: "SpecialRequest",
      referenceId: doc._id,
    });
    await sendSpecialRequestEmail(doc);

    res.status(201).json({
      status: "success",
      request: formatRequestPublic(doc),
    });
  } catch (err) {
    if (err.statusCode) {
      return next(new AppError(err.message, err.statusCode));
    }
    throw err;
  }
});

// Seguimiento por número + correo en el CUERPO (H-06).
exports.trackRequest = catchAsync(async (req, res, next) => {
  const requestNumber =
    typeof req.body?.requestNumber === "string" ? req.body.requestNumber.trim().toUpperCase() : "";
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!requestNumber || !email) {
    return next(
      new AppError("Número de solicitud y correo son obligatorios", 400)
    );
  }

  const doc = await SpecialRequest.findOne({
    requestNumber,
    "contact.email": email,
  });

  if (!doc) {
    return next(new AppError("Solicitud no encontrada", 404));
  }

  res.status(200).json({
    status: "success",
    request: formatRequestPublic(doc),
  });
});

// Ruta antigua con el correo en la URL: no se procesa (H-06).
exports.trackRequestLegacy = (req, res) => {
  res.status(410).json({
    status: "fail",
    message: "Esta forma de consulta ya no está disponible. Usa el formulario de seguimiento.",
  });
};

exports.getMyRequests = catchAsync(async (req, res) => {
  const filter = {
    $or: [{ user: req.user.id }, { "contact.email": req.user.email }],
  };

  const requests = await SpecialRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    status: "success",
    results: requests.length,
    requests: requests.map(formatRequestPublic),
  });
});
