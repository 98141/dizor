"use strict";

/**
 * Auditoría independiente de cierre — Fase 1 DIZOR.
 * No modifica la aplicación. MongoDB temporal, datos ficticios, red externa bloqueada.
 * Ejecutar desde cualquier cwd con MMS_DIR y MONGOMS_SYSTEM_BINARY.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const crypto = require("crypto");
const { spawn } = require("child_process");
const Module = require("module");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "../../..");
const BACKEND = path.join(ROOT, "backend");
const FRONTEND = path.join(ROOT, "frontend");
const OUT = path.join(__dirname, "independiente-resultados.json");
const MMS = process.env.MMS_DIR;
const MONGO_BIN = process.env.MONGOMS_SYSTEM_BINARY;
if (!MMS || !MONGO_BIN) throw new Error("Faltan MMS_DIR y MONGOMS_SYSTEM_BINARY");

const rnd = (n = 4) => crypto.randomBytes(n).toString("hex");
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "",
  JWT_SECRET: rnd(24),
  JWT_REFRESH_SECRET: rnd(24),
  JWT_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  ADMIN_NOTIFY_EMAIL: "",
  WOMPI_PRIVATE_KEY: "prv_test_ficticia_cierre",
  WOMPI_EVENTS_SECRET: "events_ficticio_" + rnd(8),
  WOMPI_ENV: "sandbox",
  NEQUI_CLIENT_ID: "",
  NEQUI_CLIENT_SECRET: "",
  NEQUI_API_KEY: "",
  NEQUI_WEBHOOK_SECRET: "",
  NEQUI_ENV: "",
  NEQUI_DIRECT_ENABLED: "",
  NEQUI_MANUAL_ENABLED: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  CLOUDINARY_CLOUD_NAME: "",
  CLIENT_URL: "http://127.0.0.1:3000",
  MARKETING_TOKEN_SECRET: rnd(24),
  MARKETING_CART_REMINDERS_ENABLED: "false",
  PQR_PUBLIC_ENABLED: "false",
});

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "winston-daily-rotate-file") {
    const Transport = origLoad("winston-transport", parent, isMain);
    return class NullTransport extends Transport {
      log(_info, cb) { cb(); }
    };
  }
  return origLoad.apply(this, arguments);
};

const blocked = [];
const providerTx = new Map();
let failPaymentLinks = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const raw = typeof input === "string" ? input : input.url;
  const url = new URL(raw);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return realFetch(input, init);
  if (url.hostname === "sandbox.wompi.co" && url.pathname === "/v1/payment_links") {
    if (failPaymentLinks > 0) {
      failPaymentLinks -= 1;
      throw new Error("timeout simulado del proveedor");
    }
    const id = "link_" + rnd(6);
    return new Response(JSON.stringify({ data: { id, expires_at: "2026-12-31 23:00:00" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.hostname === "sandbox.wompi.co" && url.pathname.startsWith("/v1/transactions/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    if (!providerTx.has(id)) throw new Error("proveedor simulado sin esa transacción");
    return new Response(JSON.stringify({ data: providerTx.get(id) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  blocked.push(url.hostname);
  throw new Error("Red saliente bloqueada");
};

const { MongoMemoryReplSet } = require(path.join(MMS, "node_modules", "mongodb-memory-server"));
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
const req = (p) => require(path.join(BACKEND, "src", p));

const results = [];
const record = (id, verdict, detail) => results.push({ id, verdict, detail });

let mongod;
let replUri;
let server;
let base;
let Order;
let Product;
let User;
let Coupon;
let PaymentEvent;
let ProductHistory;
let Category;
let Size;
let Color;
let SpecialRequest;
let cat;
let size;
let color;
let adminCookie;
let vendorCookie;
let clientCookie;
let superCookie;
let clientId;

const leaks = (text) => /E11000|MongoServerError|node_modules|MongoBulkWriteError|\.js:\d+/.test(String(text));

const api = async (method, p, { body, cookie } = {}) => {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* texto */ }
  return { status: res.status, json, text, headers: res.headers };
};

const login = async (email, password) => {
  const r = await api("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, r.text);
  return r.headers?.getSetCookie ? r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") : "";
};

const buyer = (email) => ({ name: "Cliente Ficticio", email, phone: "3000000099" });
const address = { address: "Calle Ficticia 10", city: "Pasto", department: "Nariño" };
const orderBody = (product, variantId, extra = {}) => ({
  items: [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }],
  buyer: buyer(extra.email || `c-${rnd(3)}@example.test`),
  shippingAddress: address,
  paymentMethod: "contra_entrega",
  carrier: "interrapidisimo",
  termsAccepted: true,
  privacyAuthorization: true,
  idempotencyKey: crypto.randomUUID(),
  ...extra,
  buyer: extra.buyer || buyer(extra.email || `c-${rnd(3)}@example.test`),
});

const makeProduct = async (stock, price = 100000) => {
  const product = await Product.create({
    name: "Pieza " + rnd(3),
    category: cat._id,
    salePrice: price,
    internalCost: 424242,
    mainImage: "https://example.test/p.jpg",
    images: [{ url: "https://example.test/p.jpg" }],
    variants: [{ size: size._id, color: color._id, sku: "CI-" + rnd(4).toUpperCase(), stock, isActive: true }],
  });
  return { product, variantId: product.variants[0]._id };
};

const stockOf = async (product, variantId) => {
  const doc = await Product.collection.findOne({ _id: product._id });
  return doc.variants.find((v) => String(v._id) === String(variantId)).stock;
};

const wompiEvent = (tx) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const data = { transaction: tx };
  const chain = properties.map((p) => p.split(".").reduce((v, k) => v?.[k], data)).join("")
    + timestamp + process.env.WOMPI_EVENTS_SECRET;
  const checksum = crypto.createHash("sha256").update(chain).digest("hex").toUpperCase();
  return {
    body: { event: "transaction.updated", data, environment: "test", signature: { properties }, timestamp },
    checksum,
  };
};

const postWompi = async (tx) => {
  const event = wompiEvent(tx);
  return api("POST", "/api/webhooks/wompi", {
    body: event.body,
    cookie: undefined,
    extraChecksum: event.checksum,
  }).catch(() => null);
};

