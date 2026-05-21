const AuditLog = require("../models/AuditLog");
const logger = require("../lib/logger");

const getRequestMeta = (req) => ({
  ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
  userAgent: req?.headers?.["user-agent"] || null,
  method: req?.method || null,
  path: req?.originalUrl || req?.path || null,
});

const sanitizePayload = (data) => {
  if (data == null) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return null;
  }
};

/**
 * Registro genérico de auditoría. No lanza error si falla el guardado.
 */
exports.logAuditEvent = async ({
  req = null,
  action,
  module,
  user = null,
  success = true,
  previousData = null,
  newData = null,
  entityId = null,
  entityType = null,
  summary = null,
}) => {
  if (!action || !module) return;

  const meta = req
    ? getRequestMeta(req)
    : { ip: null, userAgent: null, method: null, path: null };

  try {
    await AuditLog.create({
      userId: user?._id || user?.id || null,
      userEmail: user?.email || req?.body?.email || null,
      role: user?.role || null,
      action,
      module,
      ip: meta.ip,
      userAgent: meta.userAgent,
      method: meta.method,
      path: meta.path,
      previousData: sanitizePayload(previousData),
      newData: sanitizePayload(newData),
      entityId: entityId || null,
      entityType: entityType || null,
      summary: summary ? String(summary).slice(0, 500) : null,
      success,
    });
  } catch (saveErr) {
    logger.warn("Audit log save failed", {
      action,
      module,
      error: saveErr.message,
    });
  }
};

/** Compatibilidad con llamadas existentes (auth y pedidos legacy). */
exports.logAuthEvent = async (payload) => {
  const moduleName = payload.module || "auth";
  return exports.logAuditEvent({ ...payload, module: moduleName });
};

exports.safeLog = (promise) => {
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {});
  }
};
