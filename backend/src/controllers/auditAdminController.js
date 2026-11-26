const AuditLog = require("../models/AuditLog");
const catchAsync = require("../utils/catchAsync");
const { parseAuditPagination, auditDateFilter, bogotaDayStart } = require("../utils/auditQuery");

const formatAuditLog = (log) => ({
  id: log._id,
  userId: log.userId,
  userEmail: log.userEmail,
  role: log.role,
  action: log.action,
  module: log.module,
  entityId: log.entityId,
  entityType: log.entityType,
  summary: log.summary,
  ip: log.ip,
  success: log.success,
  previousData: log.previousData,
  newData: log.newData,
  createdAt: log.createdAt,
});

exports.getAuditLogs = catchAsync(async (req, res) => {
  // Sprint 08: page size bounded to 1..100 (a negative limit used to reach Mongo).
  const { page, limit, skip } = parseAuditPagination(req.query);

  const filter = {};

  if (req.query.module) filter.module = req.query.module;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.success === "true") filter.success = true;
  if (req.query.success === "false") filter.success = false;

  // Sprint 08: date-only values are Colombian civil days and "to" includes that whole
  // day (it used to stop at 00:00 UTC of the selected date, excluding it).
  const createdAt = auditDateFilter(req.query.from, req.query.to);
  if (createdAt) filter.createdAt = createdAt;

  const term = req.query.term?.trim();
  if (term) {
    const regex = new RegExp(
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    filter.$or = [
      { userEmail: regex },
      { action: regex },
      { module: regex },
      { summary: regex },
      { role: regex },
    ];
  }

  const [logs, total, modules, actions] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct("module"),
    AuditLog.distinct("action"),
  ]);

  res.status(200).json({
    status: "success",
    results: logs.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    filters: {
      modules: modules.sort(),
      actions: actions.sort(),
    },
    logs: logs.map(formatAuditLog),
  });
});

exports.getAuditStats = catchAsync(async (req, res) => {
  // Sprint 08: "Hoy" is the America/Bogota civil day, not the host's local midnight.
  const today = bogotaDayStart();

  const [total, todayCount, failedCount, byModule] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.countDocuments({ createdAt: { $gte: today } }),
    AuditLog.countDocuments({ success: false }),
    AuditLog.aggregate([
      { $group: { _id: "$module", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
  ]);

  res.status(200).json({
    status: "success",
    stats: {
      total,
      today: todayCount,
      failed: failedCount,
      byModule: byModule.map((row) => ({
        module: row._id,
        count: row.count,
      })),
    },
  });
});
