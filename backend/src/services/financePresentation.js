const AppError = require("../utils/AppError");
// Presentation of profitability. Does not decide which orders are reconciled.
// A missing cost is not a confirmed zero. A stored 0 is a real zero.

const round = (n) => Math.round(Number(n) || 0);

const lineRevenue = (item) => {
  const qty = item.quantity || 0;
  return item.lineTotal != null ? item.lineTotal : (item.unitPrice || 0) * qty;
};

/** Historical unit cost wins. Otherwise the current catalog cost. Null stays null. */
const resolveUnitCost = (item, fallback) => {
  if (item.unitCost != null && !Number.isNaN(Number(item.unitCost))) return Number(item.unitCost);
  if (fallback != null && !Number.isNaN(Number(fallback))) return Number(fallback);
  return null;
};

const emptyRollup = () => ({
  revenue: 0,
  knownRevenue: 0,
  missingRevenue: 0,
  units: 0,
  missingUnits: 0,
  cogs: 0,
});

const addLine = (roll, item, fallback) => {
  const qty = item.quantity || 0;
  const revenue = lineRevenue(item);
  const unitCost = resolveUnitCost(item, fallback);
  roll.revenue += revenue;
  roll.units += qty;
  if (unitCost == null) {
    roll.missingUnits += qty;
    roll.missingRevenue += revenue;
  } else {
    roll.knownRevenue += revenue;
    roll.cogs += unitCost * qty;
  }
  return unitCost;
};

const assess = (roll) => {
  const revenue = round(roll.revenue);
  const knownRevenue = round(roll.knownRevenue);
  const cogs = round(roll.cogs);
  const grossProfit = round(roll.revenue - roll.cogs);
  const knownProfit = round(roll.knownRevenue - roll.cogs);
  const grossMarginPct = revenue > 0 ? round((grossProfit / revenue) * 1000) / 10 : 0;
  const knownMarginPct = knownRevenue > 0 ? round((knownProfit / knownRevenue) * 1000) / 10 : null;
  const marginReliable = roll.missingUnits === 0;
  let status = "complete";
  if (revenue === 0 && roll.units === 0) status = "empty";
  else if (!marginReliable && knownRevenue === 0) status = "pending";
  else if (!marginReliable) status = "partial";
  const costCoveragePct = revenue > 0 ? round((knownRevenue / revenue) * 1000) / 10 : (marginReliable ? 100 : 0);
  return {
    revenue,
    knownRevenue,
    missingRevenue: round(roll.missingRevenue),
    units: roll.units,
    missingUnits: roll.missingUnits,
    cogs,
    grossProfit,
    grossMarginPct,
    knownProfit,
    knownMarginPct,
    marginReliable,
    costCoveragePct,
    status,
  };
};

const productRow = (row) => {
  const view = assess(row);
  const complete = row.missingUnits === 0;
  return {
    productId: row.productId,
    name: row.name,
    slug: row.slug,
    units: row.units,
    revenue: view.revenue,
    cost: complete ? round(row.cogs) : null,
    profit: complete ? view.knownProfit : null,
    marginPct: complete ? view.knownMarginPct : null,
    costComplete: complete,
    missingUnits: row.missingUnits,
  };
};

const PAGE_SIZES = [10, 20, 50];
const HISTORY_SIZES = [6, 12, 24];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const financeProductListQuery = (query = {}) => {
  const asked = query.page != null && query.page !== "";
  if (!asked) return { legacy: true };
  const page = Number(query.page);
  const limit = query.limit == null || query.limit === "" ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw new AppError("Página de costos inválida", 400);
  if (!PAGE_SIZES.includes(limit)) throw new AppError("Tamaño de página de costos inválido", 400);
  const filter = ["all", "active", "missing", "withCost", "lowMargin"].includes(query.filter)
    ? query.filter
    : "all";
  const sort = ["name", "stock", "price", "cost", "margin"].includes(query.sort) ? query.sort : "name";
  const dir = query.dir === "desc" ? -1 : 1;
  const q = String(query.q || "").trim().slice(0, 80);
  return { legacy: false, page, limit, skip: (page - 1) * limit, filter, sort, dir, q, regex: q ? escapeRegex(q) : "" };
};

const financeHistoryPage = (query = {}) => {
  if (query.page == null || query.page === "") return { paged: false };
  const page = Number(query.page);
  const limit = query.limit == null || query.limit === "" ? 12 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) throw new AppError("Página de historial inválida", 400);
  if (!HISTORY_SIZES.includes(limit)) throw new AppError("Tamaño de página de historial inválido", 400);
  return { paged: true, page, limit };
};

module.exports = {
  round,
  emptyRollup,
  addLine,
  assess,
  productRow,
  financeProductListQuery,
  financeHistoryPage,
  PAGE_SIZES,
  HISTORY_SIZES,
};
