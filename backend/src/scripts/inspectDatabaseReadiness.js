// Uso por operador autorizado: MONGO_URI en entorno seguro. Solo lectura, sin dotenv ni migración.
const mongoose = require("mongoose");
if (!process.argv.includes("--read-only") || !process.env.MONGO_URI) {
  console.error("Requiere --read-only y MONGO_URI autorizado en el entorno; no carga .env");
  process.exit(1);
}
mongoose.set("autoIndex", false); mongoose.set("autoCreate", false);
const readiness = require("../services/databaseReadiness"); readiness.loadModels();
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
    const result = await readiness.inspect(); console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 1;
  } catch (err) { console.error(JSON.stringify({ ready: false, code: err.code || "DATABASE_INSPECTION_FAILED" })); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
