const Coupon = require("../models/coupon");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");

exports.getCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.json({ coupons });
});

exports.createCoupon = catchAsync(async (req, res, next) => {
  const { code, description, type, value, minOrderAmount, maxUses, expiresAt } =
    req.body;

  if (!code || !type || value == null) {
    return next(new AppError("Código, tipo y valor son obligatorios", 400));
  }

  if (!["percentage", "fixed"].includes(type)) {
    return next(new AppError("Tipo inválido", 400));
  }

  if (Number(value) <= 0) {
    return next(new AppError("El valor debe ser mayor a 0", 400));
  }

  if (type === "percentage" && Number(value) > 100) {
    return next(new AppError("El porcentaje no puede superar 100", 400));
  }

  const existing = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (existing) {
    return next(new AppError("Ya existe un cupón con ese código", 400));
  }

  const coupon = await Coupon.create({
    code: code.trim().toUpperCase(),
    description: description || "",
    type,
    value: Number(value),
    minOrderAmount: Number(minOrderAmount) || 0,
    maxUses: maxUses ? Number(maxUses) : null,
    expiresAt: expiresAt || null,
  });

  safeLog(
    logAuditEvent({
      req,
      action: "coupon_created",
      module: "coupons",
      user: req.user,
      entityId: coupon._id,
      entityType: "coupon",
      summary: `Cupón creado · ${coupon.code}`,
      newData: { code: coupon.code, type: coupon.type, value: coupon.value, maxUses: coupon.maxUses },
    })
  );

  res.status(201).json({ coupon });
});

exports.updateCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return next(new AppError("Cupón no encontrado", 404));

  const { description, type, value, minOrderAmount, maxUses, expiresAt } =
    req.body;

  if (type && !["percentage", "fixed"].includes(type)) {
    return next(new AppError("Tipo inválido", 400));
  }

  if (value != null && Number(value) <= 0) {
    return next(new AppError("El valor debe ser mayor a 0", 400));
  }

  if (type === "percentage" && value != null && Number(value) > 100) {
    return next(new AppError("El porcentaje no puede superar 100", 400));
  }

  const previousData = { code: coupon.code, type: coupon.type, value: coupon.value, maxUses: coupon.maxUses, expiresAt: coupon.expiresAt };

  if (description !== undefined) coupon.description = description;
  if (type !== undefined) coupon.type = type;
  if (value !== undefined) coupon.value = Number(value);
  if (minOrderAmount !== undefined) coupon.minOrderAmount = Number(minOrderAmount);
  if (maxUses !== undefined) coupon.maxUses = maxUses ? Number(maxUses) : null;
  if (expiresAt !== undefined) coupon.expiresAt = expiresAt || null;

  await coupon.save();

  safeLog(
    logAuditEvent({
      req,
      action: "coupon_updated",
      module: "coupons",
      user: req.user,
      entityId: coupon._id,
      entityType: "coupon",
      summary: `Cupón editado · ${coupon.code}`,
      previousData,
      newData: { code: coupon.code, type: coupon.type, value: coupon.value, maxUses: coupon.maxUses, expiresAt: coupon.expiresAt },
    })
  );

  res.json({ coupon });
});

exports.toggleCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return next(new AppError("Cupón no encontrado", 404));

  const wasActive = coupon.isActive;
  coupon.isActive = !coupon.isActive;
  await coupon.save();

  safeLog(
    logAuditEvent({
      req,
      action: "coupon_toggled",
      module: "coupons",
      user: req.user,
      entityId: coupon._id,
      entityType: "coupon",
      summary: `Cupón ${coupon.isActive ? "activado" : "desactivado"} · ${coupon.code}`,
      previousData: { isActive: wasActive },
      newData: { isActive: coupon.isActive },
    })
  );

  res.json({ coupon });
});

exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return next(new AppError("Cupón no encontrado", 404));

  safeLog(
    logAuditEvent({
      req,
      action: "coupon_deleted",
      module: "coupons",
      user: req.user,
      entityId: coupon._id,
      entityType: "coupon",
      summary: `Cupón eliminado · ${coupon.code}`,
      previousData: { code: coupon.code, type: coupon.type, value: coupon.value },
    })
  );

  res.json({ message: "Cupón eliminado" });
});
