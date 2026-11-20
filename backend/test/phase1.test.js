// Verificación AISLADA de hallazgos de la auditoría del administrador DIZOR.
// - MongoDB en memoria (127.0.0.1), sin .env, red saliente bloqueada.
// - Sin claves de Resend/Wompi reales: los correos NO salen; se registran
//   los intentos capturando la consola.
// - Logger de archivos sustituido por un transporte nulo (no escribe en el repo).
// - Datos 100 % sintéticos (dominio reservado .test).
"use strict";

const path = require("path");
const crypto = require("crypto");
const Module = require("module");
const test = require("node:test");
const assert = require("node:assert/strict");

const BACKEND = process.env.DIZOR_BACKEND_DIR || path.resolve(__dirname, "..");
const MMS = process.env.MMS_DIR; // carpeta con node_modules/mongodb-memory-server
if (!BACKEND || !MMS) throw new Error("Faltan DIZOR_BACKEND_DIR / MMS_DIR");

const rnd = (n) => crypto.randomBytes(n).toString("hex");
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "",
  JWT_SECRET: rnd(32),
  JWT_REFRESH_SECRET: rnd(32),
  JWT_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  ADMIN_NOTIFY_EMAIL: "",
  WOMPI_PRIVATE_KEY: "prv_test_ficticia",
  WOMPI_EVENTS_SECRET: "events_ficticio_" + rnd(8),
  WOMPI_ENV: "sandbox",
  NEQUI_CLIENT_ID: "", NEQUI_CLIENT_SECRET: "", NEQUI_API_KEY: "", NEQUI_WEBHOOK_SECRET: "",
  CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
  NEQUI_ENV: "",
  NEQUI_DIRECT_ENABLED: "",
  NEQUI_MANUAL_ENABLED: "",
  MARKETING_CART_REMINDERS_ENABLED: "false",
  CLOUDINARY_CLOUD_NAME: "",
  CLIENT_URL: "http://localhost:3000",
  MARKETING_TOKEN_SECRET: rnd(32),
  PQR_PUBLIC_ENABLED: "false",
});

// Logger de archivo → transporte nulo (evita escribir backend/logs).
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "winston-daily-rotate-file") {
    const Transport = origLoad("winston-transport", parent, isMain);
    return class NullTransport extends Transport { log(_i, cb) { cb(); } };
  }
  return origLoad.apply(this, arguments);
};

// Red saliente bloqueada.
const blocked = [];
const providerResponses = new Map();
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (providerResponses.has(url.href)) {
    const response = providerResponses.get(url.href);
    return Promise.resolve(new Response(JSON.stringify(response.body), { status: response.status || 200, headers: { "Content-Type": "application/json" } }));
  }
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    blocked.push(url.hostname);
    return Promise.reject(new Error("Red saliente bloqueada"));
  }
  return realFetch(input, init);
};

// Captura de consola para detectar intentos de correo (modo sin clave).
const consoleLines = [];
for (const m of ["log", "info", "warn", "error"]) {
  const orig = console[m].bind(console);
  console[m] = (...a) => { consoleLines.push(a.map(String).join(" ")); if (process.env.VERBOSE) orig(...a); };
}
const mark = () => consoleLines.length;
const linesSince = (i) => consoleLines.slice(i);

const { MongoMemoryReplSet } = require(path.join(MMS, "node_modules", "mongodb-memory-server"));
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
const req = (p) => require(path.join(BACKEND, "src", p));

let mongod, server, base, app;
let Order, Product, User, Coupon, Category, Size, Color;
let product, variantId, adminCookie, vendorCookie, clientCookie;

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  if (ok !== null) assert.equal(ok, true, `${id}: ${JSON.stringify(detail)}`);
};