// api() doesn't set checksum header. Dedicated poster:
const postEvent = async (tx, { checksum } = {}) => {
  const event = wompiEvent(tx);
  const res = await fetch(`${base}/api/webhooks/wompi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Event-Checksum": checksum === undefined ? event.checksum : checksum,
    },
    body: JSON.stringify(event.body),
  });
  const text = await res.text();
  return { status: res.status, text };
};

const txFor = (order, extra = {}) => ({
  id: extra.id || `tx-${crypto.randomUUID()}`,
  status: extra.status || "APPROVED",
  amount_in_cents: extra.amount_in_cents === undefined ? Math.round(order.total * 100) : extra.amount_in_cents,
  currency: extra.currency || "COP",
  reference: extra.reference || `ref-${rnd(3)}`,
  sku: order.orderNumber,
});

async function setup() {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  replUri = mongod.getUri();
  assert.match(replUri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(replUri);
  const app = req("app");
  Order = req("models/order");
  Product = req("models/product");
  User = req("models/user");
  Coupon = req("models/coupon");
  PaymentEvent = req("models/paymentEvent");
  ProductHistory = req("models/productHistory");
  Category = req("models/category");
  Size = req("models/size");
  Color = req("models/color");
  SpecialRequest = req("models/specialRequest");
  req("services/orderReceiptService").setReceiptTransport(async () => ({ devMode: false }));
  [cat, size, color] = await Promise.all([
    Category.create({ name: "Cierre " + rnd(2) }),
    Size.create({ name: "U" }),
    Color.create({ name: "Crudo" }),
  ]);
  const pass = "CierrePrueba123";
  await User.create({ name: "Admin Cierre", email: "admin-cierre@example.test", password: pass, role: "admin" });
  await User.create({ name: "Vend Cierre", email: "vend-cierre@example.test", password: pass, role: "vendedor" });
  const client = await User.create({ name: "Cliente Cierre", email: "cliente-cierre@example.test", password: pass, role: "cliente" });
  clientId = client._id;
  await User.create({ name: "Super Cierre", email: "super-cierre@example.test", password: pass, role: "superadmin" });
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = await login("admin-cierre@example.test", pass);
  vendorCookie = await login("vend-cierre@example.test", pass);
  clientCookie = await login("cliente-cierre@example.test", pass);
  superCookie = await login("super-cierre@example.test", pass);
  const info = await mongoose.connection.db.admin().command({ buildInfo: 1 });
  record("entorno", "pass", {
    mongo: info.version,
    autoIndex: mongoose.get("autoIndex"),
    uriHost: "127.0.0.1",
    externalNetwork: "bloqueada",
  });
}

async function scenarioLastUnit() {
  const { product, variantId } = await makeProduct(1);
  const responses = await Promise.all(Array.from({ length: 10 }, () => api("POST", "/api/checkout/orders", { body: orderBody(product, variantId) })));
  const created = responses.filter((r) => r.status === 201);
  const stock = await stockOf(product, variantId);
  const leaked = responses.some((r) => leaks(r.text));
  const ok = created.length === 1 && stock === 0 && !leaked && responses.every((r) => [201, 409, 503, 400].includes(r.status));
  record("I01-ultima-unidad", ok ? "pass" : "fail", {
    statuses: responses.map((r) => r.status),
    created: created.length,
    stock,
    leaked,
    messages: [...new Set(responses.map((r) => r.json?.message).filter(Boolean))],
  });
}

async function scenarioWompiLastUnit() {
  const { product, variantId } = await makeProduct(1);
  const a = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { paymentMethod: "wompi", email: "w1@example.test" }) });
  const b = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { paymentMethod: "wompi", email: "w2@example.test" }) });
  assert.equal(a.status, 201, a.text);
  assert.equal(b.status, 201, b.text);
  const orders = await Order.find({ _id: { $in: [a.json.order.id, b.json.order.id] } });
  const events = await Promise.all(orders.map((order) => postEvent(txFor(order))));
  const after = await Order.find({ _id: { $in: orders.map((o) => o._id) } });
  const stock = await stockOf(product, variantId);
  const deducted = after.filter((o) => o.stockDeducted).length;
  const paid = after.filter((o) => o.paymentStatus === "pagado").length;
  const incident = after.filter((o) => o.incidents.some((i) => i.code === "approved_without_stock" && !i.resolvedAt)).length;
  const ok = events.every((e) => e.status === 200) && stock === 0 && deducted === 1 && paid === 2 && incident === 1;
  record("I02-dos-pagos-ultima-unidad", ok ? "pass" : "fail", {
    statuses: events.map((e) => e.status), stock, deducted, paid, incident,
    states: after.map((o) => ({ status: o.orderStatus, pay: o.paymentStatus, deducted: o.stockDeducted, incidents: o.incidents.map((i) => i.code) })),
  });
}

async function scenarioParallelWebhooks() {
  const { product, variantId } = await makeProduct(6);
  const created = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { paymentMethod: "wompi" }) });
  assert.equal(created.status, 201, created.text);
  const order = await Order.findById(created.json.order.id);
  const tx = txFor(order);
  const burst = await Promise.all(Array.from({ length: 8 }, () => postEvent(tx)));
  const again = await Promise.all(Array.from({ length: 3 }, () => postEvent(tx)));
  const fresh = await Order.findById(order._id);
  const stock = await stockOf(product, variantId);
  const events = await PaymentEvent.countDocuments({ transactionId: tx.id, status: "APPROVED" });
  const ok = stock === 5 && fresh.stockDeducted === true && fresh.paymentStatus === "pagado" && events === 1
    && burst.every((r) => r.status === 200) && again.every((r) => r.status === 200);
  record("I03-webhooks-identicos", ok ? "pass" : "fail", { stock, events, pay: fresh.paymentStatus, burst: burst.map((r) => r.status) });

  const { product: p2, variantId: v2 } = await makeProduct(4);
  const created2 = await api("POST", "/api/checkout/orders", { body: orderBody(p2, v2, { paymentMethod: "wompi" }) });
  const order2 = await Order.findById(created2.json.order.id);
  const approved = txFor(order2, { status: "APPROVED" });
  const declined = { ...approved, status: "DECLINED" };
  const race = await Promise.all([postEvent(approved), postEvent(declined), postEvent(approved), postEvent(declined)]);
  const final = await Order.findById(order2._id);
  const stock2 = await stockOf(p2, v2);
  const raceOk = final.paymentStatus === "pagado" && final.orderStatus !== "cancelado" && stock2 === 3 && final.stockDeducted === true;
  record("I03b-approved-vs-declined-concurrente", raceOk ? "pass" : "fail", {
    race: race.map((r) => r.status), pay: final.paymentStatus, status: final.orderStatus, stock: stock2,
  });
}

async function scenarioStorageRetry() {
  const { product, variantId } = await makeProduct(5);
  const { createOrder } = req("services/orderService");
  const { resolveCartItems, calculateTotals } = req("services/cartService");
  const { getStoreSettings } = req("services/settingsService");
  const items = await resolveCartItems([{ productId: product._id, variantId, quantity: 1 }]);
  const totals = calculateTotals(items, await getStoreSettings(), "Nariño");
  const order = await createOrder({
    user: null, isGuest: true, buyer: buyer("retry@example.test"), shippingAddress: address,
    items, totals, paymentMethod: "wompi", deductStock: false, idempotencyKey: crypto.randomUUID(),
  });
  const tx = txFor(order);
  const original = ProductHistory.create;
  let thrown = 0;
  ProductHistory.create = async function patched(...args) {
    const doc = Array.isArray(args[0]) ? args[0][0] : args[0];
    if (thrown < 1 && doc?.eventType === "sale") {
      thrown += 1;
      throw new Error("storage failed before commit");
    }
    return original.apply(this, args);
  };
  let first;
  let second;
  try {
    first = await postEvent(tx);
    const mid = await Order.findById(order._id);
    const midStock = await stockOf(product, variantId);
    ProductHistory.create = original;
    second = await postEvent(tx);
    const end = await Order.findById(order._id);
    const endStock = await stockOf(product, variantId);
    const sales = await ProductHistory.countDocuments({ referenceId: order._id, eventType: "sale" });
    const openTech = end.incidents.filter((i) => i.code === "payment_processing_failed" && !i.resolvedAt);
    const ok = first.status >= 500 && mid.paymentStatus === "pagado" && midStock === 5 && mid.stockDeducted !== true
      && second.status === 200 && endStock === 4 && end.stockDeducted === true && sales === 1 && openTech.length === 0
      && !leaks(first.text);
    record("I04-reintento-tras-fallo-de-almacenamiento", ok ? "pass" : "fail", {
      first: first.status, second: second.status, midPay: mid.paymentStatus, midStock, endStock, sales,
      firstBody: first.text.slice(0, 180), openTech: openTech.length, thrown,
    });
  } finally {
    ProductHistory.create = original;
  }
}

async function scenarioAmbiguousCheckout() {
  const { product, variantId } = await makeProduct(5);
  const Cart = req("models/cart");
  const original = Cart.findOneAndUpdate;
  Cart.findOneAndUpdate = () => Promise.reject(Object.assign(new Error("fallo carrito"), { isOperational: false }));
  const key = crypto.randomUUID();
  const body = orderBody(product, variantId, { idempotencyKey: key, buyer: buyer("cliente-cierre@example.test") });
  let first;
  let replay;
  let another;
  try {
    first = await api("POST", "/api/checkout/orders", { body, cookie: clientCookie });
    replay = await api("POST", "/api/checkout/orders", { body, cookie: clientCookie });
  } finally {
    Cart.findOneAndUpdate = original;
  }
  another = await api("POST", "/api/checkout/orders", {
    body: { ...body, idempotencyKey: crypto.randomUUID() },
    cookie: clientCookie,
  });
  const orders = await Order.find({ user: clientId, "items.variantId": variantId }).sort({ createdAt: 1 });
  const stock = await stockOf(product, variantId);
  const sameKeyOk = first.status >= 500 && replay.status === 409 && !leaks(first.text) && !leaks(replay.text);
  record("I05-reintento-misma-clave", sameKeyOk ? "pass" : "fail", {
    first: first.status, replay: replay.status, firstMsg: first.json?.message, replayMsg: replay.json?.message,
    orders: orders.length, stock, states: orders.map((o) => o.checkoutState),
  });
  const afterNewKey = await Order.find({ user: clientId, "items.variantId": variantId });
  record("I05b-clave-nueva-tras-fallo-ambiguo", "observation", {
    secondStatus: another.status,
    ordersBefore: orders.length,
    ordersAfter: afterNewKey.length,
    stockBefore: stock,
    stockAfter: await stockOf(product, variantId),
    note: another.status === 201
      ? "Una clave nueva crea otro pedido aunque el primero siga reteniendo stock."
      : "La clave nueva no creó un pedido adicional.",
  });
  for (const order of orders) {
    if (["pendiente", "pago_pendiente"].includes(order.orderStatus)) {
      await api("PATCH", `/api/admin/orders/${order._id}/status`, {
        cookie: adminCookie, body: { orderStatus: "cancelado", note: "cierre de pedido ambiguo" },
      });
    }
  }
  const restored = await stockOf(product, variantId);
  record("I05c-cancelar-pedidos-ambiguos-repone", restored === 5 ? "pass" : "fail", { restored });

  failPaymentLinks = 1;
  const wkey = crypto.randomUUID();
  const wbody = orderBody(product, variantId, { paymentMethod: "wompi", idempotencyKey: wkey, email: "link@example.test" });
  const linkFail = await api("POST", "/api/checkout/orders", { body: wbody });
  const linkRetry = await api("POST", "/api/checkout/orders", { body: wbody });
  const kept = await Order.findOne({ idempotencyKey: wkey });
  const linkOk = linkFail.status === 502 && linkRetry.status === 409 && kept && kept.checkoutState === "failed"
    && kept.stockDeducted !== true && kept.requiresReview === true && !leaks(linkFail.text)
    && !/timeout simulado|sandbox\.wompi/.test(linkFail.text);
  record("I05d-enlace-ambiguo", linkOk ? "pass" : "fail", {
    linkFail: linkFail.status, linkRetry: linkRetry.status, msg: linkFail.json?.message,
    state: kept?.checkoutState, stockDeducted: kept?.stockDeducted, incidents: kept?.incidents?.map((i) => i.code),
  });
}

async function scenarioCancelVersusPayment() {
  const { product, variantId } = await makeProduct(4);
  const created = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { paymentMethod: "wompi" }) });
  assert.equal(created.status, 201, created.text);
  const order = await Order.findById(created.json.order.id);
  const before = await stockOf(product, variantId);
  const tx = txFor(order);
  const [cancelRes, payRes] = await Promise.all([
    api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie: adminCookie, body: { orderStatus: "cancelado", note: "cancelación en carrera" } }),
    postEvent(tx),
  ]);
  const final = await Order.findById(order._id);
  const after = await stockOf(product, variantId);
  const ok = final.orderStatus === "cancelado" && final.paymentStatus === "pagado" && after === before
    && final.stockDeducted !== true
    && final.incidents.some((i) => ["approved_after_cancellation", "received_payment_pending_resolution"].includes(i.code));
  record("I06-cancelacion-y-aprobacion-simultaneas", ok ? "pass" : "fail", {
    cancel: cancelRes.status, pay: payRes.status, status: final.orderStatus, payment: final.paymentStatus,
    stockBefore: before, stockAfter: after, deducted: final.stockDeducted,
    incidents: final.incidents.map((i) => i.code),
  });
}

async function scenarioSelfCancelAndCoupon() {
  const { product, variantId } = await makeProduct(3);
  const coupon = await Coupon.create({ code: "CIERRE" + rnd(2).toUpperCase(), type: "fixed", value: 1000, maxUses: 2 });
  const body = orderBody(product, variantId, {
    buyer: buyer("cliente-cierre@example.test"),
    couponCode: coupon.code,
  });
  const created = await api("POST", "/api/checkout/orders", { body, cookie: clientCookie });
  assert.equal(created.status, 201, created.text);
  const order = await Order.findById(created.json.order.id);
  const usedAfterBuy = (await Coupon.findById(coupon._id)).usedCount;
  const [c1, c2] = await Promise.all([
    api("PATCH", `/api/checkout/orders/${order._id}/cancel`, { cookie: clientCookie }),
    api("PATCH", `/api/checkout/orders/${order._id}/cancel`, { cookie: clientCookie }),
  ]);
  const final = await Order.findById(order._id);
  const stock = await stockOf(product, variantId);
  const restores = await ProductHistory.countDocuments({ referenceId: order._id, quantityChange: { $gt: 0 } });
  const cancelNotes = final.statusHistory.filter((h) => h.status === "cancelado");
  const ok = final.orderStatus === "cancelado" && stock === 3 && restores === 1 && cancelNotes.length === 1
    && String(cancelNotes[0].changedBy) === String(clientId)
    && /cliente/i.test(cancelNotes[0].note)
    && [c1.status, c2.status].sort().join() === "200,409";
  record("I07-cancelaciones-simultaneas", ok ? "pass" : "fail", {
    statuses: [c1.status, c2.status], stock, restores, notes: cancelNotes.length,
    changedBy: String(cancelNotes[0]?.changedBy || ""),
    note: cancelNotes[0]?.note,
  });
  const usedAfterCancel = (await Coupon.findById(coupon._id)).usedCount;
  record("I07b-cupon-tras-cancelar", "observation", {
    usedAfterBuy, usedAfterCancel, maxUses: 2,
    note: usedAfterCancel === 0
      ? "La cancelación liberó el cupón."
      : "La cancelación no libera el uso del cupón.",
  });
}

async function scenarioStockRaces() {
  const { product, variantId } = await makeProduct(8);
  const purchases = Array.from({ length: 5 }, () => api("POST", "/api/checkout/orders", { body: orderBody(product, variantId) }));
  const adjusts = [
    ...Array.from({ length: 3 }, () => api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
      cookie: adminCookie,
      body: { variantId: String(variantId), delta: 1, reason: "entrada ficticia", operationKey: crypto.randomUUID() },
    })),
    ...Array.from({ length: 2 }, () => api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
      cookie: adminCookie,
      body: { variantId: String(variantId), delta: -1, reason: "merma ficticia", operationKey: crypto.randomUUID() },
    })),
  ];
  const responses = await Promise.all([...purchases, ...adjusts]);
  const sales = responses.slice(0, 5).filter((r) => r.status === 201).length;
  const plus = responses.slice(5, 8).filter((r) => r.status === 200).length;
  const minus = responses.slice(8).filter((r) => r.status === 200).length;
  const stock = await stockOf(product, variantId);
  const expected = 8 - sales + plus - minus;
  const history = await ProductHistory.find({ productId: product._id });
  const sum = history.reduce((s, row) => s + (row.quantityChange || 0), 0);
  const ok = stock === expected && stock >= 0 && sum === stock - 8 && responses.every((r) => !leaks(r.text));
  record("I08-ajuste-concurrente-con-compras", ok ? "pass" : "fail", {
    sales, plus, minus, stock, expected, historySum: sum, statuses: responses.map((r) => r.status),
  });

  const key = crypto.randomUUID();
  const pair = await Promise.all([0, 1].map(() => api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
    cookie: adminCookie,
    body: { variantId: String(variantId), delta: 3, reason: "misma operacion", operationKey: key },
  })));
  const after = await stockOf(product, variantId);
  const movements = await ProductHistory.countDocuments({ movementKey: key });
  const keyOk = after === stock + 3 && movements === 1 && pair.some((r) => r.status === 200);
  record("I08b-clave-de-ajuste-reutilizada", keyOk ? "pass" : "fail", {
    pair: pair.map((r) => r.status), delta: after - stock, movements,
  });
  const conflict = await api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
    cookie: adminCookie,
    body: { variantId: String(variantId), delta: 9, reason: "otra operacion", operationKey: key },
  });
  const afterConflict = await stockOf(product, variantId);
  record("I08c-misma-clave-distinto-delta", conflict.status === 409 && afterConflict === after ? "pass" : "fail", {
    status: conflict.status, message: conflict.json?.message, stock: afterConflict,
  });
}

async function scenarioIdempotencyAndHistoryShape() {
  const { product, variantId } = await makeProduct(4);
  const key = crypto.randomUUID();
  const body = orderBody(product, variantId, { idempotencyKey: key, email: "idem@example.test" });
  const first = await api("POST", "/api/checkout/orders", { body });
  const again = await api("POST", "/api/checkout/orders", { body });
  const otherQty = await api("POST", "/api/checkout/orders", {
    body: { ...body, items: [{ productId: String(product._id), variantId: String(variantId), quantity: 2 }] },
  });
  const otherActor = await api("POST", "/api/checkout/orders", { body, cookie: clientCookie });
  const count = await Order.countDocuments({ idempotencyKey: key });
  const stock = await stockOf(product, variantId);
  const ok = first.status === 201 && again.status === 200 && again.json.order.id === first.json.order.id
    && otherQty.status === 409 && otherActor.status === 409 && count === 1 && stock === 3
    && !leaks(otherQty.text);
  record("I09-reutilizacion-de-clave", ok ? "pass" : "fail", {
    first: first.status, again: again.status, otherQty: otherQty.status, otherActor: otherActor.status, count, stock,
    messages: [otherQty.json?.message, otherActor.json?.message],
  });
  const bad = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { idempotencyKey: "corta" }) });
  record("I09b-clave-malformada", bad.status === 400 && !leaks(bad.text) ? "pass" : "fail", { status: bad.status, message: bad.json?.message });

  await Order.collection.insertMany([
    { orderNumber: "DIZ-HIST-NULL-1-" + rnd(2), buyer: { name: "H", email: "h1@example.test", phone: "1" }, items: [], subtotal: 1, total: 1, paymentMethod: "contra_entrega", paymentStatus: "pendiente", orderStatus: "pendiente", idempotencyKey: null },
    { orderNumber: "DIZ-HIST-NULL-2-" + rnd(2), buyer: { name: "H", email: "h2@example.test", phone: "1" }, items: [], subtotal: 1, total: 1, paymentMethod: "contra_entrega", paymentStatus: "pendiente", orderStatus: "pendiente", idempotencyKey: null },
  ]);
  record("I09c-nulos-historicos-conviven", "pass", { note: "Dos documentos con idempotencyKey null cupieron en el índice parcial nuevo." });
}

async function scenarioDuplicateLinesAndFractional() {
  const { product, variantId } = await makeProduct(2);
  const body = orderBody(product, variantId);
  body.items = [
    { productId: String(product._id), variantId: String(variantId), quantity: 1 },
    { productId: String(product._id), variantId: String(variantId), quantity: 1 },
  ];
  const okRes = await api("POST", "/api/checkout/orders", { body });
  const stock = await stockOf(product, variantId);
  const order = okRes.status === 201 ? await Order.findById(okRes.json.order.id) : null;
  const rows = order ? await ProductHistory.find({ referenceId: order._id }).sort({ createdAt: 1 }) : [];
  const chain = rows.every((row, i) => row.stockBefore === (i === 0 ? 2 : rows[i - 1].stockAfter) && row.stockAfter === row.stockBefore + row.quantityChange);
  record("I10-lineas-repetidas-con-stock-suficiente", okRes.status === 201 && stock === 0 && rows.length === 2 && chain ? "pass" : "fail", {
    status: okRes.status, message: okRes.json?.message, stock, rows: rows.map((r) => ({ before: r.stockBefore, change: r.quantityChange, after: r.stockAfter })),
  });

  const { product: p2, variantId: v2 } = await makeProduct(2);
  const partial = orderBody(p2, v2);
  partial.items = [
    { productId: String(p2._id), variantId: String(v2), quantity: 1 },
    { productId: String(p2._id), variantId: String(v2), quantity: 1 },
    { productId: String(p2._id), variantId: String(v2), quantity: 1 },
  ];
  const denied = await api("POST", "/api/checkout/orders", { body: partial });
  const stock2 = await stockOf(p2, v2);
  record("I10b-lineas-repetidas-sin-stock-no-dejan-parcial", [400, 409, 503].includes(denied.status) && stock2 === 2 && !leaks(denied.text) ? "pass" : "fail", {
    status: denied.status, message: denied.json?.message, stock: stock2,
  });

  const { product: p3, variantId: v3 } = await makeProduct(4);
  await Product.collection.updateOne({ _id: p3._id, "variants._id": v3 }, { $set: { "variants.$.stock": 10.5 } });
  const frac = await api("POST", "/api/checkout/orders", { body: orderBody(p3, v3) });
  const adj = await api("POST", `/api/admin/catalog/products/${p3._id}/stock`, {
    cookie: adminCookie,
    body: { variantId: String(v3), delta: 1, reason: "no redondear", operationKey: crypto.randomUUID() },
  });
  const left = await stockOf(p3, v3);
  record("I10c-stock-fraccionario-historico", left === 10.5 && frac.status !== 201 && adj.status === 409 && !leaks(frac.text) && !leaks(adj.text) ? "pass" : "fail", {
    checkout: frac.status, adjust: adj.status, stock: left, checkoutMsg: frac.json?.message, adjustMsg: adj.json?.message,
  });
}

async function scenarioLegacyAndPermissions() {
  const { product, variantId } = await makeProduct(2);
  const legacyNumber = "DIZ-20240115-0007";
  const inserted = await Order.collection.insertOne({
    orderNumber: legacyNumber,
    buyer: { name: "Histórico", email: "historico@example.test", phone: "3001111111" },
    items: [{
      product: product._id, variantId, productName: "Pieza vieja", quantity: 1,
      unitPrice: 90000, lineTotal: 90000, unitCost: 424242,
    }],
    subtotal: 90000, total: 90000,
    paymentMethod: "contra_entrega", paymentStatus: "pendiente", orderStatus: "pagado",
    idempotencyKey: null,
    statusHistory: [{ status: "pagado", note: "registro legado", changedAt: new Date("2024-01-15T15:00:00Z") }],
    createdAt: new Date("2024-01-15T15:00:00Z"),
    updatedAt: new Date("2024-01-15T15:00:00Z"),
  });
  const viewed = await api("GET", `/api/admin/orders/${inserted.insertedId}`, { cookie: adminCookie });
  const prepare = await api("PATCH", `/api/admin/orders/${inserted.insertedId}/status`, {
    cookie: adminCookie, body: { orderStatus: "en_preparacion", note: "intentar preparar legado" },
  });
  const fresh = await Order.findById(inserted.insertedId);
  const legacyOk = viewed.status === 200 && viewed.json.order.orderNumber === legacyNumber
    && viewed.json.order.deliveredAt == null && viewed.json.order.paymentStatus === "pendiente"
    && prepare.status === 409 && fresh.orderStatus === "pagado" && fresh.stockDeducted !== true;
  record("I11-pedido-historico", legacyOk ? "pass" : "fail", {
    view: viewed.status, prepare: prepare.status, message: prepare.json?.message,
    deliveredAt: viewed.json?.order?.deliveredAt, transitions: viewed.json?.order?.allowedTransitions,
  });

  const created = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId) });
  const id = created.json.order.id;
  const vendorView = await api("GET", `/api/admin/orders/${id}`, { cookie: vendorCookie });
  const vendorJson = JSON.stringify(vendorView.json);
  const prep = await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: vendorCookie, body: { orderStatus: "en_preparacion", paymentStatus: "pagado" } });
  const ship = await api("PATCH", `/api/admin/orders/${id}/shipping`, { cookie: vendorCookie, body: { carrier: "servientrega", trackingNumber: "GUIA-CIERRE" } });
  const done = await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: vendorCookie, body: { orderStatus: "entregado", paymentStatus: "pagado" } });
  const collect = await api("PATCH", `/api/admin/orders/${id}/payment`, {
    cookie: vendorCookie, body: { reference: "FALSO", receivedAt: new Date().toISOString() },
  });
  const cancel = await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: vendorCookie, body: { orderStatus: "cancelado" } });
  const back = await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: vendorCookie, body: { orderStatus: "devuelto" } });
  const reconcile = await api("POST", `/api/admin/orders/${id}/reconcile-wompi`, { cookie: vendorCookie, body: { status: "APPROVED" } });
  const finance = await api("GET", "/api/admin/finance/report", { cookie: vendorCookie });
  const catalog = await api("GET", `/api/admin/catalog/products/${product._id}`, { cookie: vendorCookie });
  const adjust = await api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
    cookie: vendorCookie, body: { variantId: String(variantId), delta: 1, reason: "no autorizado", operationKey: crypto.randomUUID() },
  });
  const request = await SpecialRequest.create({
    requestNumber: "SOL-CIERRE-" + rnd(3).toUpperCase(),
    type: "customization",
    contact: { name: "Ana", email: "ana@example.test", phone: "3002222222" },
    productName: "Sombrero a medida",
  });
  const list = await api("GET", "/api/admin/special-requests", { cookie: vendorCookie });
  const updateRequest = await api("PATCH", `/api/admin/special-requests/${request._id}/status`, {
    cookie: vendorCookie, body: { status: "en_revision", note: "toma el pedido especial" },
  });
  const nequi = await api("POST", "/api/payments/nequi/webhook", { body: { status: "APPROVED", orderId: id } });
  const after = await Order.findById(id);
  const permsOk = vendorView.status === 200 && !vendorJson.includes("424242") && !vendorJson.includes("unitCost")
    && prep.status === 200 && ship.status === 200 && done.status === 200
    && after.paymentStatus === "pendiente" && after.orderStatus === "entregado"
    && collect.status === 403 && cancel.status === 403 && back.status === 403
    && reconcile.status === 403 && finance.status === 403 && adjust.status === 403
    && !JSON.stringify(catalog.json).includes("424242")
    && list.status === 200 && updateRequest.status === 200
    && nequi.status === 410;
  record("I12-permisos-vendedor", permsOk ? "pass" : "fail", {
    view: vendorView.status, prep: prep.status, ship: ship.status, done: done.status,
    pay: after.paymentStatus, status: after.orderStatus,
    collect: collect.status, cancel: cancel.status, back: back.status, reconcile: reconcile.status,
    finance: finance.status, adjust: adjust.status, catalogHasCost: JSON.stringify(catalog.json).includes("424242"),
    requests: list.status, requestUpdate: updateRequest.status, nequi: nequi.status,
    transitions: vendorView.json?.order?.allowedTransitions,
  });
}

async function scenarioMoneyEdges() {
  const { product, variantId } = await makeProduct(3);
  const created = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { paymentMethod: "wompi" }) });
  const order = await Order.findById(created.json.order.id);
  const before = await stockOf(product, variantId);
  const badAmount = await postEvent(txFor(order, { amount_in_cents: String(Math.round(order.total * 100)) }));
  const mid = await Order.findById(order._id);
  const prepare = await api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  const manual = await api("PATCH", `/api/admin/orders/${order._id}/payment`, {
    cookie: adminCookie, body: { reference: "MANUAL", receivedAt: new Date().toISOString(), paymentStatus: "pagado" },
  });
  const tampered = txFor(order, { id: "tx-tamper-" + rnd(2), amount_in_cents: 1 });
  const event = wompiEvent(tampered);
  event.body.data.transaction.amount_in_cents = 999;
  const badSig = await postEvent(event.body.data.transaction, { checksum: event.checksum });
  const afterTamper = await Order.findById(order._id);
  const stock = await stockOf(product, variantId);
  const ok = badAmount.status === 200 && mid.paymentStatus === "pagado" && mid.stockDeducted !== true
    && mid.incidents.some((i) => i.code === "payment_amount_or_currency_mismatch")
    && prepare.status === 409 && manual.status === 409 && stock === before
    && badSig.status === 401 && afterTamper.wompi?.transactionId !== tampered.id;
  record("I13-monto-no-numerico-y-firma", ok ? "pass" : "fail", {
    badAmount: badAmount.status, pay: mid.paymentStatus, deducted: mid.stockDeducted,
    incidents: mid.incidents.map((i) => i.code), prepare: prepare.status, manual: manual.status,
    badSig: badSig.status, stock,
  });

  const adminCollectEarly = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId) });
  const early = await api("PATCH", `/api/admin/orders/${adminCollectEarly.json.order.id}/payment`, {
    cookie: adminCookie, body: { reference: "ANTES", receivedAt: new Date().toISOString() },
  });
  record("I13b-recaudo-antes-de-entrega", early.status === 409 ? "pass" : "fail", { status: early.status, message: early.json?.message });
}

async function scenarioCollectionIdempotency() {
  const { product, variantId } = await makeProduct(2);
  const created = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId) });
  const id = created.json.order.id;
  await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  await api("PATCH", `/api/admin/orders/${id}/shipping`, { cookie: adminCookie, body: { carrier: "interrapidisimo", trackingNumber: "G-1" } });
  const delivered = await api("PATCH", `/api/admin/orders/${id}/status`, { cookie: adminCookie, body: { orderStatus: "entregado" } });
  const stillPending = await Order.findById(id);
  const first = await api("PATCH", `/api/admin/orders/${id}/payment`, {
    cookie: adminCookie, body: { reference: "REC-ORIGINAL", receivedAt: new Date(Date.now() - 3600_000).toISOString() },
  });
  const second = await api("PATCH", `/api/admin/orders/${id}/payment`, {
    cookie: adminCookie, body: { reference: "REC-DISTINTA", receivedAt: new Date(Date.now() - 1800_000).toISOString() },
  });
  const final = await Order.findById(id);
  const notes = final.statusHistory.filter((h) => /recaudo/i.test(h.note || ""));
  const ok = delivered.status === 200 && stillPending.paymentStatus === "pendiente" && stillPending.orderStatus === "entregado"
    && first.status === 200 && second.status === 200 && final.collection?.reference === "REC-ORIGINAL" && notes.length === 1;
  record("I14-recaudo-idempotente", ok ? "pass" : "fail", {
    deliveredPay: stillPending.paymentStatus, first: first.status, second: second.status,
    reference: final.collection?.reference, notes: notes.length, secondMessage: second.json?.message,
  });
}

async function scenarioReconcileIgnoresBody() {
  const { product, variantId } = await makeProduct(2);
  const created = await api("POST", "/api/checkout/orders", { body: orderBody(product, variantId, { paymentMethod: "wompi" }) });
  const order = await Order.findById(created.json.order.id);
  order.wompi.transactionId = "tx-consulta-" + rnd(3);
  await order.save();
  providerTx.set(order.wompi.transactionId, {
    id: order.wompi.transactionId, status: "DECLINED", amount_in_cents: Math.round(order.total * 100), currency: "COP", reference: "r",
  });
  const res = await api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, {
    cookie: adminCookie,
    body: { status: "APPROVED", amount_in_cents: Math.round(order.total * 100), currency: "COP" },
  });
  const final = await Order.findById(order._id);
  const stock = await stockOf(product, variantId);
  record("I15-conciliacion-ignora-el-cuerpo", res.status === 200 && final.paymentStatus === "rechazado" && final.stockDeducted !== true && stock === 2 ? "pass" : "fail", {
    status: res.status, pay: final.paymentStatus, orderStatus: final.orderStatus, stock, message: res.json?.message,
  });
}

async function scenarioFinanceGap() {
  const from = new Date(Date.now() - 86_400_000).toISOString();
  const to = new Date(Date.now() + 86_400_000).toISOString();
  const beforeReport = await api("GET", `/api/admin/finance/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: superCookie });
  const beforeHistory = await api("GET", `/api/admin/finance/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: superCookie });
  const baseOrder = {
    buyer: { name: "Fin", email: "fin@example.test", phone: "3003333333" },
    items: [{ product: new mongoose.Types.ObjectId(), variantId: new mongoose.Types.ObjectId(), productName: "Pieza", quantity: 1, unitPrice: 1, lineTotal: 1 }],
    subtotal: 1, paymentMethod: "wompi", paymentStatus: "pagado", createdAt: new Date(), updatedAt: new Date(),
  };
  await Order.collection.insertMany([
    { ...baseOrder, orderNumber: "DIZ-FIN-OK-" + rnd(2), total: 80000, items: [{ ...baseOrder.items[0], unitPrice: 80000, lineTotal: 80000 }], subtotal: 80000, orderStatus: "entregado", requiresReview: false },
    { ...baseOrder, orderNumber: "DIZ-FIN-CAN-" + rnd(2), total: 50000, items: [{ ...baseOrder.items[0], unitPrice: 50000, lineTotal: 50000 }], subtotal: 50000, orderStatus: "cancelado", requiresReview: false },
    { ...baseOrder, orderNumber: "DIZ-FIN-REV-" + rnd(2), total: 30000, items: [{ ...baseOrder.items[0], unitPrice: 30000, lineTotal: 30000 }], subtotal: 30000, orderStatus: "pagado", requiresReview: true },
  ]);
  const afterReport = await api("GET", `/api/admin/finance/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: superCookie });
  const afterHistory = await api("GET", `/api/admin/finance/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: superCookie });
  const reportDelta = (afterReport.json?.sales?.ordersCount || 0) - (beforeReport.json?.sales?.ordersCount || 0);
  const reportMoney = (afterReport.json?.sales?.totalCollected || 0) - (beforeReport.json?.sales?.totalCollected || 0);
  const historyDelta = (afterHistory.json?.summary?.totalOrders || 0) - (beforeHistory.json?.summary?.totalOrders || 0);
  const historyMoney = (afterHistory.json?.summary?.totalRevenue || 0) - (beforeHistory.json?.summary?.totalRevenue || 0);
  const reportOk = reportDelta === 1 && reportMoney === 80000;
  const historyOk = historyDelta === 1 && historyMoney === 80000;
  record("I16-reporte-financiero-conciliado", reportOk ? "pass" : "fail", { reportDelta, reportMoney, before: beforeReport.status });
  record("I16b-historial-financiero-excluye-cancelados-y-disputas", historyOk ? "pass" : "defect", {
    historyDelta, historyMoney, expectedOrders: 1, expectedMoney: 80000,
    note: "GET /api/admin/finance/history sigue contando paymentStatus=pagado sin excluir cancelados ni requiresReview.",
  });
}

async function scenarioIndexesAndStandalone() {
  const indexes = await Order.collection.indexes();
  const idem = indexes.find((i) => i.key?.idempotencyKey);
  const numbers = indexes.filter((i) => i.key?.orderNumber);
  record("I17-indices-vivos", idem?.partialFilterExpression && numbers.length === 1 && numbers[0].unique ? "pass" : "fail", {
    orderNumberIndexes: numbers.map((i) => ({ name: i.name, unique: !!i.unique })),
    idempotency: idem,
  });
  let specialError = null;
  try { await SpecialRequest.init(); } catch (e) { specialError = e.message; }
  record("I17b-indice-solicitudes", "observation", { specialError });

  const lab = mongoose.connection.getClient().db("dizor_index_lab");
  const orders = lab.collection("orders");
  await orders.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true, name: "idempotencyKey_1" });
  await orders.insertOne({ orderNumber: "A", idempotencyKey: null });
  let secondNull = null;
  try { await orders.insertOne({ orderNumber: "B", idempotencyKey: null }); }
  catch (e) { secondNull = e.code; }
  await orders.insertOne({ orderNumber: "C" });
  await orders.insertOne({ orderNumber: "D" });
  let duplicateString = null;
  await orders.insertOne({ orderNumber: "E", idempotencyKey: "clave-historica" });
  try { await orders.insertOne({ orderNumber: "F", idempotencyKey: "clave-historica" }); }
  catch (e) { duplicateString = e.code; }
  let conflict = null;
  try {
    await orders.createIndex({ idempotencyKey: 1 }, {
      unique: true, name: "idempotencyKey_1", partialFilterExpression: { idempotencyKey: { $type: "string" } },
    });
  } catch (e) { conflict = { code: e.code, message: e.message }; }
  const backup = await orders.find({}).toArray();
  await orders.dropIndex("idempotencyKey_1");
  await orders.createIndex({ idempotencyKey: 1 }, {
    unique: true, name: "idempotencyKey_1", partialFilterExpression: { idempotencyKey: { $type: "string" } },
  });
  await orders.insertOne({ orderNumber: "G", idempotencyKey: null });
  let rollback = null;
  try {
    await orders.dropIndex("idempotencyKey_1");
    await orders.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true, name: "idempotencyKey_1" });
  } catch (e) { rollback = { code: e.code, message: e.message }; }
  record("I17c-migracion-de-indice-en-base-temporal", conflict && secondNull && duplicateString && rollback ? "pass" : "fail", {
    secondNull, duplicateString, conflict, backupCount: backup.length, rollback,
  });
}

async function scenarioStandalone() {
  const port = await new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const chosen = probe.address().port;
      probe.close(() => resolve(chosen));
    });
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dizor-standalone-"));
  const proc = spawn(MONGO_BIN, [
    "--port", String(port), "--dbpath", dir, "--bind_ip", "127.0.0.1", "--noauth",
    "--wiredTigerCacheSizeGB", "0.25",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (c) => { log += c.toString(); });
  proc.stderr.on("data", (c) => { log += c.toString(); });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mongod standalone no arrancó")), 20000);
    const look = () => {
      if (/Waiting for connections/.test(log)) { clearTimeout(timer); resolve(); }
    };
    proc.stdout.on("data", look);
    proc.stderr.on("data", look);
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error("mongod salió " + code)); });
  });
  void ready;
  const { inTransaction } = req("services/transactionService");
  let txError = null;
  let count = null;
  try {
    await mongoose.disconnect();
    await mongoose.connect(`mongodb://127.0.0.1:${port}/standalone_probe`, { retryWrites: false });
    const probe = mongoose.connection.collection("probe");
    try {
      await inTransaction(async (session) => {
        await probe.insertOne({ n: 1 }, { session });
      });
    } catch (e) {
      txError = e.message;
    }
    count = await probe.countDocuments();
  } finally {
    await mongoose.disconnect().catch(() => {});
    proc.kill();
    await new Promise((resolve) => proc.once("exit", resolve));
    fs.rmSync(dir, { recursive: true, force: true });
    await mongoose.connect(replUri);
  }
  const source = fs.readFileSync(path.join(BACKEND, "src", "services", "transactionService.js"), "utf8");
  const noFallback = !/catch\s*\(/.test(source) && source.includes("withTransaction");
  record("I18-standalone-sin-fallback", txError && count === 0 && noFallback ? "pass" : "fail", {
    txError, count, noFallback,
  });
}

