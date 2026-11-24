// Standalone local-only fixture derived from the approved Wompi audit harness.
// No dependency on archived documentation. Never reads .env or connects to Atlas.
const path = require("path");
const crypto = require("crypto");
const Module = require("module");
const assert = require("assert/strict");

const ROOT = path.resolve(__dirname, "../../..");
const BACKEND = path.join(ROOT, "backend");
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


module.exports = { setup, api, login, newWompi, makeProduct, createOrder, orderBody, linkTx, postEvent, signEvent, fresh, stockOf, canPrepare, provider, failpoint, mongoose,
 get M() { return M; }, get cookies() { return cookies; }, get users() { return users; },
 async close() { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); if (mongod) await mongod.stop(); }
};