const api = async (method, p, { body, cookie } = {}) => {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
};
const login = async (email, password) => {
  const r = await api("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, r.text);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
};
const stockOf = async () => (await Product.findById(product._id)).variants.id(variantId).stock;
const orderBody = (extra = {}) => ({
  items: [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }],
  buyer: { name: "Comprador Prueba", email: "comprador@example.test", phone: "3000000000" },
  shippingAddress: { address: "Calle Ficticia 1", city: "Pasto", department: "Nariño" },
  paymentMethod: "contra_entrega",
  carrier: "interrapidisimo",
  termsAccepted: true,
  privacyAuthorization: true,
  idempotencyKey: crypto.randomUUID(),
  ...extra,
});
const createCE = async (extra = {}, cookie) => {
  const r = await api("POST", "/api/checkout/orders", { body: orderBody(extra), cookie });
  assert.equal(r.status, 201, r.text);
  return Order.findById(r.json.order.id);
};
// Pedido Wompi sin enlace real (la red está bloqueada): se usa el servicio
// interno con deductStock=false, igual que hace el checkout para Wompi.
const createWompiOrder = async () => {
  const { createOrder } = req("services/orderService");
  const { resolveCartItems, calculateTotals } = req("services/cartService");
  const { getStoreSettings } = req("services/settingsService");
  const items = await resolveCartItems([{ productId: product._id, variantId, quantity: 1 }]);
  const totals = calculateTotals(items, await getStoreSettings(), "Nariño");
  return createOrder({
    user: null, isGuest: true,
    buyer: { name: "Wompi Prueba", email: "wompi@example.test", phone: "3000000001" },
    shippingAddress: { address: "Calle 2", city: "Pasto", department: "Nariño" },
    items, totals, paymentMethod: "wompi", carrier: "", customerNotes: "",
    deductStock: false, idempotencyKey: crypto.randomUUID(),
  });
};
const wompiEvent = (tx) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const data = { transaction: tx };
  const chain = properties.map((p) => p.split(".").reduce((v, k) => v?.[k], data)).join("") + timestamp + process.env.WOMPI_EVENTS_SECRET;
  const checksum = crypto.createHash("sha256").update(chain).digest("hex").toUpperCase();
  return { body: { event: "transaction.updated", data, environment: "test", signature: { properties }, timestamp }, checksum };
};
const postWompi = async ({ body, checksum }) =>
  (await fetch(`${base}/api/webhooks/wompi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Event-Checksum": checksum },
    body: JSON.stringify(body),
  })).status;
const tx = (order, extra = {}) => ({
  id: `tx-${crypto.randomUUID()}`, status: "APPROVED",
  amount_in_cents: Math.round(order.total * 100), currency: "COP",
  reference: `ref-${rnd(4)}`, sku: order.orderNumber, ...extra,
});

test.before(async () => {
  try { await setup(); } catch (e) { process.stderr.write("SETUP ERROR: " + (e.stack || e) + "\n"); throw e; }
});
async function setup() {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  assert.match(mongod.getUri(), /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(mongod.getUri());
  app = req("app");
  Order = req("models/order");
  Product = req("models/product");
  User = req("models/user");
  Coupon = req("models/coupon");
  Category = req("models/category");
  Size = req("models/size");
  Color = req("models/color");
  // Comportamiento real de arranque (autoIndex), sin forzar syncIndexes.
  let initError = null;
  try { await Order.init(); } catch (e) { initError = e.message.slice(0, 160); }
  const idx = (await Order.collection.indexes()).map((i) => ({ key: i.key, unique: !!i.unique, sparse: !!i.sparse }));
  const allIndexes = await Promise.allSettled(Object.values(mongoose.models).map((model) => model.init()));
  const phaseModels = ["Order", "Product", "Coupon", "ProductHistory", "PaymentEvent"];
  for (const name of phaseModels) await mongoose.model(name).init();
  results.push({ id: "unrelated-indexes", failures: allIndexes.filter((r) => r.status === "rejected").map((r) => r.reason.message) });
  record("A0", !initError, { initError, indexesCreated: idx });
  req("services/orderReceiptService").setReceiptTransport(async () => ({ devMode: false }));

  const [cat, size, color] = await Promise.all([
    Category.create({ name: "Cat Prueba" }), Size.create({ name: "M" }), Color.create({ name: "Natural" }),
  ]);
  product = await Product.create({
    name: "Sombrero Ficticio", category: cat._id, salePrice: 100000, internalCost: 40000,
    mainImage: "https://example.test/i.jpg", images: [{ url: "https://example.test/i.jpg" }],
    variants: [{ size: size._id, color: color._id, sku: "AUD-M", stock: 100, isActive: true }],
  });
  variantId = product.variants[0]._id;
  await User.create({ name: "Admin", email: "admin@example.test", password: "AdminPrueba123", role: "admin" });
  await User.create({ name: "Vend", email: "vend@example.test", password: "VendPrueba123", role: "vendedor" });
  await User.create({ name: "Cliente", email: "cliente@example.test", password: "ClientePrueba123", role: "cliente" });
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = await login("admin@example.test", "AdminPrueba123");
  vendorCookie = await login("vend@example.test", "VendPrueba123");
  clientCookie = await login("cliente@example.test", "ClientePrueba123");
}

test.after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  assert.deepEqual(blocked, [], "No debe intentarse red externa");
  console.info = () => {};
  process.stdout.write("\n=== RESULTADOS ===\n" + JSON.stringify(results, null, 2) + "\n");
  process.stdout.write(`Intentos de red saliente bloqueados: ${JSON.stringify(blocked)}\n`);
});

test("A1 índice idempotencyKey: dos pedidos sin clave", async () => {
  const idx = (await Order.collection.indexes()).find((i) => i.key.idempotencyKey);
  const r1 = await api("POST", "/api/checkout/orders", { body: orderBody({ idempotencyKey: undefined }) });
  const r2 = await api("POST", "/api/checkout/orders", { body: orderBody({ idempotencyKey: undefined }) });
  record("A1", r2.status === 201, { index: idx, first: r1.status, second: r2.status, msg: r2.json?.message?.slice(0, 120) });
});

test("A2 número de pedido con peticiones concurrentes", async () => {
  const rs = await Promise.all(Array.from({ length: 6 }, () => api("POST", "/api/checkout/orders", { body: orderBody() })));
  const statuses = rs.map((r) => r.status);
  const errors = rs.filter((r) => r.status !== 201).map((r) => r.json?.message?.slice(0, 100));
  record("A2", statuses.every((s) => s === 201), { statuses, errors });
});

test("B1 contraentrega despachada conserva pago pendiente por ambas rutas", async () => {
  const o = await createCE();
  const s1 = await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  const s2 = await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: adminCookie, body: { carrier: "servientrega", trackingNumber: "GUIA-1" } });
  const after = await Order.findById(o._id);
  // Mismo pedido por la otra vía (selector de estado "enviado").
  const o2 = await createCE();
  await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  await api("PATCH", `/api/admin/orders/${o2._id}/shipping`, { cookie: adminCookie, body: { carrier: "servientrega", trackingNumber: "GUIA-2" } });
  const st = await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "enviado" } });
  const after2 = await Order.findById(o2._id);
  record("B1", after2.orderStatus === "enviado" && after.orderStatus === "enviado" && after2.paymentStatus === "pendiente" && after.paymentStatus === "pendiente", {
    viaGuia: { s1: s1.status, s2: s2.status, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus },
    viaSelector: { status: st.status, orderStatus: after2.orderStatus, paymentStatus: after2.paymentStatus, paymentConfirmedAt: after2.paymentConfirmedAt },
  });
});

test("B2 Wompi pendiente no puede prepararse ni enviarse", async () => {
  const before = await stockOf();
  const o = await createWompiOrder();
  await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: adminCookie, body: { carrier: "interrapidisimo", trackingNumber: "G-W" } });
  const st = await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "enviado" } });
  const after = await Order.findById(o._id);
  record("B2", after.orderStatus !== "enviado", {
    status: st.status, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus,
    stockDeducted: after.stockDeducted, stockBefore: before, stockAfter: await stockOf(),
  });
});

test("B3 vendedor no puede asignar estado financiero", async () => {
  const o = await createWompiOrder();
  const r = await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: vendorCookie, body: { orderStatus: "pagado" } });
  const after = await Order.findById(o._id);
  record("B3", r.status !== 200, { status: r.status, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus });
});

test("B4 Wompi manual y recaudo sobre cancelado se rechazan", async () => {
  const w = await createWompiOrder();
  const r1 = await api("PATCH", `/api/admin/orders/${w._id}/payment`, { cookie: vendorCookie, body: { note: "manual" } });
  const w2 = await Order.findById(w._id);
  const c = await createCE();
  await api("PATCH", `/api/admin/orders/${c._id}/status`, { cookie: adminCookie, body: { orderStatus: "cancelado" } });
  const sBefore = await stockOf();
  const r2 = await api("PATCH", `/api/admin/orders/${c._id}/payment`, { cookie: adminCookie, body: {} });
  const c2 = await Order.findById(c._id);
  record("B4", r1.status !== 200 && r2.status !== 200, {
    wompiManualByVendor: { status: r1.status, paymentStatus: w2.paymentStatus, orderStatus: w2.orderStatus },
    cancelledThenConfirmed: { status: r2.status, orderStatus: c2.orderStatus, paymentStatus: c2.paymentStatus, stockDeducted: c2.stockDeducted, stockBefore: sBefore, stockAfter: await stockOf() },
  });
});

test("B5 saltos operativos, reactivaciones y estados inventados se rechazan", async () => {
  const o = await createCE();
  const r1 = await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "entregado" } });
  const a1 = await Order.findById(o._id);
  const o2 = await createCE();
  const r2 = await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "rechazado" } });
  const r3 = await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "pendiente" } });
  const a2 = await Order.findById(o2._id);
  const r4 = await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "inventado" } });
  record("B5", r1.status !== 200, {
    pendienteAEntregado: { status: r1.status, orderStatus: a1.orderStatus, paymentStatus: a1.paymentStatus, stockDeducted: a1.stockDeducted },
    rechazadoYVuelta: { r2: r2.status, r3: r3.status, orderStatus: a2.orderStatus, stockDeducted: a2.stockDeducted },
    estadoInventado: { status: r4.status, msg: r4.json?.message?.slice(0, 120) },
  });
});

test("B6 guía de pedido cancelado no se puede editar", async () => {
  const o = await createCE();
  await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "cancelado" } });
  const r = await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: adminCookie, body: { carrier: "servientrega", trackingNumber: "X-9" } });
  record("B6", r.status !== 200, { status: r.status, tracking: (await Order.findById(o._id)).trackingNumber });
});

test("C1 Wompi rechazado y luego aprobado (reintento en el mismo enlace)", async () => {
  const o = await createWompiOrder();
  const s0 = await stockOf();
  const d = await postWompi(wompiEvent(tx(o, { status: "DECLINED" })));
  const mid = await Order.findById(o._id);
  const a = await postWompi(wompiEvent(tx(o)));
  const fin = await Order.findById(o._id);
  record("C1", fin.orderStatus === "pagado" && fin.paymentStatus === "pagado" && fin.stockDeducted, {
    declined: d, afterDecline: { orderStatus: mid.orderStatus, paymentStatus: mid.paymentStatus },
    approved: a, final: { orderStatus: fin.orderStatus, paymentStatus: fin.paymentStatus, stockDeducted: fin.stockDeducted },
    stockBefore: s0, stockAfter: await stockOf(),
  });
});

test("C2 Wompi aprobado sin stock disponible", async () => {
  const o = await createWompiOrder();
  const s = await stockOf();
  await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": 0 } });
  const i = mark();
  const code = await postWompi(wompiEvent(tx(o)));
  const after = await Order.findById(o._id);
  await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": s } });
  record("C2", after.paymentStatus === "pagado" && after.requiresReview && !after.stockDeducted && after.orderStatus === "pago_pendiente", {
    code, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus, wompiStatus: after.wompi?.status,
    lastHistory: after.statusHistory.at(-1)?.note, emailAttempts: linesSince(i).filter((l) => /correo|Nuevo pedido|Resend/i.test(l)),
  });
});

test("C3 dos eventos APPROVED simultáneos", async () => {
  const o = await createWompiOrder();
  const s0 = await stockOf();
  const ev = wompiEvent(tx(o));
  const codes = await Promise.all([postWompi(ev), postWompi(ev), postWompi(ev)]);
  const after = await Order.findById(o._id);
  const s1 = await stockOf();
  record("C3", s0 - s1 === 1, { codes, stockBefore: s0, stockAfter: s1, deducted: s0 - s1, paymentStatus: after.paymentStatus });
});

test("C4 cliente no cancela pedidos en preparación", async () => {
  const o = await createCE({}, clientCookie);
  await api("PATCH", `/api/admin/orders/${o._id}/payment`, { cookie: adminCookie, body: {} });
  await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  const i = mark();
  const r = await api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: clientCookie });
  const after = await Order.findById(o._id);
  record("C4", r.status !== 200, {
    status: r.status, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus,
    notifications: linesSince(i).filter((l) => /correo|pedido/i.test(l)),
  });
});

test("C5 notas internas nunca se exponen al comprador", async () => {
  const o = await createCE({}, clientCookie);
  await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion", note: "NOTA-INTERNA-cliente difícil" } });
  const r = await api("GET", `/api/checkout/orders/${o._id}`, { cookie: clientCookie });
  const leaked = JSON.stringify(r.json).includes("NOTA-INTERNA");
  record("C5", !leaked, { status: r.status, leaked });
});

test("D1 flujos operativos usan transportes ficticios sin red externa", async () => {
  const i0 = mark();
  const o = await createCE();
  const creation = linesSince(i0);
  const steps = {};
  for (const st of ["en_preparacion", "entregado"]) {
    const i = mark();
    if (st === "entregado") {
      await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: adminCookie, body: { carrier: "servientrega", trackingNumber: "G-D1" } });
      steps.enviado_por_guia = linesSince(i);
    }
    const j = mark();
    await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: st } });
    steps[st] = linesSince(j);
  }
  const o2 = await createCE();
  const k = mark();
  await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "cancelado" } });
  steps.cancelado = linesSince(k);
  const w = await createWompiOrder();
  const m = mark();
  await postWompi(wompiEvent(tx(w)));
  steps.wompi_aprobado = linesSince(m);
  const w2 = await createWompiOrder();
  const n = mark();
  await postWompi(wompiEvent(tx(w2, { status: "DECLINED" })));
  steps.wompi_rechazado = linesSince(n);
  const filt = (arr) => arr.filter((l) => /\[Dizor\]/.test(l));
  record("D1", blocked.length === 0, { creacion: filt(creation), ...Object.fromEntries(Object.entries(steps).map(([k2, v]) => [k2, filt(v)])) });
});

test("D2 sin proveedor no se registra acuse como enviado", async () => {
  const svc = req("services/orderReceiptService");
  svc.setReceiptTransport(null); // transporte real por omisión, sin RESEND_API_KEY
  const o = await createCE({ buyer: { name: "Sin Correo Real", email: "acuse@example.test", phone: "3000000002" } });
  svc.setReceiptTransport(async () => ({ devMode: false }));
  const after = await Order.findById(o._id);
  record("D2", !after.buyerReceipt?.sentAt, { sentAt: after.buyerReceipt?.sentAt, attempts: after.buyerReceipt?.attempts, lastError: after.buyerReceipt?.lastError });
});

test("E1 edición obsoleta conserva stock descontado por una venta", async () => {
  const formSnapshot = await api("GET", `/api/admin/catalog/products/${product._id}`, { cookie: adminCookie });
  const p = formSnapshot.json.product;
  const s0 = await stockOf();
  await createCE(); // venta mientras el formulario está abierto
  const s1 = await stockOf();
  const variants = p.variants.map((v) => ({
    id: v.id || v._id, size: v.size?._id || v.size?.id || v.size, color: v.color?._id || v.color?.id || v.color,
    sku: v.sku, stock: v.stock, price: v.price, isActive: v.isActive,
  }));
  const r = await api("PATCH", `/api/admin/catalog/products/${product._id}`, { cookie: adminCookie, body: { name: p.name, variants } });
  const s2 = await stockOf();
  record("E1", r.status === 200 && s2 === s1, { status: r.status, msg: r.json?.message, stockAlAbrirForm: s0, trasVenta: s1, trasGuardar: s2 });
});

test("E2 cantidad fraccionaria se rechaza", async () => {
  const s0 = await stockOf();
  const r = await api("POST", "/api/checkout/orders", { body: orderBody({ items: [{ productId: String(product._id), variantId: String(variantId), quantity: 1.5 }] }) });
  const s1 = await stockOf();
  record("E2", r.status !== 201, { status: r.status, stockBefore: s0, stockAfter: s1, total: r.json?.order?.total });
});

test("E3 agotamiento de variante aparece en alertas", async () => {
  const [cat] = await Category.find().limit(1);
  const [size] = await Size.find().limit(1);
  const c2 = await Color.create({ name: "Negro" });
  await Product.create({
    name: "Bolso Variante Agotada", category: cat._id, salePrice: 50000,
    mainImage: "https://example.test/b.jpg", images: [{ url: "https://example.test/b.jpg" }],
    variants: [
      { size: size._id, color: c2._id, sku: "AUD-B1", stock: 40, isActive: true },
      { size: size._id, color: (await Color.findOne({ name: "Natural" }))._id, sku: "AUD-B2", stock: 0, isActive: true },
    ],
  });
  const al = await api("GET", "/api/admin/alerts", { cookie: adminCookie });
  const names = [...al.json.alerts.lowStock.items, ...al.json.alerts.outOfStock.items].map((x) => x.name);
  record("E3", names.includes("Bolso Variante Agotada"), { flagged: names.includes("Bolso Variante Agotada") });
});

test("F1 contraentrega aparece por preparar y no como pago Wompi pendiente", async () => {
  const before = (await api("GET", "/api/admin/dashboard", { cookie: adminCookie })).json.dashboard.orders;
  await createCE();
  const after = (await api("GET", "/api/admin/dashboard", { cookie: adminCookie })).json.dashboard.orders;
  const al = (await api("GET", "/api/admin/alerts", { cookie: adminCookie })).json.alerts;
  record("F1", after.toPrepare - before.toPrepare === 1 && after.pendingPayment === before.pendingPayment, {
    pendingPaymentDelta: after.pendingPayment - before.pendingPayment,
    toPrepareDelta: after.toPrepare - before.toPrepare,
    alertasPagosPendientes: al.pendingPayments.count,
    alertasPedidosNuevos: al.newOrders.count,
  });
});

test("G1 vendedor no recibe costos internos", async () => {
  const o = await createCE();
  const r = await api("GET", `/api/admin/orders/${o._id}`, { cookie: vendorCookie });
  const unitCost = r.json?.order?.items?.[0]?.unitCost;
  record("G1", unitCost == null, { status: r.status, unitCostVisibleToVendor: unitCost });
});

test("G2 búsqueda con caracteres especiales", async () => {
  const r = await api("GET", `/api/admin/orders?q=${encodeURIComponent("(")}`, { cookie: adminCookie });
  record("G2", r.status === 200, { status: r.status, msg: r.json?.message?.slice(0, 120) });
});

test("G3 solo se asigna personal activo", async () => {
  const o = await createCE();
  const cliente = await User.findOne({ role: "cliente" });
  const r = await api("PATCH", `/api/admin/orders/${o._id}/assign`, { cookie: adminCookie, body: { assignedTo: String(cliente._id) } });
  record("G3", r.status !== 200, { status: r.status });
});

const setStatus = (o, status, cookie = adminCookie) => api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie, body: { orderStatus: status } });
const deliveredCE = async () => {
  const o = await createCE();
  assert.equal((await setStatus(o, "en_preparacion", vendorCookie)).status, 200);
  const shipping = await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: vendorCookie, body: { carrier: "servientrega", trackingNumber: "FICTICIA" } });
  assert.equal(shipping.status, 200, shipping.text);
  assert.equal((await setStatus(o, "entregado", vendorCookie)).status, 200);
  return Order.findById(o._id);
};
const collectionBody = () => ({ reference: "GIRO-FICTICIO", receivedAt: new Date(Date.now() - 1000).toISOString(), paymentProofUrl: "https://example.test/comprobante" });
const collect = (o, body = collectionBody(), cookie = adminCookie) => api("PATCH", `/api/admin/orders/${o._id}/payment`, { body, cookie });
const adjust = (body, cookie = adminCookie) => api("POST", `/api/admin/catalog/products/${product._id}/stock`, { cookie, body });
const ownedWompi = async () => {
  const o = await createWompiOrder();
  await Order.updateOne({ _id: o._id }, { $set: { user: (await User.findOne({ role: "cliente" }))._id, isGuest: false } });
  return Order.findById(o._id);
};

test("P01 entrega contraentrega conserva pago pendiente y evidencia de entrega", async () => {
  const o = await deliveredCE();
  assert.equal(o.paymentStatus, "pendiente");
  assert.ok(o.deliveredAt && o.deliveredBy);
  assert.equal(o.paymentConfirmedAt, null);
  assert.equal(o.collection?.reference, undefined);
  assert.equal((await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: adminCookie, body: { trackingNumber: "NO" } })).status, 409);
});

test("P02 recaudo explícito por admin, repetido y concurrente se registra una vez", async () => {
  const o = await deliveredCE(), stock = await stockOf();
  const evidence = collectionBody();
  const rs = await Promise.all(Array.from({ length: 3 }, () => collect(o, evidence)));
  assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs));
  const after = await Order.findById(o._id);
  assert.equal(after.orderStatus, "entregado");
  assert.equal(after.paymentStatus, "pagado");
  assert.equal(after.collection.reference, evidence.reference);
  assert.ok(after.collection.recordedBy && after.collection.receivedAt && after.collection.recordedAt);
  assert.equal(after.statusHistory.filter((h) => h.note.startsWith("Recaudo confirmado")).length, 1);
  assert.equal(await stockOf(), stock);
});

test("P03 vendedor no recauda; evidencia incompleta y fecha futura se rechazan", async () => {
  const o = await deliveredCE();
  assert.equal((await collect(o, collectionBody(), vendorCookie)).status, 403);
  for (const body of [{}, { reference: 123, receivedAt: "2026-01-01" }, { reference: "x", receivedAt: "2099-01-01" }]) {
    assert.equal((await collect(o, body)).status, 400);
  }
  assert.equal((await Order.findById(o._id)).paymentStatus, "pendiente");
});

test("P04 ni admin confirma Wompi manualmente; pago aprobado deja una venta", async () => {
  const o = await createWompiOrder(), before = await stockOf();
  assert.equal((await collect(o)).status, 409);
  const ev = wompiEvent(tx(o));
  assert.equal(await postWompi(ev), 200);
  const paid = await Order.findById(o._id);
  assert.equal(paid.paymentStatus, "pagado"); assert.equal(paid.orderStatus, "pagado");
  assert.ok(paid.stockDeducted && paid.paymentConfirmedAt); assert.equal(paid.requiresReview, false);
  const historyLength = paid.statusHistory.length;
  assert.equal(await postWompi(ev), 200);
  assert.equal(await postWompi(ev), 200);
  assert.equal(await stockOf(), before - 1);
  assert.equal((await Order.findById(o._id)).statusHistory.length, historyLength);
  assert.equal(await req("models/productHistory").countDocuments({ referenceId: o._id, eventType: "sale" }), 1);
});

test("P05 aprobación después de cancelar reconoce dinero, conserva cancelación y alerta", async () => {
  const o = await createWompiOrder(), stock = await stockOf();
  assert.equal((await setStatus(o, "cancelado")).status, 200);
  assert.equal(await postWompi(wompiEvent(tx(o))), 200);
  const after = await Order.findById(o._id);
  assert.equal(after.orderStatus, "cancelado"); assert.equal(after.paymentStatus, "pagado");
  assert.equal(after.stockDeducted, false); assert.equal(after.requiresReview, true);
  assert.ok(after.incidents.some((i) => i.code === "approved_after_cancellation"));
  assert.equal(await stockOf(), stock);
  assert.equal((await setStatus(o, "en_preparacion")).status, 409);
  const alerts = await api("GET", "/api/admin/alerts", { cookie: adminCookie });
  assert.ok(alerts.json.alerts.pendingPayments.items.some((i) => i.orderNumber === o.orderNumber));
});

test("P06 diferencias de monto y moneda conservan el hecho financiero y bloquean preparación", async () => {
  for (const extra of [{ amount_in_cents: 12345 }, { currency: "USD" }]) {
    const o = await createWompiOrder(), before = await stockOf(), transaction = tx(o, extra);
    assert.equal(await postWompi(wompiEvent(transaction)), 200);
    const after = await Order.findById(o._id);
    assert.equal(after.paymentStatus, "pagado"); assert.equal(after.requiresReview, true);
    assert.equal(after.orderStatus, "pago_pendiente"); assert.equal(after.stockDeducted, false);
    assert.equal(await stockOf(), before);
    const receipt = await req("models/paymentEvent").findOne({ order: o._id });
    assert.equal(receipt.amountInCents, transaction.amount_in_cents); assert.equal(receipt.currency, transaction.currency);
    assert.equal((await setStatus(o, "en_preparacion")).status, 409);
  }
});

test("P07 fallo tras recibir pago conserva evidencia; reintento aplica stock una sola vez", async () => {
  const o = await createWompiOrder(), before = await stockOf(), event = wompiEvent(tx(o));
  const History = req("models/productHistory"), original = History.create;
  History.create = async () => { throw new Error("FALLO FICTICIO DE ALMACENAMIENTO"); };
  try { assert.equal(await postWompi(event), 500); } finally { History.create = original; }
  let after = await Order.findById(o._id);
  assert.equal(after.paymentStatus, "pagado"); assert.equal(after.requiresReview, true);
  assert.equal(after.stockDeducted, false); assert.equal(await stockOf(), before);
  assert.ok((await req("models/paymentEvent").findOne({ order: o._id })).lastError);
  assert.equal(await postWompi(event), 200);
  after = await Order.findById(o._id);
  assert.equal(after.stockDeducted, true); assert.equal(after.requiresReview, false);
  assert.equal(await stockOf(), before - 1);
  assert.equal(await postWompi(event), 200); assert.equal(await stockOf(), before - 1);
});

test("P08 autocancelación contraentrega antes de preparación repone una sola vez", async () => {
  const before = await stockOf(), o = await createCE({}, clientCookie);
  const rs = await Promise.all(Array.from({ length: 3 }, () => api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: clientCookie })));
  assert.ok(rs.some((r) => r.status === 200));
  assert.ok(rs.every((r) => [200, 409].includes(r.status)));
  const after = await Order.findById(o._id);
  assert.equal(after.orderStatus, "cancelado"); assert.equal(after.paymentStatus, "pendiente");
  assert.equal(after.stockDeducted, false); assert.equal(await stockOf(), before);
  assert.equal(after.statusHistory.filter((h) => h.status === "cancelado").length, 1);
});

test("P09 autocancelación en preparación y Wompi pagado se rechazan", async () => {
  const ce = await createCE({}, clientCookie);
  assert.equal((await setStatus(ce, "en_preparacion")).status, 200);
  assert.equal((await api("PATCH", `/api/checkout/orders/${ce._id}/cancel`, { cookie: clientCookie })).status, 409);
  const w = await ownedWompi();
  assert.equal(await postWompi(wompiEvent(tx(w))), 200);
  assert.equal((await api("PATCH", `/api/checkout/orders/${w._id}/cancel`, { cookie: clientCookie })).status, 409);
});

test("P10 Wompi sin transacción verificable conserva pedido e incidencia", async () => {
  const o = await ownedWompi();
  assert.equal((await api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: clientCookie })).status, 409);
  const after = await Order.findById(o._id);
  assert.equal(after.orderStatus, "pago_pendiente"); assert.equal(after.requiresReview, true);
});

test("P11 contraentrega pagado cancelado administrativamente conserva dinero sin reembolso", async () => {
  const o = await deliveredCE(); assert.equal((await collect(o)).status, 200);
  assert.equal((await setStatus(o, "devuelto")).status, 200);
  const after = await Order.findById(o._id);
  assert.equal(after.paymentStatus, "pagado"); assert.equal(after.requiresReview, true);
  assert.equal(after.stockDeducted, false); assert.ok(after.collection.reference);
  const stock = await stockOf(); assert.equal((await setStatus(o, "devuelto")).status, 200);
  assert.equal(await stockOf(), stock);
});

test("P12 ajustes de stock enteros y concurrentes tienen motivo y no se duplican", async () => {
  const before = await stockOf(), body = { variantId: String(variantId), delta: 4, reason: "Reposición ficticia", operationKey: crypto.randomUUID() };
  const rs = await Promise.all(Array.from({ length: 3 }, () => adjust(body)));
  assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs));
  assert.equal(await stockOf(), before + 4);
  assert.equal(await req("models/productHistory").countDocuments({ movementKey: body.operationKey }), 1);
  assert.equal((await adjust({ ...body, delta: 9 })).status, 409);
  assert.equal((await adjust({ ...body, operationKey: crypto.randomUUID(), delta: 1.5 })).status, 400);
  assert.equal((await adjust({ ...body, operationKey: crypto.randomUUID(), delta: -100000 })).status, 409);
  assert.equal((await adjust({ ...body, operationKey: crypto.randomUUID() }, vendorCookie)).status, 403);
});

test("P13 formulario obsoleto guardado en paralelo a venta y ajuste conserva stock", async () => {
  const snapshot = (await api("GET", `/api/admin/catalog/products/${product._id}`, { cookie: adminCookie })).json.product;
  const before = await stockOf();
  const body = { name: snapshot.name, variants: snapshot.variants };
  const rs = await Promise.all([
    api("PATCH", `/api/admin/catalog/products/${product._id}`, { cookie: adminCookie, body }),
    createCE(),
    adjust({ variantId: String(variantId), delta: 2, reason: "Conteo ficticio", operationKey: crypto.randomUUID() }),
  ]);
  assert.equal(rs[0].status, 200, rs[0].text); assert.equal(rs[2].status, 200, rs[2].text);
  assert.equal(await stockOf(), before + 1);
});

test("P14 idempotencia checkout secuencial y concurrente, y conflicto de contenido", async () => {
  const body = orderBody(), before = await stockOf();
  const rs = await Promise.all(Array.from({ length: 3 }, () => api("POST", "/api/checkout/orders", { body })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs));
  assert.ok(rs.every((r) => [200, 201, 409].includes(r.status)));
  const again = await api("POST", "/api/checkout/orders", { body });
  assert.equal(again.status, 200); assert.ok(again.json.accessToken);
  assert.equal(await stockOf(), before - 1);
  assert.equal(await Order.countDocuments({ idempotencyKey: body.idempotencyKey }), 1);
  const changed = await api("POST", "/api/checkout/orders", { body: { ...body, customerNotes: "Otra compra" } });
  assert.equal(changed.status, 409); assert.equal(changed.json.accessToken, undefined);
});

test("P15 claves malformadas y cantidades fraccionarias se rechazan sin datos internos", async () => {
  for (const idempotencyKey of [123, {}, "corta"]) {
    const r = await api("POST", "/api/checkout/orders", { body: orderBody({ idempotencyKey }) });
    assert.equal(r.status, 400); assert.doesNotMatch(r.text, /E11000|MongoServer|stack|keyValue/);
  }
  for (const quantity of [0, -1, 1.2, "2", Number.MAX_SAFE_INTEGER + 1]) {
    const r = await api("POST", "/api/checkout/orders", { body: orderBody({ items: [{ productId: String(product._id), variantId: String(variantId), quantity }] }) });
    assert.equal(r.status, 400);
  }
});

test("P16 pedido histórico conserva número, estado, costos y evidencia sin inferir entrega", async () => {
  const o = await createCE();
  await Order.collection.updateOne({ _id: o._id }, { $set: { orderNumber: "DIZ-20200101-0001", orderStatus: "pagado", paymentStatus: "pagado" }, $unset: { deliveredAt: "", deliveredBy: "", collection: "", incidents: "", requiresReview: "" } });
  const admin = await api("GET", `/api/admin/orders/${o._id}`, { cookie: adminCookie });
  assert.equal(admin.status, 200); assert.equal(admin.json.order.orderNumber, "DIZ-20200101-0001");
  assert.equal(admin.json.order.items[0].unitCost, 40000); assert.equal(admin.json.order.deliveredAt, null);
  assert.equal((await setStatus(o, "en_preparacion")).status, 200);
  const after = await Order.findById(o._id);
  assert.equal(after.orderNumber, "DIZ-20200101-0001"); assert.equal(after.paymentStatus, "pagado");
});

test("P17 números simultáneos únicos usan fecha Colombia; índices sin duplicado de orderNumber", async () => {
  const { generateOrderNumber } = req("services/orderService");
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "");
  const numbers = await Promise.all(Array.from({ length: 1000 }, () => generateOrderNumber()));
  assert.equal(new Set(numbers).size, numbers.length);
  assert.ok(numbers.every((n) => n.startsWith(`DIZ-${date}-`) && n.length <= 36));
  assert.equal(Order.schema.indexes().filter(([key]) => key.orderNumber).length, 1);
  const index = (await Order.collection.indexes()).find((i) => i.key.idempotencyKey);
  assert.deepEqual(index.partialFilterExpression, { idempotencyKey: { $type: "string" } });
});

test("P18 expiración viene del proveedor; nunca se calcula desde createdAt", async () => {
  const { parseProviderExpiry } = req("services/wompiService");
  assert.equal(parseProviderExpiry(null), null); assert.equal(parseProviderExpiry("inválida"), null);
  assert.equal(parseProviderExpiry("2030-12-10T14:30:00").toISOString(), "2030-12-10T14:30:00.000Z");
  assert.equal(parseProviderExpiry("2030-12-10T09:30:00-05:00").toISOString(), "2030-12-10T14:30:00.000Z");
  const o = await createWompiOrder();
  await Order.updateOne({ _id: o._id }, { $set: { createdAt: new Date("2000-01-01") } }, { timestamps: false });
  assert.equal((await Order.findById(o._id)).orderStatus, "pago_pendiente");
});

test("P19 checksum inválido, entorno incorrecto y evento sin referencia no alteran pedidos", async () => {
  const o = await createWompiOrder(), before = await stockOf();
  const event = wompiEvent(tx(o));
  assert.equal(await postWompi({ ...event, checksum: "NO" }), 401);
  assert.equal(await postWompi({ ...event, body: { ...event.body, environment: "prod" } }), 200);
  assert.equal(await postWompi(wompiEvent(tx(o, { reference: "", sku: "", payment_link_id: undefined }))), 200);
  assert.equal((await Order.findById(o._id)).paymentStatus, "pendiente"); assert.equal(await stockOf(), before);
});

test("P20 evento rechazado posterior no degrada aprobado y pago adicional genera incidencia", async () => {
  const o = await createWompiOrder(), t = tx(o), before = await stockOf();
  assert.equal(await postWompi(wompiEvent(t)), 200);
  assert.equal(await postWompi(wompiEvent({ ...t, status: "DECLINED" })), 200);
  assert.equal((await Order.findById(o._id)).paymentStatus, "pagado");
  assert.equal(await postWompi(wompiEvent(tx(o))), 200);
  const after = await Order.findById(o._id);
  assert.equal(after.requiresReview, true); assert.ok(after.incidents.some((i) => i.code === "additional_approved_payment"));
  assert.equal(await stockOf(), before - 1);
});

test("P21 fallo de checkout revierte pedido, stock y movimientos; no filtra error de BD", async () => {
  const History = req("models/productHistory"), original = History.create;
  const body = orderBody(), before = await stockOf();
  History.create = async () => { throw new Error("MongoServerError E11000 secreto-ficticio"); };
  const originalEnv = process.env.NODE_ENV; process.env.NODE_ENV = "development";
  try {
    const r = await api("POST", "/api/checkout/orders", { body });
    assert.equal(r.status, 503); assert.doesNotMatch(r.text, /Mongo|E11000|secreto|stack/);
  } finally { History.create = original; process.env.NODE_ENV = originalEnv; }
  assert.equal(await stockOf(), before); assert.equal(await Order.countDocuments({ idempotencyKey: body.idempotencyKey }), 0);
  assert.equal((await api("POST", "/api/checkout/orders", { body })).status, 201);
});

test("P22 consulta proveedor antes de cancelar descubre aprobación aún no local", async () => {
  const o = await ownedWompi(), transaction = tx(o), before = await stockOf();
  await Order.updateOne({ _id: o._id }, { $set: { "wompi.transactionId": transaction.id } });
  const url = `https://sandbox.wompi.co/v1/transactions/${transaction.id}`;
  providerResponses.set(url, { body: { data: transaction } });
  try {
    const r = await api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: clientCookie });
    assert.equal(r.status, 409, r.text);
  } finally { providerResponses.delete(url); }
  const after = await Order.findById(o._id);
  assert.equal(after.paymentStatus, "pagado"); assert.equal(after.orderStatus, "pagado");
  assert.equal(await stockOf(), before - 1);
});

