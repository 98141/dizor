"use strict";
/**
 * Arnés de auditoría independiente Wompi–Pedidos DIZOR (2026-11-23).
 *
 * - NO modifica la aplicación: carga backend/src tal cual.
 * - MongoDB: replica set temporal en memoria (127.0.0.1). No lee .env ni MONGO_URI.
 * - Wompi: proveedor SIMULADO local. Toda red externa queda bloqueada y registrada.
 * - Datos ficticios. Secretos generados al azar en cada ejecución.
 * - Los limitadores de tasa se elevan SOLO en este proceso para poder ejecutar
 *   cientos de solicitudes; no se evalúa la limitación de tasa aquí.
 *
 * Uso (PowerShell):
 *   $env:MMS_DIR = '<carpeta con node_modules/mongodb-memory-server>'
 *   $env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
 *   node docs/auditoria-wompi-pedidos/evidencias/auditoria-wompi.cjs
 *
 * Cada escenario afirma el comportamiento CORRECTO esperado por la auditoría.
 * FAIL = el sistema se comporta distinto de lo esperado (defecto o brecha).
 */
const path = require("path");
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");
const Module = require("module");
const assert = require("assert/strict");

const ROOT = path.resolve(__dirname, "../../..");
const BACKEND = path.join(ROOT, "backend");
const FRONTEND = path.join(ROOT, "frontend");
const OUT = path.join(__dirname, "resultados-auditoria-wompi.json");
const MMS = process.env.MMS_DIR;
if (!MMS || !process.env.MONGOMS_SYSTEM_BINARY) throw new Error("Faltan MMS_DIR y MONGOMS_SYSTEM_BINARY");

const rnd = (n = 4) => crypto.randomBytes(n).toString("hex");
Object.assign(process.env, {
  NODE_ENV: "test", MONGO_URI: "",
  JWT_SECRET: rnd(24), JWT_REFRESH_SECRET: rnd(24), JWT_EXPIRES_IN: "15m", JWT_REFRESH_EXPIRES_IN: "7d",
  RESEND_API_KEY: "", EMAIL_FROM: "", ADMIN_NOTIFY_EMAIL: "alertas-admin@example.test",
  TRANSACTIONAL_NOTIFICATIONS_ENABLED: "",
  WOMPI_PRIVATE_KEY: "prv_test_auditoria_ficticia", WOMPI_EVENTS_SECRET: "test_events_auditoria_" + rnd(8),
  WOMPI_ENV: "sandbox",
  NEQUI_CLIENT_ID: "", NEQUI_CLIENT_SECRET: "", NEQUI_API_KEY: "", NEQUI_WEBHOOK_SECRET: "", NEQUI_ENV: "",
  NEQUI_DIRECT_ENABLED: "", NEQUI_MANUAL_ENABLED: "",
  CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "", CLOUDINARY_CLOUD_NAME: "",
  CLIENT_URL: "http://127.0.0.1:3000", MARKETING_TOKEN_SECRET: rnd(24),
  MARKETING_CART_REMINDERS_ENABLED: "false", PQR_PUBLIC_ENABLED: "false",
});

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "winston-daily-rotate-file") {
    const Transport = origLoad("winston-transport", parent, isMain);
    return class NullTransport extends Transport { log(_i, cb) { cb(); } };
  }
  if (request === "express-rate-limit") {
    const real = origLoad(request, parent, isMain);
    const wrapped = (opts) => real({ ...opts, max: 1_000_000 });
    return Object.assign(wrapped, real, { default: wrapped, rateLimit: wrapped });
  }
  return origLoad.apply(this, arguments);
};

// ---------- Proveedor Wompi simulado ----------
const provider = { calls: [], links: new Map(), tx: new Map(), failLinks: 0, blocked: [] };
const realFetch = globalThis.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return realFetch(input, init);
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;
  provider.calls.push({ host: url.hostname, method, path: url.pathname, body, auth: init.headers?.Authorization ? "Bearer <redactado>" : null });
  if (/wompi\.co$/.test(url.hostname)) {
    if (method === "POST" && url.pathname === "/v1/payment_links") {
      if (provider.failLinks > 0) { provider.failLinks -= 1; throw new Error("timeout simulado del proveedor"); }
      const id = "lnk" + rnd(5);
      provider.links.set(id, { id, active: true, ...body });
      return json({ data: { id, expires_at: null, ...body } });
    }
    if (method === "GET" && url.pathname.startsWith("/v1/payment_links/")) {
      const l = provider.links.get(decodeURIComponent(url.pathname.split("/").pop()));
      return l ? json({ data: l }) : json({ error: { type: "NOT_FOUND" } }, 404);
    }
    if (method === "GET" && url.pathname.startsWith("/v1/transactions/")) {
      const t = provider.tx.get(decodeURIComponent(url.pathname.split("/").pop()));
      return t ? json({ data: t }) : json({ error: { type: "NOT_FOUND_ERROR" } }, 404);
    }
  }
  provider.blocked.push(url.hostname);
  throw new Error("Red saliente bloqueada");
};

const { MongoMemoryReplSet } = require(path.join(MMS, "node_modules", "mongodb-memory-server"));
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
const req = (p) => require(path.join(BACKEND, "src", p));

// ---------- Utilidades ----------
const results = [];
const record = (id, verdict, data) => { results.push({ id, verdict, ...data }); console.log(`${verdict.padEnd(8)} ${id} — ${data.title}`); };
let mongod, server, base, M = {}, cat, size, color, cookies = {}, users = {};

const api = async (method, p, { body, cookie, headers } = {}) => {
  const res = await realFetch(`${base}${p}`, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch { /* texto */ }
  return { status: res.status, json: j, text, headers: res.headers };
};
const login = async (email, password) => {
  const r = await api("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, r.text);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
};
const makeProduct = async (stock, price = 150000) => {
  const product = await M.Product.create({ name: "Pieza auditoría " + rnd(3), category: cat._id, salePrice: price, internalCost: 50000,
    mainImage: "https://example.test/p.jpg", images: [{ url: "https://example.test/p.jpg" }],
    variants: [{ size: size._id, color: color._id, sku: "AUD-" + rnd(4).toUpperCase(), stock, isActive: true }] });
  return { product, variantId: product.variants[0]._id };
};
const stockOf = async ({ product, variantId }) => (await M.Product.collection.findOne({ _id: product._id })).variants.find((v) => String(v._id) === String(variantId)).stock;
const orderBody = (p, extra = {}) => ({
  items: [{ productId: String(p.product._id), variantId: String(p.variantId), quantity: 1 }],
  buyer: { name: "Cliente Ficticio", email: `c-${rnd(3)}@example.test`, phone: "3000000099" },
  shippingAddress: { address: "Calle Ficticia 10", city: "Pasto", department: "Nariño" },
  paymentMethod: "wompi", carrier: "interrapidisimo", termsAccepted: true, privacyAuthorization: true,
  idempotencyKey: crypto.randomUUID(), ...extra,
});
const createOrder = async (p, extra = {}, cookie) => {
  const r = await api("POST", "/api/checkout/orders", { body: orderBody(p, extra), cookie });
  return r;
};
const fresh = async (id) => M.Order.findById(id).lean();
const signEvent = (tx, { secret = process.env.WOMPI_EVENTS_SECRET, properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
  timestamp = Math.floor(Date.now() / 1000), environment = "test", event = "transaction.updated" } = {}) => {
  const data = { transaction: tx };
  const chain = properties.map((pp) => pp.split(".").reduce((v, k) => v?.[k], data) ?? "").join("") + timestamp + secret;
  const checksum = crypto.createHash("sha256").update(chain).digest("hex").toUpperCase();
  return { body: { event, data, environment, signature: { properties, checksum }, timestamp, sent_at: new Date().toISOString() }, checksum };
};
const postEvent = async (tx, opts = {}) => {
  const ev = signEvent(tx, opts);
  if (opts.mutate) opts.mutate(ev.body);
  const headers = opts.noHeader ? {} : { "X-Event-Checksum": opts.checksum ?? ev.checksum };
  if (opts.noHeader) delete ev.body.signature.checksum;
  return api("POST", "/api/webhooks/wompi", { body: ev.body, headers });
};
// Transacción realista de Payment Link: referencia generada por Wompi (no el número de pedido),
// sin `sku` (no figura en el contrato de eventos) y con payment_link_id.
const linkTx = (order, extra = {}) => ({
  id: extra.id || `${rnd(2)}-${Date.now()}-${rnd(3)}`, status: "APPROVED",
  amount_in_cents: Math.round(order.total * 100), currency: "COP",
  reference: extra.reference || `wompi_gen_${rnd(6)}`, payment_link_id: order.wompi.paymentLinkId,
  payment_method_type: "CARD", customer_email: "c@example.test", ...extra,
});
const notifs = async (orderId) => (await M.Notification.find({ order: orderId }).lean()).map((n) => `${n.event}:${n.status}`);
const events = async (orderId) => M.PaymentEvent.find({ order: orderId }).lean();
const canPrepare = async (orderId, cookie = cookies.admin) => (await api("PATCH", `/api/admin/orders/${orderId}/status`, { cookie, body: { orderStatus: "en_preparacion" } }));
const newWompi = async (stock = 5, price = 150000, extra = {}, cookie) => {
  const p = await makeProduct(stock, price);
  const r = await createOrder(p, extra, cookie);
  assert.equal(r.status, 201, r.text);
  return { p, r, order: await fresh(r.json.order.id) };
};

async function scenario(id, title, fn) {
  const started = Date.now();
  try {
    const out = await fn();
    record(id, out.verdict, { title, ...out, ms: Date.now() - started });
  } catch (err) {
    record(id, "ERROR", { title, error: String(err?.stack || err).split("\n").slice(0, 4).join(" | "), ms: Date.now() - started });
  }
}
const check = (cond) => (cond ? "PASS" : "FAIL");

async function setup() {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ args: ["--setParameter", "enableTestCommands=1"] }] });
  const uri = mongod.getUri();
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri);
  const app = req("app");
  for (const [k, f] of Object.entries({ Order: "order", Product: "product", User: "user", Coupon: "coupon", PaymentEvent: "paymentEvent",
    Notification: "notification", ProductHistory: "productHistory", Category: "category", Size: "size", Color: "color" })) M[k] = req(`models/${f}`);
  await Promise.all(Object.values(M).map((m) => m.init()));
  req("services/orderReceiptService").setReceiptTransport(async () => ({ devMode: false }));
  [cat, size, color] = await Promise.all([M.Category.create({ name: "Aud " + rnd(2) }), M.Size.create({ name: "U" + rnd(2) }), M.Color.create({ name: "Crudo" + rnd(2) })]);
  const pass = "AuditoriaPrueba123!";
  for (const [k, role] of [["admin", "admin"], ["vendor", "vendedor"], ["client", "cliente"], ["client2", "cliente"]]) {
    users[k] = await M.User.create({ name: `U ${k}`, email: `${k}-aud@example.test`, password: pass, role });
  }
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  for (const k of Object.keys(users)) cookies[k] = await login(`${k}-aud@example.test`, pass);
  const info = await mongoose.connection.db.admin().command({ buildInfo: 1 });
  return { mongo: info.version, node: process.version };
}