async function scenarioUiGuards() {
  const orderDetail = fs.readFileSync(path.join(FRONTEND, "src", "components", "admin", "OrderDetail.jsx"), "utf8");
  const productForm = fs.readFileSync(path.join(FRONTEND, "src", "components", "admin", "ProductForm.jsx"), "utf8");
  const checkout = fs.readFileSync(path.join(FRONTEND, "src", "app", "(shop)", "checkout", "page.js"), "utf8");
  const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
  const confirmFn = between(orderDetail, "const handleConfirmPayment", "const handleUpdateStatus");
  const statusFn = between(orderDetail, "const handleUpdateStatus", "const handleUpdateShipping");
  const adjustFn = between(productForm, "const handleStockAdjustment", "const handleSubmit");
  const locked = (fn) => /submittingRef|inFlight|setBusy|setSaving\(true\)/.test(fn);
  const checkoutLocks = checkout.includes("submittingRef");
  const stockReadOnly = productForm.includes("readOnly={!!variant.id}");
  const adjustButton = between(productForm, "handleStockAdjustment(index)", "Registrar ajuste");
  const recaudoButton = between(orderDetail, "handleConfirmPayment", "Registrar recaudo");
  const statusButton = between(orderDetail, "handleUpdateStatus", "Actualizar estado");
  record("I19-checkout-cliente-bloquea-doble-envio", checkoutLocks ? "pass" : "fail", { checkoutLocks });
  record("I19b-stock-absoluto-solo-lectura", stockReadOnly ? "pass" : "fail", { stockReadOnly });
  const unprotected = !locked(confirmFn) && !locked(statusFn) && !locked(adjustFn)
    && !/disabled=/.test(recaudoButton) && !/disabled=/.test(statusButton) && !/disabled=/.test(adjustButton);
  record("I19c-recaudo-y-ajuste-sin-bloqueo-de-reintento", unprotected ? "defect" : "pass", {
    confirmLocked: locked(confirmFn), statusLocked: locked(statusFn), adjustLocked: locked(adjustFn), stockReadOnly,
    note: "El recaudo, el cambio de estado y el ajuste de stock no quedan inhabilitados mientras la solicitud está en curso. Cada clic de ajuste puede generar una clave nueva.",
  });
}