test("P23 Wompi pendiente consultado permite cancelar y aprobación tardía queda visible", async () => {
  const o = await ownedWompi(), transaction = tx(o), before = await stockOf();
  await Order.updateOne({ _id: o._id }, { $set: { "wompi.transactionId": transaction.id } });
  const url = `https://sandbox.wompi.co/v1/transactions/${transaction.id}`;
  providerResponses.set(url, { body: { data: { ...transaction, status: "PENDING" } } });
  try {
    const r = await api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: clientCookie });
    assert.equal(r.status, 200, r.text);
  } finally { providerResponses.delete(url); }
  assert.equal(await postWompi(wompiEvent(transaction)), 200);
  const after = await Order.findById(o._id);
  assert.equal(after.orderStatus, "cancelado"); assert.equal(after.paymentStatus, "pagado");
  assert.equal(after.requiresReview, true); assert.equal(await stockOf(), before);
});

test("P24 fallo al consultar proveedor impide autocancelación sin perder pedido", async () => {
  const o = await ownedWompi(), transaction = tx(o);
  await Order.updateOne({ _id: o._id }, { $set: { "wompi.transactionId": transaction.id } });
  const url = `https://sandbox.wompi.co/v1/transactions/${transaction.id}`;
  providerResponses.set(url, { status: 503, body: {} });
  try {
    const r = await api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: clientCookie });
    assert.equal(r.status, 503);
  } finally { providerResponses.delete(url); }
  assert.equal((await Order.findById(o._id)).orderStatus, "pago_pendiente");
});

