const StoreSettings = require("../models/storeSettings");

// Transportadoras confirmadas por el negocio (2026-11-16). "envia" y
// "coordinadora" quedan solo para pedidos históricos.
const CONFIRMED_CARRIERS = Object.freeze(["interrapidisimo", "servientrega"]);

// El envío está incluido en el precio (decisión del negocio 2026-11-16).
// Vale aunque la BD conserve otro modo, para no depender de un cambio manual
// en producción; SHIPPING_INCLUDED_IN_PRICE=false devuelve el control a
// settings.shippingMode (reversión).
const isShippingIncluded = (settings) =>
  process.env.SHIPPING_INCLUDED_IN_PRICE !== "false" ||
  settings?.shippingMode === "included";

const DEFAULT_SETTINGS = {
  taxEnabled: process.env.TAX_ENABLED === "true",
  taxRate: Number(process.env.TAX_RATE) || 0,
  shippingMode: process.env.SHIPPING_MODE || "included",
  shippingFixedCost: Number(process.env.SHIPPING_FIXED_COST) || 15000,
  freeShippingMinAmount: Number(process.env.FREE_SHIPPING_MIN) || 200000,
  shippingByDepartment: {},
  currency: "COP",
  carriers: [...CONFIRMED_CARRIERS],
};

exports.CONFIRMED_CARRIERS = CONFIRMED_CARRIERS;
exports.isShippingIncluded = isShippingIncluded;

// Transportadoras ofrecibles: las confirmadas por el negocio (la lista de la
// BD puede conservar valores antiguos).
exports.getActiveCarriers = () => [...CONFIRMED_CARRIERS];

exports.getStoreSettings = async () => {
  let settings = await StoreSettings.findOne({ key: "default" });

  if (!settings) {
    settings = await StoreSettings.create({ key: "default", ...DEFAULT_SETTINGS });
  }

  return settings;
};

exports.getShippingCost = (settings, subtotal, department) => {
  if (isShippingIncluded(settings)) return 0;
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
