// backend/src/middlewares/errorMiddleware.js
const AppError = require("../utils/AppError");

const handleCastErrorDB = () => {
  return new AppError("ID inválido", 400);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0];
  return new AppError(`El valor de ${field} ya está registrado`, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(errors.join(". "), 400);
};

const handleJWTError = () => {
  return new AppError("Token inválido. Inicia sesión nuevamente", 401);
};

const handleJWTExpiredError = () => {
  return new AppError("Tu sesión expiró. Inicia sesión nuevamente", 401);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  return res.status(500).json({
    status: "error",
    message: "Error interno del servidor",
  });
};

const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  if (error.name === "CastError") error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === "ValidationError") error = handleValidationErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

  if (process.env.NODE_ENV === "development") {
    return sendErrorDev(error, res);
  }

  return sendErrorProd(error, res);
};

module.exports = globalErrorHandler;