test("P25 conciliación consulta Wompi y recupera pago sin stock una vez repuesto", async () => {
  const o = await createWompiOrder(), before = await stockOf(), transaction = tx(o);
  await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": 0 } });
  assert.equal(await postWompi(wompiEvent(transaction)), 200);
  await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": before } });
  const url = `https://sandbox.wompi.co/v1/transactions/${transaction.id}`;
  providerResponses.set(url, { body: { data: transaction } });
  try {
    assert.equal((await api("POST", `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie: vendorCookie })).status, 403);
    assert.equal((await api("POST", `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie: adminCookie })).status, 200);
    assert.equal((await api("POST", `/api/admin/orders/${o._id}/reconcile-wompi`, { cookie: adminCookie })).status, 200);
  } finally { providerResponses.delete(url); }
  const after = await Order.findById(o._id);
  assert.equal(after.requiresReview, false); assert.equal(after.stockDeducted, true); assert.equal(after.orderStatus, "pagado");
  assert.equal(await stockOf(), before - 1);
});

test("P26 API enlace ficticio conserva expires_at y retry checkout reutiliza enlace", async () => {
  const url = "https://sandbox.wompi.co/v1/payment_links";
  providerResponses.set(url, { body: { data: { id: "LINK-FICTICIO", expires_at: "2030-12-10T14:30:00" } } });
  const body = orderBody({ paymentMethod: "wompi" });
  try {
    const r = await api("POST", "/api/checkout/orders", { body });
    assert.equal(r.status, 201, r.text);
    const o = await Order.findById(r.json.order.id);
    assert.equal(o.wompi.expiresAt.toISOString(), "2030-12-10T14:30:00.000Z");
    assert.equal(o.stockDeducted, false);
    const retry = await api("POST", "/api/checkout/orders", { body });
    assert.equal(retry.status, 200); assert.equal(retry.json.paymentUrl, r.json.paymentUrl);
  } finally { providerResponses.delete(url); }
});

