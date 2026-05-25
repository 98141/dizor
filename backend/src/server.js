require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./lib/logger");

const PORT = process.env.PORT || 5000;

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

requiredEnvVars.forEach((envName) => {
  if (!process.env[envName]) {
    logger.error(`Falta variable de entorno requerida: ${envName}`);
    process.exit(1);
  }
});

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
