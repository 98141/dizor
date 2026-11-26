const AppError = require("./AppError");

// Sprint 08: read-only query helpers for GET /admin/audit and /admin/audit/stats.
// They only bound the page size and interpret date-only filters as Colombian civil
// days (same rule as financePeriod, F7-01). Stored events are never modified.
const DAY = 86400000;
const AUDIT_PAGE_SIZE_DEFAULT = 25;
const AUDIT_PAGE_SIZE_MAX = 100;

const dayKey = (date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

const invalid = () => new AppError("Fecha de auditoría inválida", 400);

const boundary = (value, end = false) => {
  if (typeof value !== "string") throw invalid();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Colombia has no DST: a civil day starts at 05:00 UTC.
    const start = new Date(`${value}T00:00:00-05:00`);
    if (!Number.isFinite(+start) || dayKey(start) !== value) throw invalid();
    return end ? new Date(+start + DAY - 1) : start;
  }
  // Explicit instants keep the previous behaviour (new Date(value)).
  const instant = new Date(value);
  if (!Number.isFinite(+instant)) throw invalid();
  return instant;
};

/** page >= 1; limit in 1..100, default 25 (a missing, zero or negative value uses the default). */
exports.parseAuditPagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requested = parseInt(query.limit, 10);
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.min(AUDIT_PAGE_SIZE_MAX, requested)
    : AUDIT_PAGE_SIZE_DEFAULT;
  return { page, limit, skip: (page - 1) * limit };
};

/** createdAt range. "Hasta" includes the whole selected day in America/Bogota. */
exports.auditDateFilter = (from, to) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = boundary(from);
  if (to) range.$lte = boundary(to, true);
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    throw new AppError("La fecha inicial no puede ser posterior a la final", 400);
  }
  return range;
};

/** Start of the current civil day in America/Bogota, independent of the host timezone. */
exports.bogotaDayStart = (now = new Date()) => new Date(`${dayKey(now)}T00:00:00-05:00`);

exports.AUDIT_PAGE_SIZE_MAX = AUDIT_PAGE_SIZE_MAX;