test("P27 fallo creando enlace conserva orden para conciliación y no expone error proveedor", async () => {
  const url = "https://sandbox.wompi.co/v1/payment_links";
  providerResponses.set(url, { status: 502, body: { error: { message: "secreto-ficticio" } } });
  const body = orderBody({ paymentMethod: "wompi" }), before = await stockOf();
  try {
    const r = await api("POST", "/api/checkout/orders", { body });
    assert.equal(r.status, 502); assert.doesNotMatch(r.text, /secreto|E11000|Mongo/);
    const o = await Order.findOne({ idempotencyKey: body.idempotencyKey });
    assert.ok(o); assert.equal(o.checkoutState, "failed"); assert.equal(o.requiresReview, true);
    assert.equal((await api("POST", "/api/checkout/orders", { body })).status, 409);
    assert.equal(await Order.countDocuments({ idempotencyKey: body.idempotencyKey }), 1);
    assert.equal(await stockOf(), before);
  } finally { providerResponses.delete(url); }
});

test("P28 dos pedidos compiten por la última unidad y no hay sobreventa", async () => {
  const before = await stockOf();
  await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": 1 } });
  try {
    const rs = await Promise.all([orderBody(), orderBody()].map((body) => api("POST", "/api/checkout/orders", { body })));
    assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs));
    assert.ok(rs.every((r) => [201, 400, 409].includes(r.status)), JSON.stringify(rs));
    assert.equal(await stockOf(), 0);
  } finally { await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": before } }); }
});

