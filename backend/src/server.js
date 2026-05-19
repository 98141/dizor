// backend/src/server.js
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

requiredEnvVars.forEach((envName) => {
  if (!process.env[envName]) {
    console.error(`Falta variable de entorno requerida: ${envName}`);
    process.exit(1);
  }
});

connectDB();

const server = app.listen(PORT, () => {
  console.log(`Servidor Dizor corriendo en puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || "development"}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.name, err.message);
  process.exit(1);
});