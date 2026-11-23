const AppError = require("./AppError");
const DAY = 86400000;
// Financial dates are Colombian civil dates, independent of the host timezone.
const dayKey = (date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);
const civil = (date) => new Date(`${dayKey(date)}T00:00:00Z`);
const boundary = (value, end = false) => {
  // Explicit offsets identify instants; date-only inputs identify civil days.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const instant = new Date(value);
    const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(+instant) || !Number.isFinite(+calendar) || key(calendar) !== value.slice(0, 10)) throw new AppError("Fecha financiera inválida", 400);
    return instant;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new AppError("Fecha financiera inválida", 400);
  const date = new Date(`${value}T00:00:00-05:00`);
  if (!Number.isFinite(+date) || dayKey(date) !== value) throw new AppError("Fecha financiera inválida", 400);
  return end ? new Date(+date + DAY - 1) : date;
};
const key = (date) => date.toISOString().slice(0, 10);
const bounds = (start, end) => ({ start: boundary(key(start)), end: boundary(key(end), true) });
exports.financeMonthBounds = (monthsAgo = 0, now = new Date()) => {
  const d = civil(now);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return bounds(start, end);
};
exports.parseFinancePeriod = (period, from, to, now = new Date()) => {
  if (from || to) {
    const start = boundary(from), end = boundary(to, true);
    if (start > end) throw new AppError("Rango financiero inválido", 400);
    return { start, end, label: `Del ${from} al ${to}` };
  }
  if (period === "all") return { start: null, end: null, label: "Histórico completo" };
  const end = civil(now), start = new Date(end);
  let label;
  switch (period) {
    case "week": start.setUTCDate(start.getUTCDate() - 6); label = "Últimos 7 días"; break;
    case "quarter": start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1); label = "Trimestre actual"; break;
    case "year": start.setUTCMonth(0, 1); label = "Año actual"; break;
    default: start.setUTCDate(1); label = "Mes actual";
  }
  return { ...bounds(start, end), label };
};
exports.historyBounds = (groupBy, from, to, now = new Date()) => {
  if (from || to) return exports.parseFinancePeriod(null, from, to, now);
  const end = civil(now), start = new Date(end);
  if (groupBy === "day") start.setUTCDate(start.getUTCDate() - 29);
  else if (groupBy === "week") start.setUTCDate(start.getUTCDate() - 83);
  else if (groupBy === "year") start.setUTCFullYear(start.getUTCFullYear() - 4, 0, 1);
  else start.setUTCMonth(start.getUTCMonth() - 11, 1);
  return bounds(start, end);
};
exports.financePeriodKey = (date, groupBy) => {
  const d = civil(date);
  if (groupBy === "day") return key(d);
  if (groupBy === "year") return String(d.getUTCFullYear());
  if (groupBy === "week") {
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  return key(d).slice(0, 7);
};
exports.buildDateFilter = (start, end) => {
  if (!start && !end) return {};
  return { createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } };
};
