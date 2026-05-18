const SpecialRequest = require("../models/specialRequest");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  formatRequestAdmin,
  pushStatusHistory,
} = require("../services/specialRequestService");

const formatList = (doc) => ({
  id: doc._id,
  requestNumber: doc.requestNumber,
  type: doc.type,
  status: doc.status,
  contact: doc.contact,
  productName: doc.productName,
  estimatedQuantity: doc.estimatedQuantity,
  quotedAmount: doc.quotedAmount,
  createdAt: doc.createdAt,
});

exports.getStats = catchAsync(async (req, res) => {
  const [total, pending, inReview, quoted] = await Promise.all([
    SpecialRequest.countDocuments(),
    SpecialRequest.countDocuments({ status: "pendiente" }),
    SpecialRequest.countDocuments({ status: "en_revision" }),
    SpecialRequest.countDocuments({ status: "cotizado" }),
  ]);

  res.status(200).json({
    status: "success",
    stats: { total, pending, inReview, quoted },
  });
});

exports.getRequests = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  if (req.query.q?.trim()) {
    const q = req.query.q.trim();
    filter.$or = [
      { requestNumber: { $regex: q, $options: "i" } },
      { "contact.name": { $regex: q, $options: "i" } },
      { "contact.email": { $regex: q, $options: "i" } },
      { productName: { $regex: q, $options: "i" } },
    ];
  }

  const [requests, total] = await Promise.all([
    SpecialRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("assignedTo", "name email"),
    SpecialRequest.countDocuments(filter),
  ]);

  res.status(200).json({
    status: "success",
    results: requests.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    requests: requests.map(formatList),
  });
});

exports.getRequest = catchAsync(async (req, res, next) => {
  const doc = await SpecialRequest.findById(req.params.id).populate(
    "assignedTo",
    "name email role"
  );

  if (!doc) {
    return next(new AppError("Solicitud no encontrada", 404));
  }

  res.status(200).json({
    status: "success",
    request: formatRequestAdmin(doc),
  });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
  const { status, note } = req.body;
  const allowed = [
    "pendiente",
    "en_revision",
    "cotizado",
    "aprobado",
    "rechazado",
    "completado",
    "cancelado",
  ];

  if (!allowed.includes(status)) {
    return next(new AppError("Estado inválido", 400));
  }

  const doc = await SpecialRequest.findById(req.params.id);

  if (!doc) {
    return next(new AppError("Solicitud no encontrada", 404));
  }

  doc.status = status;
  pushStatusHistory(doc, status, note, req.user.id);
  await doc.save();

  res.status(200).json({
    status: "success",
    request: formatRequestAdmin(doc),
  });
});

exports.updateQuote = catchAsync(async (req, res, next) => {
  const { quotedAmount, adminNotes } = req.body;
  const doc = await SpecialRequest.findById(req.params.id);

  if (!doc) {
    return next(new AppError("Solicitud no encontrada", 404));
  }

  if (quotedAmount != null) {
    doc.quotedAmount = Number(quotedAmount);
    doc.quotedAt = new Date();
    if (doc.status === "pendiente" || doc.status === "en_revision") {
      doc.status = "cotizado";
      pushStatusHistory(
        doc,
        "cotizado",
        adminNotes || "Cotización enviada al cliente",
        req.user.id
      );
    }
  }

  if (adminNotes !== undefined) {
    doc.adminNotes = adminNotes.trim();
  }

  await doc.save();

  res.status(200).json({
    status: "success",
    request: formatRequestAdmin(doc),
  });
});

exports.updateAdminNotes = catchAsync(async (req, res, next) => {
  const doc = await SpecialRequest.findById(req.params.id);

  if (!doc) {
    return next(new AppError("Solicitud no encontrada", 404));
  }

  doc.adminNotes = req.body.adminNotes?.trim() || "";
  await doc.save();

  res.status(200).json({
    status: "success",
    request: formatRequestAdmin(doc),
  });
});
