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

const BACKEND = process.env.DIZOR_BACKEND_DIR;
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
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url);
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

const { MongoMemoryServer } = require(path.join(MMS, "node_modules", "mongodb-memory-server"));
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
const req = (p) => require(path.join(BACKEND, "src", p));

let mongod, server, base, app;
let Order, Product, User, Coupon, Category, Size, Color;
let product, variantId, adminCookie, vendorCookie, clientCookie;

const results = [];
const record = (id, ok, detail) => results.push({ id, ok, detail });

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
  mongod = await MongoMemoryServer.create();
  assert.match(mongod.getUri(), /127\.0\.0\.1/);
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
  record("A0", !initError, { initError, indexesCreated: idx });
  req("services/orderReceiptService").setReceiptTransport(async () => ({ devMode: true }));

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

test("B1 contraentrega: marcar enviado → pago se marca pagado", async () => {
  const o = await createCE();
  const s1 = await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  const s2 = await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: adminCookie, body: { carrier: "servientrega", trackingNumber: "GUIA-1" } });
  const after = await Order.findById(o._id);
  // Mismo pedido por la otra vía (selector de estado "enviado").
  const o2 = await createCE();
  await api("PATCH", `/api/admin/orders/${o2._id}/shipping`, { cookie: adminCookie, body: { carrier: "servientrega", trackingNumber: "GUIA-2" } });
  const st = await api("PATCH", `/api/admin/orders/${o2._id}/status`, { cookie: adminCookie, body: { orderStatus: "enviado" } });
  const after2 = await Order.findById(o2._id);
  record("B1", after2.paymentStatus !== "pagado", {
    viaGuia: { s1: s1.status, s2: s2.status, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus },
    viaSelector: { status: st.status, orderStatus: after2.orderStatus, paymentStatus: after2.paymentStatus, paymentConfirmedAt: after2.paymentConfirmedAt },
  });
});

test("B2 Wompi sin pago: admin lo lleva a enviado sin confirmación del proveedor", async () => {
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

test("B3 vendedor asigna estado 'pagado' sin confirmar pago", async () => {
  const o = await createWompiOrder();
  const r = await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: vendorCookie, body: { orderStatus: "pagado" } });
  const after = await Order.findById(o._id);
  record("B3", r.status !== 200, { status: r.status, orderStatus: after.orderStatus, paymentStatus: after.paymentStatus });
});

test("B4 confirmar pago manual de un pedido Wompi y de un pedido cancelado", async () => {
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

test("B5 transiciones sin máquina de estados", async () => {
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

test("B6 guía editable en pedido cancelado / entregado", async () => {
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
  record("C1", !(fin.orderStatus === "cancelado" && fin.paymentStatus === "pagado"), {
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
  record("C2", after.paymentStatus === "pagado", {
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

test("C4 cliente cancela un pedido ya pagado", async () => {
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

test("C5 nota interna visible para el cliente vía API", async () => {
  const o = await createCE({}, clientCookie);
  await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion", note: "NOTA-INTERNA-cliente difícil" } });
  const r = await api("GET", `/api/checkout/orders/${o._id}`, { cookie: clientCookie });
  const leaked = JSON.stringify(r.json).includes("NOTA-INTERNA");
  record("C5", !leaked, { status: r.status, leaked });
});

test("D1 correos por evento (sin clave: se registran intentos en consola)", async () => {
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
  record("D1", null, { creacion: filt(creation), ...Object.fromEntries(Object.entries(steps).map(([k2, v]) => [k2, filt(v)])) });
});

test("D2 acuse marcado como enviado aunque no haya proveedor", async () => {
  const svc = req("services/orderReceiptService");
  svc.setReceiptTransport(null); // transporte real por omisión, sin RESEND_API_KEY
  const o = await createCE({ buyer: { name: "Sin Correo Real", email: "acuse@example.test", phone: "3000000002" } });
  svc.setReceiptTransport(async () => ({ devMode: true }));
  const after = await Order.findById(o._id);
  record("D2", !after.buyerReceipt?.sentAt, { sentAt: after.buyerReceipt?.sentAt, attempts: after.buyerReceipt?.attempts, lastError: after.buyerReceipt?.lastError });
});

test("E1 edición de producto pisa el stock descontado por una venta", async () => {
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
  record("E1", s2 === s1, { status: r.status, msg: r.json?.message, stockAlAbrirForm: s0, trasVenta: s1, trasGuardar: s2 });
});

test("E2 cantidad fraccionaria en el carrito", async () => {
  const s0 = await stockOf();
  const r = await api("POST", "/api/checkout/orders", { body: orderBody({ items: [{ productId: String(product._id), variantId: String(variantId), quantity: 1.5 }] }) });
  const s1 = await stockOf();
  record("E2", r.status !== 201, { status: r.status, stockBefore: s0, stockAfter: s1, total: r.json?.order?.total });
});

test("E3 umbral de stock bajo agregado por producto (no por variante)", async () => {
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

test("F1 dashboard/alertas: contraentrega nuevo cuenta como 'pago por confirmar' y no 'por preparar'", async () => {
  const before = (await api("GET", "/api/admin/dashboard", { cookie: adminCookie })).json.dashboard.orders;
  await createCE();
  const after = (await api("GET", "/api/admin/dashboard", { cookie: adminCookie })).json.dashboard.orders;
  const al = (await api("GET", "/api/admin/alerts", { cookie: adminCookie })).json.alerts;
  record("F1", null, {
    pendingPaymentDelta: after.pendingPayment - before.pendingPayment,
    toPrepareDelta: after.toPrepare - before.toPrepare,
    alertasPagosPendientes: al.pendingPayments.count,
    alertasPedidosNuevos: al.newOrders.count,
  });
});

test("G1 vendedor ve costo interno en el detalle de pedido", async () => {
  const o = await createCE();
  const r = await api("GET", `/api/admin/orders/${o._id}`, { cookie: vendorCookie });
  const unitCost = r.json?.order?.items?.[0]?.unitCost;
  record("G1", unitCost == null, { status: r.status, unitCostVisibleToVendor: unitCost });
});

test("G2 búsqueda con caracteres especiales", async () => {
  const r = await api("GET", `/api/admin/orders?q=${encodeURIComponent("(")}`, { cookie: adminCookie });
  record("G2", r.status === 200, { status: r.status, msg: r.json?.message?.slice(0, 120) });
});

test("G3 asignar pedido a un id que no es de personal", async () => {
  const o = await createCE();
  const cliente = await User.findOne({ role: "cliente" });
  const r = await api("PATCH", `/api/admin/orders/${o._id}/assign`, { cookie: adminCookie, body: { assignedTo: String(cliente._id) } });
  record("G3", r.status !== 200, { status: r.status });
});
