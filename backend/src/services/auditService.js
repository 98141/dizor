const AuditLog = require("../models/AuditLog");

const getRequestMeta = (req) => ({
  ip: req.ip || req.headers["x-forwarded-for"] || null,
  userAgent: req.headers["user-agent"] || null,
});

exports.logAuthEvent = async ({
  req,
  action,
  user = null,
  success = true,
  previousData = null,
  newData = null,
}) => {
  const meta = getRequestMeta(req);

  await AuditLog.create({
    userId: user?._id || user?.id || null,
    userEmail: user?.email || req.body?.email || null,
    role: user?.role || null,
    action,
    module: "auth",
    ip: meta.ip,
    userAgent: meta.userAgent,
    previousData,
    newData,
    success,
  });
};