async function failpoint(mode, data) {
  return mongoose.connection.db.admin().command({ configureFailPoint: "failCommand", mode, ...(data ? { data } : {}) });
}

async function main() {
  const env = await setup();
  console.log("Entorno:", env);

  // ---------------- P01 ----------------
  await scenario("P01", "Pago aprobado (evento firmado, vinculado solo por payment_link_id)", async () => {
    const callsBefore = provider.calls.length;
    const { p, r, order } = await newWompi(3);
    const linkCall = provider.calls.slice(callsBefore).find((c) => c.method === "POST" && c.path === "/v1/payment_links");
    const stockBefore = await stockOf(p);
    const tx = linkTx(order);
    const ev = await postEvent(tx);
    const o = await fresh(order._id);
    const evs = await events(order._id);
    const prep = await canPrepare(order._id);
    const observed = { createStatus: r.status, paymentUrl: !!r.json.paymentUrl, linkBody: { amount_in_cents: linkCall?.body.amount_in_cents, currency: linkCall?.body.currency, single_use: linkCall?.body.single_use, sku: linkCall?.body.sku === order.orderNumber, redirect_url: linkCall?.body.redirect_url?.replace(/order=[^&]+/, "order=<n>") },
      initial: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, stockDeducted: order.stockDeducted }, stockBefore,
      webhook: ev.status, after: { paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, stockDeducted: o.stockDeducted, requiresReview: o.requiresReview, txStored: o.wompi.transactionId === tx.id },
      stockAfter: await stockOf(p), paymentEvents: evs.length, processed: !!evs[0]?.processedAt, notifications: await notifs(order._id), prepare: prep.status };
    const ok = linkCall?.body.amount_in_cents === 15000000 && linkCall.body.currency === "COP" && linkCall.body.single_use === true
      && order.paymentStatus === "pendiente" && order.orderStatus === "pago_pendiente" && !order.stockDeducted && stockBefore === 3
      && ev.status === 200 && o.paymentStatus === "pagado" && o.orderStatus === "pagado" && o.stockDeducted && !o.requiresReview
      && observed.stockAfter === 2 && evs.length === 1 && observed.processed && prep.status === 200;
    return { verdict: check(ok), expected: "Monto del enlace = total servidor en centavos COP; sin descuento de stock al crear; pagado y stock −1 solo tras evento firmado; preparable.", observed };
  });

  // ---------------- X01 ----------------
  await scenario("X01", "Evento APPROVED auténtico sin vínculo reconocible (sin payment_link_id ni sku)", async () => {
    const { order } = await newWompi(3);
    const tx = linkTx(order, { payment_link_id: null });
    const before = await M.PaymentEvent.countDocuments();
    const ev = await postEvent(tx);
    const after = await M.PaymentEvent.countDocuments();
    const o = await fresh(order._id);
    const observed = { webhook: ev.status, paymentEventsPersisted: after - before, orderPaymentStatus: o.paymentStatus, adminIncident: o.incidents.length };
    // Esperado: un cobro auténtico que no se pudo asociar debe conservarse como evidencia y alertar.
    return { verdict: check(after - before >= 1), expected: "Persistir la evidencia del cobro no asociado y generar alerta; nunca descartarla en silencio con 200.", observed,
      note: "Si en producción las transacciones de Payment Link no traen payment_link_id poblado (la documentación oficial no lo garantiza), TODOS los pagos caerían en este camino." };
  });

  // ---------------- P02 ----------------
  await scenario("P02", "Pago rechazado (DECLINED)", async () => {
    const { p, order } = await newWompi(3);
    const ev = await postEvent(linkTx(order, { status: "DECLINED" }));
    const o = await fresh(order._id);
    const prep = await canPrepare(order._id);
    const observed = { webhook: ev.status, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, stock: await stockOf(p), stockDeducted: o.stockDeducted, prepare: prep.status, notifications: await notifs(order._id) };
    const ok = ev.status === 200 && o.paymentStatus === "rechazado" && o.orderStatus === "pago_pendiente" && observed.stock === 3 && !o.stockDeducted && prep.status === 409
      && observed.notifications.some((n) => n.startsWith("payment.declined"));
    return { verdict: check(ok), expected: "rechazado, sin stock, sin preparación, aviso de rechazo encolado.", observed };
  });

  // ---------------- P03 ----------------
  await scenario("P03", "Pago pendiente (PENDING)", async () => {
    const { p, order } = await newWompi(3);
    const ev = await postEvent(linkTx(order, { status: "PENDING" }));
    const o = await fresh(order._id);
    const prep = await canPrepare(order._id);
    const observed = { webhook: ev.status, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, wompiStatus: o.wompi.status, stock: await stockOf(p), prepare: prep.status };
    const ok = o.paymentStatus === "pendiente" && o.orderStatus === "pago_pendiente" && o.wompi.status === "PENDING" && observed.stock === 3 && prep.status === 409;
    return { verdict: check(ok), expected: "Sigue pendiente, no preparable, transacción registrada.", observed };
  });

  // ---------------- P04 ----------------
  await scenario("P04", "Pago anulado (VOIDED) sobre pedido pendiente", async () => {
    const { order } = await newWompi(3);
    await postEvent(linkTx(order, { status: "VOIDED" }));
    const o = await fresh(order._id);
    return { verdict: check(o.paymentStatus === "rechazado" && o.orderStatus === "pago_pendiente"), expected: "No pagado.", observed: { paymentStatus: o.paymentStatus, orderStatus: o.orderStatus } };
  });
  await scenario("P04b", "VOIDED posterior a APPROVED de la MISMA transacción", async () => {
    const { p, order } = await newWompi(3);
    const tx = linkTx(order);
    await postEvent(tx);
    const ev = await postEvent({ ...tx, status: "VOIDED" });
    const o = await fresh(order._id);
    const prep = await canPrepare(order._id);
    const voidEvents = (await events(order._id)).filter((e) => e.status === "VOIDED").length;
    const observed = { webhook: ev.status, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, wompiStatus: o.wompi.status, incidents: o.incidents.map((i) => i.code), requiresReview: o.requiresReview, stock: await stockOf(p),
      eventoVoidedGuardado: voidEvents, pasoAPreparacionTrasAnulacion: prep.status };
    // Esperado: una anulación del proveedor no puede ignorarse; debe dejar de considerarse pagado o, al menos, abrir incidencia y bloquear el despacho.
    const ok = (o.paymentStatus !== "pagado" || o.incidents.some((i) => !i.resolvedAt)) && prep.status === 409;
    return { verdict: check(ok), expected: "La anulación del cobro aprobado debe reflejarse (incidencia/estado) y bloquear el despacho.", observed };
  });

  // ---------------- P05 ----------------
  await scenario("P05", "Error de pago (ERROR) del proveedor", async () => {
    const { order } = await newWompi(3);
    await postEvent(linkTx(order, { status: "ERROR" }));
    const o = await fresh(order._id);
    return { verdict: check(o.paymentStatus === "rechazado" && !o.stockDeducted), expected: "No pagado, sin stock.", observed: { paymentStatus: o.paymentStatus, stockDeducted: o.stockDeducted } };
  });
  await scenario("P05b", "Fallo/timeout del proveedor al crear el enlace de pago", async () => {
    const p = await makeProduct(3);
    provider.failLinks = 1;
    const body = orderBody(p);
    const r = await api("POST", "/api/checkout/orders", { body });
    const o = await M.Order.findOne({ idempotencyKey: body.idempotencyKey }).lean();
    const retrySame = await api("POST", "/api/checkout/orders", { body });
    const retryNew = await api("POST", "/api/checkout/orders", { body: { ...body, idempotencyKey: crypto.randomUUID() } });
    const observed = { status: r.status, message: r.json?.message, leak: /stack|node_modules/.test(r.text), order: o && { checkoutState: o.checkoutState, paymentStatus: o.paymentStatus, stockDeducted: o.stockDeducted, incidents: o.incidents.map((i) => i.code) },
      stock: await stockOf(p), retrySameKey: retrySame.status, retryNewKey: retryNew.status, ordersForBuyer: await M.Order.countDocuments({ "buyer.email": body.buyer.email }) };
    const ok = r.status === 502 && o?.checkoutState === "failed" && o.paymentStatus === "pendiente" && observed.stock === 3 && !observed.leak;
    return { verdict: check(ok), expected: "Error controlado, sin pago ni stock; pedido marcado para revisión.", observed };
  });

  // ---------------- P06 / P07 ----------------
  await scenario("P06", "Cliente cierra el checkout de Wompi (ningún evento)", async () => {
    const { order, r } = await newWompi(3);
    const look = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: order.orderNumber, accessToken: r.json.accessToken } });
    const o = await fresh(order._id);
    const ws = await api("GET", `/api/admin/orders/${order._id}`, { cookie: cookies.admin });
    const observed = { lookup: look.status, paymentStatus: look.json?.order.paymentStatus, orderStatus: o.orderStatus, adminPrimary: ws.json?.order.operation.primary.code, canReconcile: ws.json?.order.operation.canReconcile };
    const ok = look.json?.order.paymentStatus === "pendiente" && o.orderStatus === "pago_pendiente" && observed.adminPrimary === "waiting_payment";
    return { verdict: check(ok), expected: "Pendiente para cliente y admin, sin declararse pagado ni rechazado.", observed };
  });
  await scenario("P07", "Cliente regresa sin pagar (redirect con order= y sin transacción)", async () => {
    const { order, r } = await newWompi(3);
    const look = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: order.orderNumber, accessToken: r.json.accessToken, payment: "wompi" } });
    return { verdict: check(look.json?.order.paymentStatus === "pendiente"), expected: "Sigue pendiente.", observed: { paymentStatus: look.json?.order.paymentStatus } };
  });

  // ---------------- P08 ----------------
  await scenario("P08", "Redirección manipulada (parámetros de pago inyectados)", async () => {
    const { order, r } = await newWompi(3);
    const tries = [];
    tries.push((await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: order.orderNumber, accessToken: r.json.accessToken, id: "tx-falsa", status: "APPROVED", paymentStatus: "pagado" } })).status);
    tries.push((await api("GET", `/api/checkout/orders/lookup?order=${order.orderNumber}&id=tx-falsa&status=APPROVED`)).status);
    const o = await fresh(order._id);
    return { verdict: check(o.paymentStatus === "pendiente" && !o.wompi.transactionId), expected: "Ningún parámetro del navegador cambia el estado.", observed: { responses: tries, paymentStatus: o.paymentStatus, transactionId: o.wompi.transactionId } };
  });

  // ---------------- P09 / P10 ----------------
  await scenario("P09", "Webhook falsificado (sin checksum, checksum aleatorio, secreto incorrecto)", async () => {
    const { order } = await newWompi(3);
    const tx = linkTx(order);
    const a = await postEvent(tx, { noHeader: true });
    const b = await postEvent(tx, { checksum: crypto.randomBytes(32).toString("hex").toUpperCase() });
    const c = await postEvent(tx, { secret: "test_events_otro" });
    const d = await postEvent(tx, { secret: process.env.WOMPI_PRIVATE_KEY });
    const o = await fresh(order._id);
    const observed = { sinChecksum: a.status, aleatorio: b.status, secretoIncorrecto: c.status, firmadoConLlavePrivada: d.status, paymentStatus: o.paymentStatus, events: (await events(order._id)).length };
    return { verdict: check([a, b, c, d].every((x) => x.status === 401) && o.paymentStatus === "pendiente" && observed.events === 0), expected: "401 y ningún efecto.", observed };
  });
  await scenario("P10", "Firma inválida / manipulación del evento firmado", async () => {
    const { order } = await newWompi(3);
    const tx = linkTx(order, { status: "DECLINED" });
    const tampered = await postEvent(tx, { mutate: (b) => { b.data.transaction.status = "APPROVED"; } });
    const amount = await postEvent(tx, { mutate: (b) => { b.data.transaction.amount_in_cents = 100; } });
    const fewProps = await postEvent({ ...tx, status: "APPROVED" }, { properties: ["transaction.id"] });
    const old = await postEvent({ ...tx, status: "APPROVED" }, { timestamp: Math.floor(Date.now() / 1000) - 27 * 3600 });
    const future = await postEvent({ ...tx, status: "APPROVED" }, { timestamp: Math.floor(Date.now() / 1000) + 600 });
    const tsTamper = await postEvent({ ...tx, status: "APPROVED" }, { mutate: (b) => { b.timestamp += 1; } });
    const o = await fresh(order._id);
    const observed = { statusAlterado: tampered.status, montoAlterado: amount.status, propiedadesReducidas: fewProps.status, antiguo27h: old.status, futuro: future.status, timestampAlterado: tsTamper.status, paymentStatus: o.paymentStatus };
    const ok = [tampered, amount, fewProps, old, future, tsTamper].every((x) => x.status === 401) && o.paymentStatus === "pendiente";
    return { verdict: check(ok), expected: "Todos 401; sin efecto.", observed };
  });

  // ---------------- P11 ----------------
  await scenario("P11", "Webhook duplicado (secuencial y 6 concurrentes)", async () => {
    const { p, order } = await newWompi(4);
    const tx = linkTx(order);
    const ev = signEvent(tx);
    const send = () => api("POST", "/api/webhooks/wompi", { body: ev.body, headers: { "X-Event-Checksum": ev.checksum } });
    const seq = [await send(), await send()];
    const conc = await Promise.all(Array.from({ length: 6 }, send));
    const o = await fresh(order._id);
    const observed = { secuencial: seq.map((x) => x.status), concurrente: conc.map((x) => x.status), stock: await stockOf(p), events: (await events(order._id)).length,
      approvedNotifications: (await notifs(order._id)).filter((n) => n.startsWith("payment.approved")).length, saleMovements: await M.ProductHistory.countDocuments({ referenceId: order._id, eventType: "sale" }) };
    const ok = observed.stock === 3 && observed.events === 1 && observed.approvedNotifications === 1 && observed.saleMovements === 1 && o.paymentStatus === "pagado";
    return { verdict: check(ok), expected: "Un único efecto financiero, de inventario y de notificación.", observed };
  });

  // ---------------- P12 ----------------
  await scenario("P12", "Webhooks fuera de orden", async () => {
    const { p, order } = await newWompi(4);
    const tx = linkTx(order);
    await postEvent(tx);
    await postEvent({ ...tx, status: "PENDING" });
    await postEvent(linkTx(order, { status: "DECLINED" }));
    const o1 = await fresh(order._id);
    const second = await newWompi(4);
    const late = linkTx(second.order);
    await postEvent(late);
    await postEvent({ ...late, status: "PENDING" }, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
    const o2 = await fresh(second.order._id);
    const observed = { trasPendingYDeclined: { paymentStatus: o1.paymentStatus, orderStatus: o1.orderStatus, stock: await stockOf(p) }, pendingAntiguoTrasAprobado: o2.paymentStatus };
    return { verdict: check(o1.paymentStatus === "pagado" && o1.orderStatus === "pagado" && observed.trasPendingYDeclined.stock === 3 && o2.paymentStatus === "pagado"), expected: "Un estado consolidado no retrocede.", observed };
  });

  // ---------------- P13 ----------------
  await scenario("P13", "Webhook perdido: pago aprobado en Wompi pero el evento nunca llega", async () => {
    const { order, r } = await newWompi(3);
    const tx = linkTx(order);
    provider.tx.set(tx.id, tx); // aprobado en el proveedor
    const rec = await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.admin });
    const ws = await api("GET", `/api/admin/orders/${order._id}`, { cookie: cookies.admin });
    const look = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: order.orderNumber, accessToken: r.json.accessToken } });
    const o = await fresh(order._id);
    const observed = { conciliacionAdmin: rec.status, mensaje: rec.json?.message, canReconcileUI: ws.json?.order.operation.canReconcile, clienteVe: look.json?.order.paymentStatus, paymentStatus: o.paymentStatus };
    return { verdict: check(o.paymentStatus === "pagado"), expected: "Existe una vía autenticada (consulta al proveedor por id de redirección, referencia o enlace) para recuperar el pago.", observed };
  });

  // ---------------- P14 ----------------
  await scenario("P14", "Error de MongoDB: (a) al guardar la evidencia, (b) durante el descuento de inventario", async () => {
    let fpOk = true;
    try { await failpoint("off"); } catch (e) { fpOk = false; return { verdict: "BLOCKED", expected: "-", observed: { failpoint: String(e.message) } }; }
    const { p, order } = await newWompi(3);
    const tx = linkTx(order);
    await failpoint({ times: 1 }, { failCommands: ["findAndModify"], errorCode: 2 });
    const a = await postEvent(tx);
    await failpoint("off");
    const oa = await fresh(order._id);
    const evA = (await events(order._id)).length;
    // (b) la primera findAndModify (inbox) pasa; la del stock falla.
    await failpoint({ skip: 1 }, { failCommands: ["findAndModify"], errorCode: 2 });
    const b = await postEvent(tx);
    await failpoint("off");
    const ob = await fresh(order._id);
    const stockB = await stockOf(p);
    const retry = await postEvent(tx); // reintento del proveedor
    const oc = await fresh(order._id);
    const observed = {
      a: { webhook: a.status, paymentStatus: oa.paymentStatus, eventos: evA },
      b: { webhook: b.status, paymentStatus: ob.paymentStatus, stockDeducted: ob.stockDeducted, stock: stockB, incidents: ob.incidents.map((i) => `${i.code}${i.resolvedAt ? "(resuelta)" : ""}`) },
      reintento: { webhook: retry.status, paymentStatus: oc.paymentStatus, orderStatus: oc.orderStatus, stock: await stockOf(p), requiresReview: oc.requiresReview, incidents: oc.incidents.map((i) => `${i.code}${i.resolvedAt ? "(resuelta)" : ""}`) },
    };
    const ok = a.status >= 500 && oa.paymentStatus === "pendiente" && b.status >= 500 && ob.paymentStatus === "pagado" && !ob.stockDeducted && stockB === 3
      && retry.status === 200 && oc.stockDeducted && observed.reintento.stock === 2 && !oc.requiresReview;
    return { verdict: check(ok && fpOk), expected: "No-2xx para que Wompi reintente; el dinero queda registrado; el reintento completa sin duplicar.", observed };
  });

  // ---------------- P15 ----------------
  await scenario("P15", "Respuesta perdida / resultado desconocido al crear pedido (misma clave tras fallo)", async () => {
    const p = await makeProduct(3);
    const body = orderBody(p);
    const first = await api("POST", "/api/checkout/orders", { body });
    const again = await api("POST", "/api/checkout/orders", { body });
    const observed = { first: first.status, retry: again.status, sameOrder: first.json?.order.id === again.json?.order.id, samePaymentUrl: first.json?.paymentUrl === again.json?.paymentUrl,
      orders: await M.Order.countDocuments({ idempotencyKey: body.idempotencyKey }), links: provider.calls.filter((c) => c.path === "/v1/payment_links" && c.body?.sku === first.json?.order.orderNumber).length };
    return { verdict: check(first.status === 201 && again.status === 200 && observed.sameOrder && observed.samePaymentUrl && observed.orders === 1 && observed.links === 1), expected: "La repetición devuelve el mismo pedido y enlace.", observed };
  });

  // ---------------- P16 ----------------
  await scenario("P16", "Doble clic en pagar (5 solicitudes simultáneas, misma clave)", async () => {
    const p = await makeProduct(3);
    const body = orderBody(p);
    const rs = await Promise.all(Array.from({ length: 5 }, () => api("POST", "/api/checkout/orders", { body })));
    const orders = await M.Order.find({ idempotencyKey: body.idempotencyKey }).lean();
    const linkCalls = provider.calls.filter((c) => c.path === "/v1/payment_links" && orders.some((o) => o.orderNumber === c.body?.sku)).length;
    const observed = { statuses: rs.map((x) => x.status), orders: orders.length, linkCalls };
    return { verdict: check(orders.length === 1 && linkCalls === 1 && rs.filter((x) => x.status === 201).length === 1), expected: "Un pedido y un enlace.", observed };
  });

  // ---------------- P17 ----------------
  await scenario("P17", "Dos solicitudes concurrentes con claves distintas (dos pestañas)", async () => {
    const p = await makeProduct(1);
    const email = `tab-${rnd(3)}@example.test`;
    const b = (k) => orderBody(p, { idempotencyKey: k, buyer: { name: "Cliente", email, phone: "3000000099" } });
    const rs = await Promise.all([api("POST", "/api/checkout/orders", { body: b(crypto.randomUUID()) }), api("POST", "/api/checkout/orders", { body: b(crypto.randomUUID()) })]);
    const n = await M.Order.countDocuments({ "buyer.email": email });
    const observed = { statuses: rs.map((x) => x.status), ordersSameBuyer: n, stock: await stockOf(p), note: "Sin reserva: ambos pedidos Wompi quedan abiertos para la misma unidad." };
    return { verdict: check(rs.every((x) => x.status === 201) && n === 2 && observed.stock === 1), expected: "Comportamiento de diseño documentado: dos intentos independientes, cada uno con su enlace; ninguno pagado.", observed };
  });

  // ---------------- P18 ----------------
  await scenario("P18", "Reintento tras rechazo (DECLINED → APPROVED en el mismo enlace)", async () => {
    const { p, order } = await newWompi(3);
    const t1 = linkTx(order, { status: "DECLINED" });
    await postEvent(t1);
    const t2 = linkTx(order);
    await postEvent(t2);
    const o = await fresh(order._id);
    const evs = await events(order._id);
    const observed = { paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, storedTx: o.wompi.transactionId === t2.id ? "t2" : o.wompi.transactionId, eventsKept: evs.map((e) => e.status), stock: await stockOf(p), historyMentionsBoth: o.statusHistory.some((h) => h.note.includes(t1.id)) && o.statusHistory.some((h) => h.note.includes(t2.id)) };
    return { verdict: check(o.paymentStatus === "pagado" && evs.length === 2 && observed.stock === 2 && observed.historyMentionsBoth), expected: "Pagado con t2; historial conserva t1 y t2.", observed };
  });

  // ---------------- P19 / P30 ----------------
  await scenario("P19", "Aprobación tardía tras cancelación administrativa", async () => {
    const { p, order } = await newWompi(3);
    const c = await api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie: cookies.admin, body: { orderStatus: "cancelado" } });
    const linkActive = provider.links.get(order.wompi.paymentLinkId)?.active;
    const deactivationCalls = provider.calls.filter((x) => x.method === "PATCH" || x.method === "PUT").length;
    await postEvent(linkTx(order));
    const o = await fresh(order._id);
    const fin = await M.Order.countDocuments({ _id: order._id, ...req("services/financeCriteria").reconciledSalesFilter() });
    const observed = { cancel: c.status, enlaceSigueActivoEnProveedor: linkActive, llamadasDesactivacion: deactivationCalls, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, stock: await stockOf(p), incidents: o.incidents.map((i) => i.code), contadoComoVenta: fin };
    const ok = o.orderStatus === "cancelado" && o.paymentStatus === "pagado" && o.incidents.some((i) => i.code === "approved_after_cancellation") && observed.stock === 3 && fin === 0;
    return { verdict: check(ok), expected: "Cobro registrado como dinero en disputa con incidencia, sin stock ni venta.", observed };
  });

  // ---------------- P20 ----------------
  await scenario("P20", "Dos transacciones aprobadas para un pedido", async () => {
    const { p, order } = await newWompi(3);
    await postEvent(linkTx(order));
    await postEvent(linkTx(order));
    const o = await fresh(order._id);
    const prep = await canPrepare(order._id);
    const ws = await api("GET", `/api/admin/orders/${order._id}`, { cookie: cookies.admin });
    const observed = { paymentStatus: o.paymentStatus, stock: await stockOf(p), incidents: o.incidents.map((i) => i.code), requiresReview: o.requiresReview, prepare: prep.status, prepareMsg: prep.json?.message,
      adminActions: ws.json?.order.operation, existeEndpointResolverIncidencia: false };
    // Esperado: incidencia + vía administrativa para resolverla y despachar el pedido legítimo.
    return { verdict: check(o.incidents.some((i) => i.code === "additional_approved_payment") && observed.stock === 2 && prep.status === 200), expected: "Detectar el doble cobro y permitir, tras resolución administrativa registrada, despachar el pedido legítimo.", observed };
  });

  // ---------------- P21 ----------------
  await scenario("P21", "Monto manipulado por el cliente en la solicitud", async () => {
    const p = await makeProduct(3, 150000);
    const before = provider.calls.length;
    const r = await api("POST", "/api/checkout/orders", { body: { ...orderBody(p), total: 100, subtotal: 100, discountTotal: 149999,
      items: [{ productId: String(p.product._id), variantId: String(p.variantId), quantity: 1, unitPrice: 1, lineTotal: 1, price: 1 }] } });
    const call = provider.calls.slice(before).find((c) => c.path === "/v1/payment_links");
    const o = await fresh(r.json.order.id);
    const observed = { status: r.status, orderTotal: o.total, unitPrice: o.items[0].unitPrice, linkAmount: call?.body.amount_in_cents };
    return { verdict: check(o.total === 150000 && call?.body.amount_in_cents === 15000000), expected: "El servidor ignora precios/total del cliente.", observed };
  });
  await scenario("P21b", "Transacción APPROVED con monto inferior al del pedido", async () => {
    const { p, order, r } = await newWompi(3);
    await postEvent(linkTx(order, { amount_in_cents: 100 }));
    const o = await fresh(order._id);
    const look = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: order.orderNumber, accessToken: r.json.accessToken } });
    const prep = await canPrepare(order._id);
    const observed = { paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, clienteVe: look.json?.order.paymentStatus, incidents: o.incidents.map((i) => i.code), stock: await stockOf(p), prepare: prep.status };
    // Principio rector: no "pagado" sin evidencia consistente (monto/moneda).
    return { verdict: check(o.paymentStatus !== "pagado" && prep.status === 409), expected: "No marcar pagado con monto inconsistente; incidencia; no despachable.", observed };
  });

  // ---------------- P22 ----------------
  await scenario("P22", "Cupón manipulado (inexistente, descuento enviado por el cliente)", async () => {
    const p = await makeProduct(3);
    const fake = await api("POST", "/api/checkout/orders", { body: orderBody(p, { couponCode: "NOEXISTE99" }) });
    const r = await api("POST", "/api/checkout/orders", { body: orderBody(p, { discountTotal: 140000, discount: 140000, coupon: { value: 99 } }) });
    const o = await fresh(r.json.order.id);
    const exp = await M.Coupon.create({ code: "VENCIDO" + rnd(2).toUpperCase(), type: "percentage", value: 50, expiresAt: new Date(Date.now() - 1000) });
    const expired = await api("POST", "/api/checkout/orders", { body: orderBody(p, { couponCode: exp.code }) });
    const observed = { inexistente: fake.status, vencido: expired.status, descuentoInyectado: { status: r.status, total: o.total, discountTotal: o.discountTotal } };
    return { verdict: check(fake.status === 400 && expired.status === 400 && o.total === 150000 && o.discountTotal === 0), expected: "Rechazo y recálculo en servidor.", observed };
  });
  await scenario("P22b", "Cupón de un solo uso usado en dos pedidos Wompi pagados", async () => {
    const code = "UNICO" + rnd(2).toUpperCase();
    await M.Coupon.create({ code, type: "percentage", value: 10, maxUses: 1 });
    const a = await newWompi(3, 150000, { couponCode: code });
    const b = await newWompi(3, 150000, { couponCode: code });
    await postEvent(linkTx(a.order));
    await postEvent(linkTx(b.order));
    const oa = await fresh(a.order._id), ob = await fresh(b.order._id);
    const prepB = await canPrepare(b.order._id);
    const observed = { totales: [a.order.total, b.order.total], usedCount: (await M.Coupon.findOne({ code }).lean()).usedCount,
      A: { paymentStatus: oa.paymentStatus, couponConsumed: oa.couponConsumed }, B: { paymentStatus: ob.paymentStatus, orderStatus: ob.orderStatus, stockDeducted: ob.stockDeducted, incidents: ob.incidents.map((i) => i.code), prepare: prepB.status } };
    return { verdict: check(observed.usedCount === 1 && ob.incidents.some((i) => i.code === "coupon_reconciliation") && prepB.status === 200),
      expected: "Detectar el exceso de uso y permitir una resolución administrativa registrada (aceptar o gestionar el pedido pagado).", observed };
  });

  // ---------------- P23 ----------------
  await scenario("P23", "Referencia/sku de un pedido y payment_link_id de otro en el mismo evento", async () => {
    // Caso 1: el pedido dueño del enlace (A) es el más antiguo. Caso 2: el pedido cuya
    // referencia aparece (B) es el más antiguo. findOne({$or}) devuelve el primero en orden natural.
    const run = async (refOlder) => {
      const first = await newWompi(3), second = await newWompi(3);
      const [linkOwner, refOrder] = refOlder ? [second, first] : [first, second];
      const tx = linkTx(linkOwner.order, { reference: refOrder.order.orderNumber });
      const ev = await postEvent(tx);
      const ol = await fresh(linkOwner.order._id), orf = await fresh(refOrder.order._id);
      return { webhook: ev.status, duenoEnlace: ol.paymentStatus, pedidoDeLaReferencia: orf.paymentStatus, incidenciasPedidoReferencia: orf.incidents.map((i) => i.code) };
    };
    const observed = { duenoEnlaceMasAntiguo: await run(false), referenciaMasAntigua: await run(true) };
    const wrong = [observed.duenoEnlaceMasAntiguo, observed.referenciaMasAntigua].some((c) => c.pedidoDeLaReferencia === "pagado");
    return { verdict: check(!wrong),
      expected: "Un evento con payment_link_id de un pedido nunca debe aplicarse a otro pedido por coincidencia de referencia/sku.", observed };
  });

  // ---------------- P24 ----------------
  await scenario("P24", "Transacción de otro pedido usada para confirmar un pedido diferente", async () => {
    const A = await newWompi(3), B = await newWompi(3);
    const tx = linkTx(A.order);
    await postEvent(tx);
    const replay = await postEvent({ ...tx, payment_link_id: B.order.wompi.paymentLinkId });
    const ob = await fresh(B.order._id);
    // Reconciliación de B con el id de la transacción de A: no hay forma de fijar un id ajeno desde la API.
    const observed = { replayParaB: replay.status, B: ob.paymentStatus, Bstock: ob.stockDeducted };
    return { verdict: check(ob.paymentStatus === "pendiente" && replay.status !== 200 || ob.paymentStatus === "pendiente"), expected: "B no queda pagado.", observed };
  });

  // ---------------- P25 ----------------
  await scenario("P25", "Evento de Sandbox con el backend en modo producción", async () => {
    const { order } = await newWompi(3);
    process.env.WOMPI_ENV = "production";
    let ev;
    try { ev = await postEvent(linkTx(order), { environment: "test" }); } finally { process.env.WOMPI_ENV = "sandbox"; }
    const o = await fresh(order._id);
    return { verdict: check(ev.status === 200 && o.paymentStatus === "pendiente"), expected: "Ignorado.", observed: { webhook: ev.status, paymentStatus: o.paymentStatus } };
  });

  // ---------------- P26 ----------------
  await scenario("P26", "Intento de marcar pagado desde cliente / vendedor / admin (Wompi)", async () => {
    const { order } = await newWompi(3);
    const ev = { reference: "X", receivedAt: new Date().toISOString() };
    const cli = await api("PATCH", `/api/admin/orders/${order._id}/payment`, { cookie: cookies.client, body: ev });
    const ven = await api("PATCH", `/api/admin/orders/${order._id}/payment`, { cookie: cookies.vendor, body: ev });
    const adm = await api("PATCH", `/api/admin/orders/${order._id}/payment`, { cookie: cookies.admin, body: ev });
    const anon = await api("PATCH", `/api/admin/orders/${order._id}/payment`, { body: ev });
    const p = await makeProduct(3);
    const inj = await api("POST", "/api/checkout/orders", { body: orderBody(p, { paymentStatus: "pagado", orderStatus: "pagado", stockDeducted: true, requiresReview: false, wompi: { transactionId: "x", status: "APPROVED" } }) });
    const oi = await fresh(inj.json.order.id);
    const o = await fresh(order._id);
    const observed = { cliente: cli.status, vendedor: ven.status, admin: adm.status, anonimo: anon.status, pedido: o.paymentStatus, inyeccionCheckout: { paymentStatus: oi.paymentStatus, orderStatus: oi.orderStatus, stockDeducted: oi.stockDeducted, tx: oi.wompi.transactionId } };
    const ok = cli.status === 403 && ven.status === 403 && adm.status === 409 && anon.status === 401 && o.paymentStatus === "pendiente" && oi.paymentStatus === "pendiente" && oi.orderStatus === "pago_pendiente" && !oi.wompi.transactionId;
    return { verdict: check(ok), expected: "Nadie fija pagado en Wompi salvo evidencia del proveedor.", observed };
  });

  // ---------------- P27 ----------------
  await scenario("P27", "Consulta/cancelación de pedido ajeno (BOLA/IDOR)", async () => {
    const p = await makeProduct(3);
    const r = await createOrder(p, {}, cookies.client);
    const id = r.json.order.id;
    const other = await api("GET", `/api/checkout/orders/${id}`, { cookie: cookies.client2 });
    const otherCancel = await api("PATCH", `/api/checkout/orders/${id}/cancel`, { cookie: cookies.client2 });
    const noToken = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: r.json.order.orderNumber } });
    const badToken = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: r.json.order.orderNumber, accessToken: "x".repeat(43) } });
    const otherUserLookup = await api("POST", "/api/checkout/orders/lookup", { cookie: cookies.client2, body: { orderNumber: r.json.order.orderNumber } });
    const clientAdmin = await api("GET", `/api/admin/orders/${id}`, { cookie: cookies.client });
    const observed = { getAjeno: other.status, cancelAjeno: otherCancel.status, lookupSinToken: noToken.status, lookupTokenFalso: badToken.status, lookupOtroUsuario: otherUserLookup.status, adminComoCliente: clientAdmin.status };
    return { verdict: check(other.status === 404 && otherCancel.status === 404 && noToken.status === 404 && badToken.status === 404 && otherUserLookup.status === 404 && clientAdmin.status === 403), expected: "404/403.", observed };
  });

  // ---------------- P28 ----------------
  await scenario("P28", "Cancelación antes del pago", async () => {
    const p = await makeProduct(3);
    const r = await createOrder(p, {}, cookies.client);
    const id = r.json.order.id;
    const offered = (await api("GET", `/api/checkout/orders/${id}`, { cookie: cookies.client })).json?.order.canSelfCancel;
    const self = await api("PATCH", `/api/checkout/orders/${id}/cancel`, { cookie: cookies.client });
    const o1 = await fresh(id);
    const adm = await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: cookies.admin, body: { orderStatus: "cancelado" } });
    const o2 = await fresh(id);
    const linkStillActive = provider.links.get(o2.wompi.paymentLinkId)?.active === true;
    const observed = { botonCancelarOfrecidoAlCliente: offered, autocancelacionCliente: self.status, mensaje: self.json?.message, incidenciaTrasIntento: o1.incidents.map((i) => i.code), cancelAdmin: adm.status, estado: o2.orderStatus, incidentes: o2.incidents.map((i) => `${i.code}${i.resolvedAt ? "(resuelta)" : ""}`),
      requiresReviewTrasCancelar: o2.requiresReview, enlaceProveedorActivo: linkStillActive, llamadasDesactivacion: provider.calls.filter((x) => x.method === "PATCH").length };
    // Esperado (sin imponer API no documentada): lo que se ofrece al cliente es ejecutable, y un pedido
    // no pagado cancelado no queda indefinidamente en la bandeja de revisión.
    const ok = o2.orderStatus === "cancelado" && o2.paymentStatus === "pendiente" && !(offered === true && self.status === 409) && !o2.requiresReview;
    return { verdict: check(ok), expected: "Cancelación ofrecida = ejecutable; cancelado sin cobro y sin revisión perpetua.", observed };
  });

  // ---------------- P29 ----------------
  await scenario("P29", "Cancelación después del pago", async () => {
    const p = await makeProduct(3);
    const r = await createOrder(p, {}, cookies.client);
    const order = await fresh(r.json.order.id);
    await postEvent(linkTx(order));
    const self = await api("PATCH", `/api/checkout/orders/${order._id}/cancel`, { cookie: cookies.client });
    const callsBefore = provider.calls.length;
    const adm = await api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie: cookies.admin, body: { orderStatus: "cancelado" } });
    const o = await fresh(order._id);
    const observed = { autocancelacion: self.status, cancelAdmin: adm.status, orderStatus: o.orderStatus, paymentStatus: o.paymentStatus, stock: await stockOf(p), incidents: o.incidents.map((i) => i.code), llamadasProveedor: provider.calls.length - callsBefore };
    const ok = self.status === 409 && adm.status === 200 && o.orderStatus === "cancelado" && o.paymentStatus === "pagado" && observed.stock === 3 && o.incidents.some((i) => i.code === "received_payment_pending_resolution") && observed.llamadasProveedor === 0;
    return { verdict: check(ok), expected: "Cliente no puede; admin cancela, repone stock, deja dinero pendiente de tratamiento manual (sin reembolso automático).", observed };
  });

  // ---------------- P31 / P32 ----------------
  await scenario("P31", "Pedido contraentrega", async () => {
    const p = await makeProduct(3);
    const before = provider.calls.length;
    const r = await createOrder(p, { paymentMethod: "contra_entrega" });
    const o = await fresh(r.json.order.id);
    const prep = await canPrepare(o._id);
    const observed = { status: r.status, paymentUrl: r.json.paymentUrl, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, stock: await stockOf(p), stockDeducted: o.stockDeducted, wompi: o.wompi.paymentLinkId || o.wompi.transactionId || "", llamadasWompi: provider.calls.length - before, notifications: await notifs(o._id), prepare: prep.status };
    const ok = r.status === 201 && !r.json.paymentUrl && o.paymentStatus === "pendiente" && o.orderStatus === "pendiente" && observed.stock === 2 && !observed.wompi && observed.llamadasWompi === 0 && prep.status === 200;
    return { verdict: check(ok), expected: "Sin pago anticipado, no pagado, stock comprometido, sin rastro Wompi, preparable.", observed };
  });
  await scenario("P32", "Contraentrega: recaudo solo tras entrega y con evidencia, solo admin", async () => {
    const p = await makeProduct(3);
    const r = await createOrder(p, { paymentMethod: "contra_entrega" });
    const id = r.json.order.id;
    const ev = { reference: "GIRO-TRANSP-1", receivedAt: new Date(Date.now() - 60000).toISOString() };
    const early = await api("PATCH", `/api/admin/orders/${id}/payment`, { cookie: cookies.admin, body: ev });
    await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: cookies.admin, body: { orderStatus: "en_preparacion" } });
    await api("PATCH", `/api/admin/orders/${id}/shipping`, { cookie: cookies.admin, body: { carrier: "interrapidisimo", trackingNumber: "GUIA123" } });
    await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: cookies.admin, body: { orderStatus: "entregado" } });
    const vend = await api("PATCH", `/api/admin/orders/${id}/payment`, { cookie: cookies.vendor, body: ev });
    const noEv = await api("PATCH", `/api/admin/orders/${id}/payment`, { cookie: cookies.admin, body: {} });
    const ok2 = await api("PATCH", `/api/admin/orders/${id}/payment`, { cookie: cookies.admin, body: ev });
    const o = await fresh(id);
    const observed = { antesDeEntrega: early.status, vendedor: vend.status, sinEvidencia: noEv.status, conEvidencia: ok2.status, orderStatus: o.orderStatus, paymentStatus: o.paymentStatus, referencia: o.collection?.reference };
    return { verdict: check(early.status === 409 && vend.status === 403 && noEv.status === 400 && ok2.status === 200 && o.paymentStatus === "pagado"), expected: "Recaudo controlado.", observed };
  });

  // ---------------- P33 ----------------
  await scenario("P33", "Métodos de pago deshabilitados o inventados", async () => {
    const p = await makeProduct(3);
    const methods = ["nequi_api", "nequi_manual", "efectivo", "tarjeta", "transferencia", "nequi_presencial", "WOMPI", "", null, ["wompi"]];
    const statuses = {};
    for (const m of methods) statuses[JSON.stringify(m)] = (await createOrder(p, { paymentMethod: m, nequiPhone: "3991111111" })).status;
    const nequi = await api("POST", "/api/payments/nequi/webhook", { body: {} });
    const cfg = await api("GET", "/api/checkout/config");
    const ordersCreated = await M.Order.countDocuments({ "items.product": p.product._id });
    // Wompi sin configurar: no se ofrece ni se acepta.
    const saved = process.env.WOMPI_EVENTS_SECRET; process.env.WOMPI_EVENTS_SECRET = "";
    const cfgNo = await api("GET", "/api/checkout/config");
    const noWompi = await createOrder(p, {});
    process.env.WOMPI_EVENTS_SECRET = saved;
    const observed = { statuses, nequiWebhook: nequi.status, ofrecidos: cfg.json.config.paymentMethods.map((m) => m.id), pedidosCreados: ordersCreated, wompiSinConfigurar: { ofrecidos: cfgNo.json.config.paymentMethods.map((m) => m.id), crear: noWompi.status } };
    const ok = Object.values(statuses).every((s) => s === 400) && ordersCreated === 0 && nequi.status === 410 && observed.ofrecidos.join() === "wompi,contra_entrega" && noWompi.status === 400;
    return { verdict: check(ok), expected: "Solo wompi y contra_entrega; resto 400 sin crear pedido; Nequi 410.", observed };
  });

  // ---------------- P34 ----------------
  await scenario("P34", "Última unidad: contraentrega concurrente y Wompi concurrente", async () => {
    const p = await makeProduct(1);
    const cod = await Promise.all([createOrder(p, { paymentMethod: "contra_entrega" }), createOrder(p, { paymentMethod: "contra_entrega" })]);
    const codStock = await stockOf(p);
    const q = await makeProduct(1);
    const w1 = await createOrder(q), w2 = await createOrder(q);
    const o1 = await fresh(w1.json.order.id), o2 = await fresh(w2.json.order.id);
    await Promise.all([postEvent(linkTx(o1)), postEvent(linkTx(o2))]);
    const a = await fresh(o1._id), b = await fresh(o2._id);
    const paidNoStock = [a, b].filter((o) => o.paymentStatus === "pagado" && !o.stockDeducted).map((o) => o.incidents.map((i) => i.code));
    const observed = { contraentrega: { statuses: cod.map((x) => x.status), stock: codStock }, wompi: { creados: [w1.status, w2.status], stockFinal: await stockOf(q), pagados: [a.paymentStatus, b.paymentStatus], pagadosSinStock: paidNoStock.length, incidencias: paidNoStock } };
    // Política existente: Wompi NO reserva stock (checkoutController.js:332-333). Se evalúa la
    // consistencia del inventario y la detección; el cobro excedente se reporta como riesgo residual.
    const ok = cod.filter((x) => x.status === 201).length === 1 && codStock === 0 && observed.wompi.stockFinal === 0
      && paidNoStock.every((codes) => codes.includes("approved_without_stock"));
    return { verdict: check(ok), expected: "Inventario nunca negativo, una sola venta; todo cobro sin stock queda detectado con incidencia.", observed,
      residual: "Dos clientes pueden pagar la misma última unidad; uno queda cobrado sin producto y requiere devolución manual." };
  });

  // ---------------- P35 ----------------
  await scenario("P35", "Inventario agotado durante el checkout y recuperación por conciliación", async () => {
    const { p, order } = await newWompi(1);
    await M.Product.updateOne({ _id: p.product._id, "variants._id": p.variantId }, { $set: { "variants.$.stock": 0 } });
    const tx = linkTx(order);
    provider.tx.set(tx.id, tx);
    await postEvent(tx);
    const o1 = await fresh(order._id);
    await M.Product.updateOne({ _id: p.product._id, "variants._id": p.variantId }, { $set: { "variants.$.stock": 1 } });
    const rec = await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.admin });
    const o2 = await fresh(order._id);
    const observed = { trasAprobacion: { paymentStatus: o1.paymentStatus, stockDeducted: o1.stockDeducted, incidents: o1.incidents.map((i) => i.code) }, conciliacion: rec.status,
      trasConciliar: { orderStatus: o2.orderStatus, stockDeducted: o2.stockDeducted, requiresReview: o2.requiresReview, stock: await stockOf(p) } };
    const ok = o1.paymentStatus === "pagado" && !o1.stockDeducted && o1.incidents.some((i) => i.code === "approved_without_stock") && rec.status === 200 && o2.stockDeducted && !o2.requiresReview && observed.trasConciliar.stock === 0;
    return { verdict: check(ok), expected: "Pago reconocido sin venta parcial; tras reponer, la conciliación completa.", observed };
  });

  // ---------------- P36 ----------------
  await scenario("P36", "Repetición de evento y conciliación con efectos de inventario", async () => {
    const { p, order } = await newWompi(5);
    const tx = linkTx(order);
    provider.tx.set(tx.id, tx);
    await postEvent(tx);
    await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.admin });
    await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.admin });
    await postEvent(tx);
    const observed = { stock: await stockOf(p), ventas: await M.ProductHistory.countDocuments({ referenceId: order._id, eventType: "sale" }) };
    return { verdict: check(observed.stock === 4 && observed.ventas === 1), expected: "Un solo descuento.", observed };
  });

  // ---------------- P37 ----------------
  await scenario("P37", "Señales administrativas de pago (outbox, alertas, bandeja de revisión)", async () => {
    const ok1 = await newWompi(3); await postEvent(linkTx(ok1.order));
    const rev = await newWompi(3); await postEvent(linkTx(rev.order, { amount_in_cents: 5 }));
    const dec = await newWompi(3); await postEvent(linkTx(dec.order, { status: "DECLINED" }));
    const alerts = await api("GET", "/api/admin/alerts", { cookie: cookies.admin });
    const reviewTray = await api("GET", "/api/admin/orders?tray=review&limit=100", { cookie: cookies.admin });
    const inReview = (id) => (reviewTray.json?.orders || []).some((o) => String(o._id || o.id) === String(id));
    const adminN = async (id) => (await M.Notification.find({ order: id, audience: "admin" }).lean()).map((n) => `${n.event}:${n.status}`);
    const observed = { aprobado: await adminN(ok1.order._id), revision: await adminN(rev.order._id), rechazado: await adminN(dec.order._id),
      alertasPendingPaymentsIncluyeRevision: (alerts.json?.alerts?.pendingPayments?.items || alerts.json?.pendingPayments?.items || []).some((o) => o.orderNumber === rev.order.orderNumber),
      bandejaRevision: { revision: inReview(rev.order._id), rechazado: inReview(dec.order._id) }, entregaCorreo: "worker solo con TRANSACTIONAL_NOTIFICATIONS_ENABLED=true (server.js:36); no ejecutado aquí" };
    const ok = observed.aprobado.some((n) => n.startsWith("admin.ready")) && observed.revision.some((n) => n.startsWith("admin.incident")) && observed.bandejaRevision.revision;
    return { verdict: check(ok), expected: "Aprobado → aviso de pedido listo; revisión → incidencia administrativa y bandeja de revisión.", observed };
  });

  // ---------------- P38 ----------------
  await scenario("P38", "Mensaje visible de rechazo (API + función de copia del frontend)", async () => {
    const { order, r } = await newWompi(3);
    await postEvent(linkTx(order, { status: "DECLINED" }));
    const look = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: order.orderNumber, accessToken: r.json.accessToken } });
    const src = fs.readFileSync(path.join(FRONTEND, "src/app/(shop)/pedido/confirmacion/page.js"), "utf8");
    const fnSrc = src.slice(src.indexOf("function confirmationCopy"), src.indexOf("function OrderGlyph"));
    const copy = vm.runInNewContext(`${fnSrc}; confirmationCopy`)(look.json.order);
    const pendingCopy = vm.runInNewContext(`${fnSrc}; confirmationCopy`)({ ...look.json.order, paymentStatus: "pendiente" });
    const observed = { api: look.json?.order.paymentStatus, titulo: copy.title, tono: copy.tone, tituloPendiente: pendingCopy.title, leadPendiente: pendingCopy.lead };
    return { verdict: check(look.json?.order.paymentStatus === "rechazado" && copy.title === "El pago no se completó"), expected: "Rechazo explícito al cliente.", observed };
  });

  // ---------------- P39 ----------------
  await scenario("P39", "Conciliación de pedido pendiente con transacción conocida", async () => {
    const { p, order } = await newWompi(3);
    const tx = linkTx(order, { status: "PENDING" });
    await postEvent(tx);
    provider.tx.set(tx.id, { ...tx, status: "APPROVED" });
    const vend = await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.vendor });
    const rec = await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.admin });
    const o = await fresh(order._id);
    const observed = { vendedor: vend.status, admin: rec.status, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, stock: await stockOf(p) };
    return { verdict: check(vend.status === 403 && rec.status === 200 && o.paymentStatus === "pagado" && observed.stock === 2), expected: "Admin concilia contra el proveedor.", observed };
  });

  // ---------------- X02..X06 ----------------
  await scenario("X02", "Cliente cancela tras DECLINED y luego paga en el mismo enlace (aún activo)", async () => {
    const p = await makeProduct(3);
    const r = await createOrder(p, {}, cookies.client);
    const order = await fresh(r.json.order.id);
    const t1 = linkTx(order, { status: "DECLINED" });
    provider.tx.set(t1.id, t1);
    await postEvent(t1);
    const cancel = await api("PATCH", `/api/checkout/orders/${order._id}/cancel`, { cookie: cookies.client });
    await postEvent(linkTx(order));
    const o = await fresh(order._id);
    const observed = { autocancelacion: cancel.status, orderStatus: o.orderStatus, paymentStatus: o.paymentStatus, incidents: o.incidents.map((i) => i.code), enlaceActivo: provider.links.get(order.wompi.paymentLinkId)?.active };
    return { verdict: check(!(o.orderStatus === "cancelado" && o.paymentStatus === "pagado")), expected: "Un pedido cancelado no debe poder recibir un cobro nuevo por su enlace.", observed };
  });
  await scenario("X03", "Evento Wompi cuya referencia coincide con un pedido contraentrega", async () => {
    const p = await makeProduct(3);
    const r = await createOrder(p, { paymentMethod: "contra_entrega" });
    const o0 = await fresh(r.json.order.id);
    const ev = await postEvent({ id: "tx-" + rnd(4), status: "APPROVED", amount_in_cents: o0.total * 100, currency: "COP", reference: o0.orderNumber, payment_link_id: null });
    const o = await fresh(o0._id);
    return { verdict: check(ev.status === 200 && o.paymentStatus === "pendiente"), expected: "Ignorado.", observed: { webhook: ev.status, paymentStatus: o.paymentStatus } };
  });
  await scenario("X04", "Webhook APPROVED y cancelación administrativa simultáneos", async () => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const { p, order } = await newWompi(3);
      await Promise.all([postEvent(linkTx(order)), api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie: cookies.admin, body: { orderStatus: "cancelado" } })]);
      const o = await fresh(order._id);
      const stock = await stockOf(p);
      out.push({ orderStatus: o.orderStatus, paymentStatus: o.paymentStatus, stockDeducted: o.stockDeducted, stock, consistente: stock === 3 - (o.stockDeducted ? 1 : 0), conIncidencia: o.incidents.some((x) => !x.resolvedAt) });
    }
    return { verdict: check(out.every((x) => x.consistente && x.paymentStatus === "pagado" && (x.orderStatus !== "cancelado" || x.conIncidencia))), expected: "Stock coherente con stockDeducted; pago registrado; cancelación con dinero → incidencia.", observed: out };
  });
  await scenario("X05", "Webhook y conciliación administrativa simultáneos", async () => {
    const { p, order } = await newWompi(3);
    const tx = linkTx(order, { status: "PENDING" });
    await postEvent(tx);
    const appr = { ...tx, status: "APPROVED" };
    provider.tx.set(tx.id, appr);
    const rs = await Promise.all([postEvent(appr), api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: cookies.admin }), postEvent(appr)]);
    const o = await fresh(order._id);
    const observed = { statuses: rs.map((x) => x.status), stock: await stockOf(p), ventas: await M.ProductHistory.countDocuments({ referenceId: order._id, eventType: "sale" }), paymentStatus: o.paymentStatus };
    return { verdict: check(observed.stock === 2 && observed.ventas === 1 && o.paymentStatus === "pagado"), expected: "Un único descuento.", observed };
  });
  await scenario("X06", "Incidencias sin vía de resolución en la API administrativa", async () => {
    const router = fs.readFileSync(path.join(BACKEND, "src/routes/adminOrderRoutes.js"), "utf8");
    const routes = [...router.matchAll(/router\.(get|post|patch|put|delete)\("([^"]+)"/g)].map((m) => `${m[1].toUpperCase()} ${m[2]}`);
    const resolver = routes.filter((r) => /incident|resolve|review/i.test(r));
    const src = fs.readdirSync(path.join(BACKEND, "src/controllers")).map((f) => fs.readFileSync(path.join(BACKEND, "src/controllers", f), "utf8")).join("\n");
    const setsResolved = /resolvedAt\s*(=|:)/.test(src);
    return { verdict: check(resolver.length > 0 || setsResolved), expected: "Existe acción administrativa auditada para cerrar incidencias.", observed: { rutasAdminPedidos: routes, rutasDeResolucion: resolver, controladorFijaResolvedAt: setsResolved } };
  });

  await scenario("X07", "Vigencia del enlace de pago creado", async () => {
    const before = provider.calls.length;
    const { order } = await newWompi(3);
    const call = provider.calls.slice(before).find((c) => c.path === "/v1/payment_links");
    const observed = { expires_atEnviado: call?.body.expires_at ?? null, wompiExpiresAtGuardado: order.wompi.expiresAt, single_use: call?.body.single_use };
    return { verdict: check(observed.expires_atEnviado !== null), expected: "El enlace tiene una vigencia acotada coherente con precio y disponibilidad.", observed };
  });

  // ---------------- P40 ----------------
  await scenario("P40", "Reembolso o anulación en el proveedor", async () => {
    const all = provider.calls.filter((c) => /void|refund/i.test(c.path));
    const srcFiles = [];
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const pth = path.join(d, f); if (fs.statSync(pth).isDirectory()) walk(pth); else if (f.endsWith(".js")) srcFiles.push(pth); } };
    walk(path.join(BACKEND, "src"));
    const hits = srcFiles.filter((f) => /\/void|refund/i.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(BACKEND, f));
    return { verdict: "NOT_APPLICABLE", expected: "Sin función de anulación/reembolso en la aplicación.", observed: { llamadasVoidRefund: all.length, archivosConVoidRefund: hits } };
  });

  const summary = results.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});
  const blockedHosts = [...new Set(provider.blocked)];
  fs.writeFileSync(OUT, JSON.stringify({ fecha: new Date().toISOString(), entorno: { ...env, wompi: "simulado", redExterna: "bloqueada", hostsBloqueados: blockedHosts }, resumen: summary, resultados: results }, null, 2));
  console.log("Resumen:", summary, "hosts externos bloqueados:", blockedHosts);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { if (server) await new Promise((r) => server.close(r)); await mongoose.disconnect(); if (mongod) await mongod.stop(); } catch { /* cierre */ }
});