test("P29 líneas repetidas no permiten descuento parcial al agotarse stock", async () => {
  const before = await stockOf(), body = orderBody(); body.items.push({ ...body.items[0] });
  await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": 1 } });
  try {
    const r = await api("POST", "/api/checkout/orders", { body });
    assert.equal(r.status, 409, r.text); assert.equal(await stockOf(), 1);
    assert.equal(await Order.countDocuments({ idempotencyKey: body.idempotencyKey }), 0);
  } finally { await Product.updateOne({ _id: product._id, "variants._id": variantId }, { $set: { "variants.$.stock": before } }); }
});

test("P30 cancelación administrativa concurrente de pedido pagado repone stock una vez", async () => {
  const o = await createWompiOrder(), before = await stockOf();
  assert.equal(await postWompi(wompiEvent(tx(o))), 200);
  const rs = await Promise.all(Array.from({ length: 3 }, () => setStatus(o, "cancelado")));
  assert.ok(rs.every((r) => r.status === 200)); assert.equal(await stockOf(), before);
  const after = await Order.findById(o._id);
  assert.equal(after.paymentStatus, "pagado"); assert.ok(after.requiresReview);
  assert.equal(after.statusHistory.filter((h) => h.status === "cancelado").length, 1);
});

test("P31 un reembolso histórico no se borra por una aprobación tardía", async () => {
  const o = await createWompiOrder(), before = await stockOf();
  await Order.updateOne({ _id: o._id }, { $set: { orderStatus: "cancelado", paymentStatus: "reembolsado" } });
  assert.equal(await postWompi(wompiEvent(tx(o))), 200);
  const after = await Order.findById(o._id);
  assert.equal(after.paymentStatus, "reembolsado"); assert.equal(after.orderStatus, "cancelado");
  assert.equal(after.requiresReview, true); assert.equal(await stockOf(), before);
  assert.equal(await req("models/paymentEvent").countDocuments({ order: o._id, status: "APPROVED" }), 1);
});

