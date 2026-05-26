require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./lib/logger");

const PORT = process.env.PORT || 5000;

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

requiredEnvVars.forEach((envName) => {
  if (!process.env[envName]) {
    logger.error(`[SECURITY] Falta variable de entorno requerida: ${envName}`);
    process.exit(1);
  }
});

// Secretos JWT deben tener mínimo 32 caracteres
const MIN_SECRET_LENGTH = 32;
["JWT_SECRET", "JWT_REFRESH_SECRET"].forEach((key) => {
  if ((process.env[key] || "").length < MIN_SECRET_LENGTH) {
    logger.error(`[SECURITY] ${key} es demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres). Servidor detenido.`);
    process.exit(1);
  }
});

// En producción, Wompi debe estar en modo producción
if (process.env.NODE_ENV === "production" && process.env.WOMPI_ENV !== "production") {
  logger.error("[SECURITY] WOMPI_ENV debe ser 'production' en entorno de producción. Servidor detenido.");
  process.exit(1);
}

connectDB();

const server = app.listen(PORT, () => {
  logger.info("Servidor iniciado", {
    port: PORT,
    env: process.env.NODE_ENV || "development",
  });
});

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection — cerrando servidor", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception — proceso terminado", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
