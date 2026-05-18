const SpecialRequest = require("../models/specialRequest");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  createRequest,
  formatRequestPublic,
} = require("../services/specialRequestService");
const { sendSpecialRequestEmail } = require("../services/emailService");

exports.createRequest = catchAsync(async (req, res, next) => {
  try {
    const doc = await createRequest({ body: req.body, user: req.user });
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

exports.trackRequest = catchAsync(async (req, res, next) => {
  const requestNumber = req.query.requestNumber?.trim().toUpperCase();
  const email = req.query.email?.trim().toLowerCase();

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
