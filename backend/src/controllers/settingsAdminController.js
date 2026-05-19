const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { getStoreSettings } = require("../services/settingsService");
const { logAuditEvent, safeLog } = require("../services/auditService");

const formatSettings = (settings) => {
  const doc = settings.toObject ? settings.toObject() : settings;
  const shippingByDepartment = {};

  if (doc.shippingByDepartment instanceof Map) {
    doc.shippingByDepartment.forEach((value, key) => {
      shippingByDepartment[key] = value;
    });
  } else if (doc.shippingByDepartment) {
    Object.assign(shippingByDepartment, doc.shippingByDepartment);
  }

  return {
    id: doc._id,
    taxEnabled: doc.taxEnabled,
    taxRate: doc.taxRate,
    shippingMode: doc.shippingMode,
    shippingFixedCost: doc.shippingFixedCost,
    freeShippingMinAmount: doc.freeShippingMinAmount,
    shippingByDepartment,
    currency: doc.currency,
    carriers: doc.carriers,
    updatedAt: doc.updatedAt,
  };
};

exports.getSettings = catchAsync(async (req, res) => {
  const settings = await getStoreSettings();

  res.status(200).json({
    status: "success",
    settings: formatSettings(settings),
  });
});

exports.updateSettings = catchAsync(async (req, res, next) => {
  const settings = await getStoreSettings();
  const allowed = [
    "taxEnabled",
    "taxRate",
    "shippingMode",
    "shippingFixedCost",
    "freeShippingMinAmount",
    "shippingByDepartment",
    "carriers",
  ];

  allowed.forEach((key) => {
    if (req.body[key] !== undefined) {
      if (key === "shippingByDepartment" && req.body[key]) {
        settings.shippingByDepartment = req.body[key];
      } else {
        settings[key] = req.body[key];
      }
    }
  });

  if (settings.taxRate < 0 || settings.taxRate > 100) {
    return next(new AppError("La tasa de impuesto debe estar entre 0 y 100", 400));
  }

  await settings.save();

  safeLog(
    logAuditEvent({
      req,
      action: "settings_updated",
      module: "settings",
      user: req.user,
      entityType: "store_settings",
      summary: "Configuración de tienda actualizada",
      newData: {
        taxEnabled: settings.taxEnabled,
        shippingMode: settings.shippingMode,
      },
    })
  );

  res.status(200).json({
    status: "success",
    settings: formatSettings(settings),
  });
});
