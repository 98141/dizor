"use strict";
// Comprobación explícita del API sandbox: sin base de datos, pedidos reales ni cobros.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const backend = path.resolve(__dirname, "../../backend");
const env = require(path.join(backend, "node_modules/dotenv")).parse(fs.readFileSync(path.join(backend, ".env")));
if (env.WOMPI_ENV !== "sandbox" || !env.WOMPI_PRIVATE_KEY?.startsWith("prv_test_") || !env.WOMPI_EVENTS_SECRET?.startsWith("test_events_")) {
  throw new Error("Se requieren claves de sandbox; no se acepta producción.");
}
Object.assign(process.env, { WOMPI_ENV: "sandbox", WOMPI_PRIVATE_KEY: env.WOMPI_PRIVATE_KEY,
  WOMPI_EVENTS_SECRET: env.WOMPI_EVENTS_SECRET, CLIENT_URL: "http://localhost:3000" });
(async () => {
  const orderNumber = "DIZ-QA-" + crypto.randomBytes(10).toString("hex").toUpperCase();
  try {
    const link = await require(path.join(backend, "src/services/wompiService")).createPaymentLink({ orderNumber, total: 150000 });
    const result = { sandbox: true, created: true, orderNumber, paymentLinkUrl: link.paymentLinkUrl, expiresAt: link.expiresAt,
      limit: "Solo creación de enlace sandbox; no se envió ningún pago ni se creó pedido en una base de datos." };
    fs.writeFileSync(path.join(__dirname, "sandbox-link.json"), JSON.stringify(result, null, 2));
    console.log("Enlace sandbox creado; sin transacciones ni cobros.");
  } catch (err) {
    const result = { sandbox: true, created: false, error: err.message };
    fs.writeFileSync(path.join(__dirname, "sandbox-link.json"), JSON.stringify(result, null, 2));
    console.error("No se pudo crear el enlace sandbox: " + err.message); process.exitCode = 1;
  }
})();