test("auditoría independiente de cierre fase 1", { timeout: 240000 }, async () => {
  try {
    await setup();
    const scenarios = [
      scenarioLastUnit,
      scenarioWompiLastUnit,
      scenarioParallelWebhooks,
      scenarioStorageRetry,
      scenarioAmbiguousCheckout,
      scenarioCancelVersusPayment,
      scenarioSelfCancelAndCoupon,
      scenarioStockRaces,
      scenarioIdempotencyAndHistoryShape,
      scenarioDuplicateLinesAndFractional,
      scenarioLegacyAndPermissions,
      scenarioMoneyEdges,
      scenarioCollectionIdempotency,
      scenarioReconcileIgnoresBody,
      scenarioFinanceGap,
      scenarioIndexesAndStandalone,
      scenarioStandalone,
      scenarioUiGuards,
    ];
    for (const scenario of scenarios) {
      try {
        await scenario();
      } catch (error) {
        record(scenario.name, "fail", { error: error.stack?.split("\n").slice(0, 6).join(" | ") });
      }
    }
    record("red", blocked.length === 0 ? "pass" : "fail", { blocked });
  } finally {
    fs.writeFileSync(OUT, JSON.stringify({
      date: "2026-11-20",
      mongoBinary: MONGO_BIN,
      results,
    }, null, 2));
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect().catch(() => {});
    if (mongod) await mongod.stop().catch(() => {});
  }
  const problems = results.filter((r) => r.verdict === "fail" || r.verdict === "defect");
  assert.equal(problems.length, 0, JSON.stringify(problems, null, 2));
});
