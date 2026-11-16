const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const { isValidObjectId } = require("../utils/objectIdUtils");
const { logAuditEvent, safeLog } = require("../services/auditService");
const service = require("../services/customerRequestService");
const { CATEGORY_TYPES } = require("../models/customerRequest");

exports.getConfig = (req, res) => {
  res.status(200).json({
    status: "success",
    enabled: service.isPublicChannelEnabled(),
    categories: CATEGORY_TYPES,
  });
};

exports.create = catchAsync(async (req, res) => {
  const result = await service.createCustomerRequest({ body: req.body, user: req.user });
  res.status(201).json({ status: "success", request: result });
});

exports.track = catchAsync(async (req, res) => {
  const request = await service.trackCustomerRequest({
    radicado: req.body?.radicado,
    accessCode: req.body?.accessCode,
  });
  res.status(200).json({ status: "success", request });
});

exports.adminList = catchAsync(async (req, res) => {
  const data = await service.listForAdmin(req.query);
  res.status(200).json({ status: "success", ...data });
});

exports.adminGet = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) return next(new AppError("ID inválido", 400));
  const request = await service.getForAdmin(req.params.id);
  res.status(200).json({ status: "success", request });
});

exports.adminUpdateStatus = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) return next(new AppError("ID inválido", 400));
  const request = await service.updateStatusByAdmin(req.params.id, req.body || {}, req.user?.id);
  safeLog(
    logAuditEvent({
      req,
      user: req.user,
      action: "customer_request_status",
      module: "pqr",
      entityId: request.id,
      entityType: "CustomerRequest",
      summary: `${request.radicado} → ${request.status}`,
    })
  );
  res.status(200).json({ status: "success", request });
});
