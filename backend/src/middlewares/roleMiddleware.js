const AppError = require("../utils/AppError");

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("No tienes permisos para realizar esta acción", 403));
    }

    next();
  };
};

const STAFF_ROLES = ["superadmin", "admin", "vendedor"];

const blockStaffCheckout = (req, res, next) => {
  if (req.user && STAFF_ROLES.includes(req.user.role)) {
    return next(
      new AppError(
        "Las cuentas de personal no pueden realizar compras en la tienda",
        403
      )
    );
  }
  next();
};

module.exports = {
  authorizeRoles,
  blockStaffCheckout,
};