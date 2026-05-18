const AppError = require("../utils/AppError");

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("No tienes permisos para realizar esta acción", 403));
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
};