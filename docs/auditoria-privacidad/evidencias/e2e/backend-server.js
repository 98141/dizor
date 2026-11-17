// Backend AISLADO para pruebas E2E de DIZOR.
// - No carga ningún .env (no usa server.js); variables fijadas aquí.
// - MongoDB en memoria (127.0.0.1, efímera) con datos sintéticos.
// - Correo: todas las funciones de envío sustituidas por capturas en memoria.
// - Red saliente bloqueada (fetch) salvo 127.0.0.1/localhost.
// - Textos legales: se marcan como "[FIXTURE DE PRUEBA]" (siguen en draft).
// - Puerto de control solo en 127.0.0.1 para inspeccionar la BD de pruebas.
"use strict";
const path = require("path");
const crypto = require("crypto");

const BACKEND = process.env.DIZOR_BACKEND_DIR;
const API_PORT = Number(process.env.E2E_API_PORT || 5100);
const CTRL_PORT = Number(process.env.E2E_CTRL_PORT || 5199);
const CLIENT = process.env.E2E_CLIENT_URL || "http://127.0.0.1:3100";
const TEST_ONLY_SECRET = `e2e-solo-pruebas-${crypto.randomBytes(24).toString("hex")}`;

Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "",
  JWT_SECRET: crypto.randomBytes(32).toString("hex"),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
  JWT_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  ADMIN_NOTIFY_EMAIL: "",
  // Valores ficticios: solo para que el checkout OFREZCA Wompi. La red
  // saliente está bloqueada; no se crea ningún enlace de pago real.
  WOMPI_PRIVATE_KEY: "prv_test_e2e_ficticia",
  WOMPI_EVENTS_SECRET: "e2e_events_ficticio",
  WOMPI_ENV: "sandbox",
  NEQUI_ENV: "",
  NEQUI_DIRECT_ENABLED: "",
  NEQUI_MANUAL_ENABLED: "",
  MARKETING_CART_REMINDERS_ENABLED: "false",
  NEQUI_CLIENT_ID: "",
  NEQUI_CLIENT_SECRET: "",
  NEQUI_API_KEY: "",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  CLIENT_URL: CLIENT,
  MARKETING_TOKEN_SECRET: TEST_ONLY_SECRET, // exclusivo de pruebas, se descarta al cerrar
  PQR_PUBLIC_ENABLED: "true",
  CONSENT_ACCEPT_DRAFT_FOR_TESTS: "false",
  ORDER_DELIVERY_TIME_TEXT: "",
  SHIPPING_MODE: "free_threshold",
  SHIPPING_FIXED_COST: "15000",
  FREE_SHIPPING_MIN: "200000",
});

const blocked = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    blocked.push(url.hostname);
    return Promise.reject(new Error(`bloqueado: ${url.hostname}`));
  }
  return realFetch(input, init);
};

const req = (p) => require(path.join(BACKEND, "src", p));
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
const express = require(path.join(BACKEND, "node_modules", "express"));
const { MongoMemoryServer } = require("mongodb-memory-server");

const mail = [];

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  if (mongoose.connection.host !== "127.0.0.1") throw new Error("BD no local");

  // Correo capturado ANTES de cargar la app (los servicios desestructuran).
  const emailService = req("services/emailService");
  for (const fn of Object.keys(emailService)) {
    if (typeof emailService[fn] !== "function") continue;
    emailService[fn] = async (arg) => {
      mail.push({ fn, at: new Date().toISOString(), arg: JSON.parse(JSON.stringify(arg ?? null)) });
      return { captured: true };
    };
  }
  req("services/orderReceiptService").setReceiptTransport(async (m) => {
    mail.push({ fn: "orderReceipt", at: new Date().toISOString(), arg: m });
  });
  req("services/customerRequestService").setRequestReceiptTransport(async (m) => {
    mail.push({ fn: "pqrReceipt", at: new Date().toISOString(), arg: m });
  });

  // Fase 3: se prueban los textos DEFINITIVOS tal como se publicarán (sin
  // prefijo de fixture), para verificar que no contienen marcas internas.

  const app = req("app");

  // ── Datos sintéticos ─────────────────────────────────────────────────────
  const [cat, weave, style, size, color] = await Promise.all([
    req("models/category").create({ name: "Sombreros E2E" }),
    req("models/weaveType").create({ name: "Tejido E2E" }),
    req("models/style").create({ name: "Horma E2E" }),
    req("models/size").create({ name: "M" }),
    req("models/color").create({ name: "Natural" }),
  ]);
  const product = await req("models/product").create({
    name: "Sombrero Fixture E2E",
    category: cat._id,
    weaveType: weave._id,
    style: style._id,
    salePrice: 120000,
    mainImage: "/favicon-dizor-192.png",
    images: [{ url: "/favicon-dizor-192.png", alt: "Fixture" }],
    variants: [{ size: size._id, color: color._id, sku: "E2E-M", stock: 100, isActive: true }],
    isActive: true,
  });
  await req("models/user").create({
    name: "Admin E2E", email: "admin-e2e@example.test", password: "AdminE2E12345", role: "admin",
  });
  await req("models/marketingSettings").create({
    key: "default",
    popup: { enabled: false },
    abandonedCart: { enabled: true, delayHours: 1, maxReminders: 2 },
  });

  app.listen(API_PORT, "127.0.0.1", () => console.log(`[e2e] API http://127.0.0.1:${API_PORT}`));

  // ── Control (solo localhost, solo pruebas) ───────────────────────────────
  const ctrl = express();
  ctrl.use(express.json());
  const models = {
    orders: req("models/order"),
    consent: req("models/consentRecord"),
    carts: req("models/abandonedCart"),
    subscribers: req("models/newsletterSubscriber"),
    suppression: req("models/marketingSuppression"),
    pqr: req("models/customerRequest"),
    users: req("models/user"),
  };
  ctrl.get("/fixture", (r, s) =>
    s.json({ productId: String(product._id), variantId: String(product.variants[0]._id), slug: product.slug, price: 120000 })
  );
  ctrl.get("/mail", (r, s) => s.json(mail));
  ctrl.get("/blocked", (r, s) => s.json(blocked));
  ctrl.post("/db/:name", async (r, s) => {
    const M = models[r.params.name];
    if (!M) return s.status(404).end();
    s.json(await M.find(r.body || {}).lean());
  });
  ctrl.post("/age-carts", async (r, s) => {
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    await models.carts.collection.updateMany({}, { $set: { updatedAt: old, lastReminderAt: null } });
    s.json({ ok: true });
  });
  ctrl.post("/reminders", async (r, s) => {
    const now = r.body?.now ? new Date(r.body.now) : new Date();
    s.json(await req("services/marketingService").sendDueAbandonedReminders({ now }));
  });
  ctrl.post("/newsletter-unsubscribe-url", async (r, s) => {
    const sub = await models.subscribers.findOne({ email: r.body.email });
    const token = req("services/marketingService").getNewsletterUnsubscribeToken(sub._id);
    s.json({ url: `${CLIENT}/baja?t=${encodeURIComponent(token)}` });
  });
  ctrl.post("/reset-limits", (r, s) => {
    const lims = req("middlewares/rateLimitMiddleware");
    for (const k of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) {
      for (const l of Object.values(lims)) if (typeof l.resetKey === "function") l.resetKey(k);
    }
    s.json({ ok: true });
  });
  ctrl.listen(CTRL_PORT, "127.0.0.1", () => console.log(`[e2e] control http://127.0.0.1:${CTRL_PORT}`));

  const shutdown = async () => {
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((e) => {
  console.error("[e2e] fallo al iniciar:", e);
  process.exit(1);
});