test("P32 ventas conciliadas excluyen cobros con incidencia y cancelaciones sin borrar evidencia", async () => {
  const { buildFinanceReport } = req("services/financeService");
  const before = await buildFinanceReport({ range: "all" });
  const o = await createWompiOrder();
  assert.equal(await postWompi(wompiEvent(tx(o, { amount_in_cents: 100 }))), 200);
  const disputed = await buildFinanceReport({ range: "all" });
  assert.equal(disputed.sales.totalCollected, before.sales.totalCollected);
  const paid = await createWompiOrder(); assert.equal(await postWompi(wompiEvent(tx(paid))), 200);
  const withSale = await buildFinanceReport({ range: "all" });
  assert.equal(withSale.sales.totalCollected, before.sales.totalCollected + paid.total);
  assert.equal((await setStatus(paid, "cancelado")).status, 200);
  const cancelled = await buildFinanceReport({ range: "all" });
  assert.equal(cancelled.sales.totalCollected, before.sales.totalCollected);
  assert.equal((await Order.findById(paid._id)).paymentStatus, "pagado");
});

test("P33 fallo posterior a crear pedido conserva idempotencia y genera incidencia visible", async () => {
  const Cart = req("models/cart"), original = Cart.findOneAndUpdate, body = orderBody();
  Cart.findOneAndUpdate = async () => { throw new Error("Fallo ficticio al limpiar carrito"); };
  try {
    const r = await api("POST", "/api/checkout/orders", { cookie: clientCookie, body });
    assert.equal(r.status, 500); assert.doesNotMatch(r.text, /Fallo ficticio|stack/);
  } finally { Cart.findOneAndUpdate = original; }
  const order = await Order.findOne({ idempotencyKey: body.idempotencyKey });
  assert.ok(order); assert.equal(order.checkoutState, "failed"); assert.equal(order.requiresReview, true);
  assert.ok(order.incidents.some((i) => i.code === "checkout_completion_failed"));
  assert.equal((await api("POST", "/api/checkout/orders", { cookie: clientCookie, body })).status, 409);
  assert.equal(await Order.countDocuments({ idempotencyKey: body.idempotencyKey }), 1);
});

