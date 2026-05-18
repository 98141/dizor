const StoreSettings = require("../models/storeSettings");

const DEFAULT_SETTINGS = {
  taxEnabled: process.env.TAX_ENABLED === "true",
  taxRate: Number(process.env.TAX_RATE) || 0,
  shippingMode: process.env.SHIPPING_MODE || "free_threshold",
  shippingFixedCost: Number(process.env.SHIPPING_FIXED_COST) || 15000,
  freeShippingMinAmount: Number(process.env.FREE_SHIPPING_MIN) || 200000,
  shippingByDepartment: {},
  currency: "COP",
  carriers: ["interrapidisimo", "envia", "coordinadora"],
};

exports.getStoreSettings = async () => {
  let settings = await StoreSettings.findOne({ key: "default" });

  if (!settings) {
    settings = await StoreSettings.create({ key: "default", ...DEFAULT_SETTINGS });
  }

  return settings;
};

exports.getShippingCost = (settings, subtotal, department) => {
  if (settings.shippingMode === "fixed") {
    return settings.shippingFixedCost;
  }

  if (settings.shippingMode === "free_threshold") {
    return subtotal >= settings.freeShippingMinAmount
      ? 0
      : settings.shippingFixedCost;
  }

  if (settings.shippingMode === "by_department" && department) {
    const map = settings.shippingByDepartment;
    const deptCost =
      map instanceof Map ? map.get(department) : map?.[department];
    if (deptCost != null) return deptCost;
    return settings.shippingFixedCost;
  }

  return settings.shippingFixedCost;
};