test("P34 último uso de cupón concurrente no deja pedidos ni descuentos huérfanos", async () => {
  const coupon = await Coupon.create({ code: "FASE1-FICTICIO", type: "fixed", value: 1000, maxUses: 1, usedCount: 0 });
  const before = await stockOf();
  const rs = await Promise.all(Array.from({ length: 2 }, () => api("POST", "/api/checkout/orders", { body: orderBody({ couponCode: coupon.code }) })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs));
  assert.ok(rs.every((r) => [201, 400, 409].includes(r.status)));
  assert.equal(await Order.countDocuments({ couponCode: coupon.code }), 1);
  assert.equal(await stockOf(), before - 1);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
});

test("P35 tres aprobaciones concurrentes consumen cupón Wompi una vez", async () => {
  const coupon = await Coupon.create({ code: "FASE1-WOMPI", type: "fixed", value: 1000, maxUses: 10, usedCount: 0 });
  const o = await createWompiOrder();
  await Order.updateOne({ _id: o._id }, { $set: { couponCode: coupon.code } });
  const event = wompiEvent(tx(o)), before = await stockOf();
  const codes = await Promise.all(Array.from({ length: 3 }, () => postWompi(event)));
  assert.deepEqual(codes, [200, 200, 200]);
  assert.equal((await Coupon.findById(coupon._id)).usedCount, 1);
  assert.equal((await Order.findById(o._id)).couponConsumed, true); assert.equal(await stockOf(), before - 1);
});
