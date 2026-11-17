// Pruebas de integración aisladas — correcciones de privacidad DIZOR.
// Entorno: MongoDB en memoria (127.0.0.1, efímera), sin .env del proyecto,
// sin claves de Resend/Wompi/Nequi/Cloudinary, red saliente bloqueada.
// Datos 100 % sintéticos (dominio reservado .test).
"use strict";

const path = require("path");
const crypto = require("crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

const BACKEND = process.env.DIZOR_BACKEND_DIR;
if (!BACKEND) throw new Error("Falta DIZOR_BACKEND_DIR");

// ── 1. Entorno explícito ANTES de cargar la app (dotenv no sobrescribe) ────
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
  WOMPI_PRIVATE_KEY: "",
  WOMPI_EVENTS_SECRET: "",
  NEQUI_CLIENT_ID: "",
  NEQUI_CLIENT_SECRET: "",
  NEQUI_API_KEY: "",
  NEQUI_WEBHOOK_SECRET: "",
  NEQUI_ENV: "",
  NEQUI_DIRECT_ENABLED: "",
  NEQUI_MANUAL_ENABLED: "",
  WOMPI_ENV: "sandbox",
  MARKETING_CART_REMINDERS_ENABLED: "false",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  CLIENT_URL: "http://localhost:3000",
  MARKETING_TOKEN_SECRET: rnd(32),
  PQR_PUBLIC_ENABLED: "true",
  // Fase 3: los textos vigentes son "published"; el permiso de prueba para
  // borradores queda apagado (solo se activa en la prueba que lo comprueba).
  CONSENT_ACCEPT_DRAFT_FOR_TESTS: "false",
  ORDER_DELIVERY_TIME_TEXT: "",
  // Modo antiguo en BD: la prueba comprueba que "envío incluido" prevalece.
  SHIPPING_MODE: "free_threshold",
  SHIPPING_FIXED_COST: "15000",
  FREE_SHIPPING_MIN: "200000",
});

// ── 2. Bloqueo de red saliente: solo 127.0.0.1/localhost ───────────────────
const blockedRequests = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    blockedRequests.push(url.hostname);
    return Promise.reject(new Error(`Red saliente bloqueada en pruebas: ${url.hostname}`));
  }
  return realFetch(input, init);
};

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
const req = (p) => require(path.join(BACKEND, "src", p));

let mongod, server, base;
let app, Order, ConsentRecord, AbandonedCart, NewsletterSubscriber, MarketingSuppression,
  CustomerRequest, User, Product, Category, WeaveType, Style, Size, Color;
let receiptService, marketingService, redactUrl, contactWindow;
const sentReceipts = [];
const capturedLogs = [];
// Valores que NUNCA deben aparecer en logs (se van añadiendo en las pruebas).
const sensitiveValues = new Set();
let product, variantId;

const api = async (method, urlPath, { body, cookies } = {}) => {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* CSV u otro */ }
  // Registrar como sensibles: correos y tokens enviados o recibidos.
  const collect = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && (/email|token|accessCode|password/i.test(k) || v.includes("@example.test"))) {
        if (v.length >= 6) sensitiveValues.add(v);
      } else if (typeof v === "object") collect(v);
    }
  };
  collect(body);
  collect(json);
  return { status: res.status, json, text, headers: res.headers };
};

const cookieHeader = (res) =>
  res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const login = async (email, password) => {
  const res = await api("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(res.status, 200, `login ${email}: ${res.text}`);
  return cookieHeader(res);
};

const guestOrderBody = (extra = {}) => ({
  items: [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }],
  buyer: { name: "Comprador Prueba", email: "comprador@example.test", phone: "3000000000" },
  shippingAddress: { address: "Calle Ficticia 1", city: "Pasto", department: "Nariño" },
  paymentMethod: "contra_entrega",
  carrier: "interrapidisimo",
  termsAccepted: true,
  idempotencyKey: crypto.randomUUID(),
  ...extra,
});

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  assert.equal(new URL(uri.replace("mongodb://", "http://")).hostname, "127.0.0.1");
  await mongoose.connect(uri);
  assert.equal(mongoose.connection.host, "127.0.0.1", "La BD de pruebas debe ser local");

  app = req("app");
  Order = req("models/order");
  ConsentRecord = req("models/consentRecord");
  AbandonedCart = req("models/abandonedCart");
  NewsletterSubscriber = req("models/newsletterSubscriber");
  MarketingSuppression = req("models/marketingSuppression");
  CustomerRequest = req("models/customerRequest");
  User = req("models/user");
  Product = req("models/product");
  Category = req("models/category");
  WeaveType = req("models/weaveType");
  Style = req("models/style");
  Size = req("models/size");
  Color = req("models/color");
  receiptService = req("services/orderReceiptService");
  marketingService = req("services/marketingService");
  redactUrl = req("utils/redactUrl").redactUrl;
  contactWindow = req("utils/contactWindow");

  receiptService.setReceiptTransport(async (msg) => {
    sentReceipts.push(msg);
    return { devMode: true };
  });

  // Captura TODO lo que el backend escribe en logs (winston + consola) para
  // comprobar al final que no contiene tokens ni datos personales.
  const { Writable } = require("stream");
  const winston = require(path.join(BACKEND, "node_modules", "winston"));
  const logger = req("lib/logger");
  logger.add(new winston.transports.Stream({
    stream: new Writable({ write(chunk, _enc, cb) { capturedLogs.push(String(chunk)); cb(); } }),
  }));
  for (const m of ["log", "info", "warn", "error"]) {
    const orig = console[m].bind(console);
    console[m] = (...args) => { capturedLogs.push(args.map(String).join(" ")); orig(...args); };
  }

  const [cat, weave, style, size, color] = await Promise.all([
    Category.create({ name: "Cat Prueba" }),
    WeaveType.create({ name: "Tejido Prueba" }),
    Style.create({ name: "Horma Prueba" }),
    Size.create({ name: "M" }),
    Color.create({ name: "Natural" }),
  ]);
  product = await Product.create({
    name: "Sombrero Ficticio",
    category: cat._id,
    weaveType: weave._id,
    style: style._id,
    salePrice: 100000,
    mainImage: "https://example.test/img.jpg",
    images: [{ url: "https://example.test/img.jpg", alt: "x" }],
    variants: [{ size: size._id, color: color._id, sku: "TEST-M", stock: 50, isActive: true }],
    isActive: true,
  });
  variantId = product.variants[0]._id;

  await User.create({ name: "Admin Prueba", email: "admin@example.test", password: "AdminPrueba123", role: "admin" });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  // Espera breve para que winston vacíe sus transportes.
  await new Promise((r) => setTimeout(r, 200));
  const all = capturedLogs.join("\n");
  const leaked = [...sensitiveValues].filter((v) => v && all.includes(v));
  assert.deepEqual(leaked, [], `Valores sensibles en logs: ${leaked.length}`);
  assert.ok(capturedLogs.length > 20, "se capturaron logs (la comprobación no es vacía)");
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  assert.deepEqual(blockedRequests, [], `Intentos de red saliente: ${blockedRequests.join(", ")}`);
});

// ── Textos legales ─────────────────────────────────────────────────────────
test("GET /api/legal/notices: textos definitivos versionados, términos obligatorios, sin marcas", async () => {
  const r = await api("GET", "/api/legal/notices");
  assert.equal(r.status, 200);
  const n = r.json.notices;
  for (const [purpose, t] of Object.entries(n)) {
    assert.equal(t.status, "published", `${purpose} publicado`);
    assert.ok(t.version, `${purpose} con versión`);
    assert.ok(!/PLACEHOLDER|revisi[oó]n|borrador|pendiente|NO PUBLICAR/i.test(t.label), `${purpose} sin marcas`);
  }
  assert.equal(n.order_processing.version, "2");
  assert.match(n.order_processing.label, /COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS/);
  assert.equal(n.marketing_newsletter.required, false);
  assert.equal(n.marketing_cart_reminder.required, false);
  assert.equal(n.terms.required, true);
  assert.equal(n.terms.version, "1");
  assert.equal(n.terms.policyPath, "/terminos-y-condiciones");
});

// ── Checkout, acuse y confirmación (H-03, H-06, H-19, H-20) ────────────────
let orderNumber, accessToken, idemKey;

test("checkout sin autorización de tratamiento → 400 y no crea pedido", async () => {
  const before = await Order.countDocuments();
  const r = await api("POST", "/api/checkout/orders", { body: guestOrderBody() });
  assert.equal(r.status, 400);
  assert.equal(await Order.countDocuments(), before);
});

test("checkout sin aceptar términos (o con 'true' en texto) → 400 y no crea pedido", async () => {
  const before = await Order.countDocuments();
  for (const termsAccepted of [undefined, false, "true"]) {
    const r = await api("POST", "/api/checkout/orders", {
      body: guestOrderBody({ privacyAuthorization: true, termsAccepted }),
    });
    assert.equal(r.status, 400, `termsAccepted=${termsAccepted}`);
    assert.match(r.json.message, /Términos y condiciones/);
  }
  assert.equal(await Order.countDocuments(), before);
});

test("checkout con autorización 'true' en texto no cuenta como autorización", async () => {
  const r = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: "true" }),
  });
  assert.equal(r.status, 400);
});

test("checkout con autorización → pedido, evidencia, token y acuse único", async () => {
  const body = guestOrderBody({ privacyAuthorization: true, textVersion: "inventada-por-cliente" });
  idemKey = body.idempotencyKey;
  const r = await api("POST", "/api/checkout/orders", { body });
  assert.equal(r.status, 201, r.text);
  assert.ok(r.json.accessToken && r.json.accessToken.length >= 32);
  assert.ok(!r.text.includes("comprador@example.test"), "la respuesta no devuelve el correo");
  orderNumber = r.json.order.orderNumber;
  accessToken = r.json.accessToken;

  const order = await Order.findOne({ orderNumber }).select("+guestAccess.tokenHash +guestAccess.expiresAt");
  assert.equal(order.legal.privacyNoticeVersion, "2");
  assert.equal(order.legal.privacyNoticeStatus, "published");
  assert.equal(order.legal.termsVersion, "1");
  assert.equal(order.legal.termsStatus, "published");
  assert.equal(order.legal.deliveryTermsText, null, "plazo no definido → no se registra promesa");
  // Contraentrega: nunca pagado al crear.
  assert.equal(order.paymentStatus, "pendiente");
  assert.notEqual(order.orderStatus, "pagado");
  // Envío incluido en el precio aunque la BD conserve "free_threshold".
  assert.equal(order.shippingIncluded, true);
  assert.equal(order.shippingCost, 0);
  assert.equal(order.freeShippingApplied, false);
  assert.equal(order.total, 100000, "total = precio del producto, sin cargo de envío");
  assert.ok(order.guestAccess.tokenHash && order.guestAccess.tokenHash !== accessToken);
  assert.ok(order.guestAccess.expiresAt > new Date());
  assert.ok(order.buyerReceipt.sentAt, "acuse marcado como enviado");

  const rec = await ConsentRecord.findOne({ referenceType: "Order", referenceId: order._id, purpose: "order_processing" }).lean();
  assert.equal(rec.purpose, "order_processing");
  assert.equal(rec.textVersion, "2", "versión fijada por el servidor, no por el cliente");
  assert.equal(rec.textStatus, "published");
  const termsRec = await ConsentRecord.findOne({ referenceType: "Order", referenceId: order._id, purpose: "terms" }).lean();
  assert.ok(termsRec, "aceptación de términos registrada");
  assert.equal(termsRec.textVersion, "1");
  assert.equal(rec.subjectEmail, "comprador@example.test");
  assert.ok(rec.recordedAt instanceof Date);
  assert.equal(rec.ip, undefined);

  assert.equal(sentReceipts.length, 1);
  const msg = sentReceipts[0];
  assert.equal(msg.to, "comprador@example.test");
  for (const needle of [orderNumber, "Precio unitario", "Total", "Forma de pago", "Pago pendiente", "Tiempo de entrega", "Sombrero Ficticio", "Incluido en el precio", "901.027.825-5", "COMERCIALIZADORA DE ARTESANIAS", "Pagarás el total al recibir"]) {
    assert.ok(msg.html.includes(needle), `acuse contiene "${needle}"`);
  }
  assert.ok(!/baja|unsubscribe/i.test(msg.html), "acuse transaccional sin enlace comercial de baja");
});

test("reintento con la misma clave: mismo pedido, sin segundo acuse, token rotado", async () => {
  const r = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: true, idempotencyKey: idemKey }),
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.order.orderNumber, orderNumber);
  assert.equal(sentReceipts.length, 1, "no se duplica el acuse");
  assert.equal(await Order.countDocuments({ orderNumber }), 1);

  const old = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber, accessToken } });
  assert.equal(old.status, 404, "el token anterior deja de servir");
  accessToken = r.json.accessToken;
});

test("confirmación: token válido → datos; token/pedido ajeno → 404 genérico", async () => {
  const ok = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber, accessToken } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.order.paymentStatus, "pendiente");
  assert.equal(ok.json.order.items[0].unitPrice, 100000);
  assert.equal(ok.json.order.receiptSent, true);
  assert.equal(ok.json.order.shippingAddress, undefined, "no expone la dirección");

  const bad = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber, accessToken: "x".repeat(64) } });
  assert.equal(bad.status, 404);

  const other = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: true, buyer: { name: "Otra", email: "otra@example.test", phone: "3000000001" } }),
  });
  assert.equal(other.status, 201);
  const cross = await api("POST", "/api/checkout/orders/lookup", {
    body: { orderNumber: other.json.order.orderNumber, accessToken },
  });
  assert.equal(cross.status, 404, "mi token no abre el pedido de otra persona");
});

test("token vencido → 404", async () => {
  await Order.updateOne({ orderNumber }, { $set: { "guestAccess.expiresAt": new Date(Date.now() - 1000) } });
  const r = await api("POST", "/api/checkout/orders/lookup", { body: { orderNumber, accessToken } });
  assert.equal(r.status, 404);
});

test("acuse: fallo del proveedor libera la reclamación y permite reintentar una sola vez", async () => {
  const o = await Order.findOne({ orderNumber });
  await Order.updateOne({ _id: o._id }, { $set: { "buyerReceipt.claimedAt": null, "buyerReceipt.sentAt": null } });
  receiptService.setReceiptTransport(async () => { throw new Error("proveedor caído"); });
  const fail = await receiptService.sendOrderReceiptOnce(o._id);
  assert.deepEqual(fail, { sent: false, reason: "provider_error" });
  const after = await Order.findById(o._id);
  assert.equal(after.buyerReceipt.claimedAt, null);
  assert.match(after.buyerReceipt.lastError, /proveedor caído/);

  let calls = 0;
  receiptService.setReceiptTransport(async () => { calls += 1; });
  const [a, b] = await Promise.all([
    receiptService.sendOrderReceiptOnce(o._id),
    receiptService.sendOrderReceiptOnce(o._id),
  ]);
  assert.equal(calls, 1, "envíos concurrentes no duplican el acuse");
  assert.equal([a, b].filter((x) => x.sent).length, 1);
  receiptService.setReceiptTransport(async (msg) => { sentReceipts.push(msg); });
});

test("seguimiento: POST con correo en el cuerpo; GET antiguo → 410", async () => {
  const ok = await api("POST", "/api/checkout/track", { body: { orderNumber, email: "comprador@example.test" } });
  assert.equal(ok.status, 200);
  const wrong = await api("POST", "/api/checkout/track", { body: { orderNumber, email: "nadie@example.test" } });
  assert.equal(wrong.status, 404);
  const legacy = await api("GET", `/api/checkout/track?orderNumber=${orderNumber}&email=comprador%40example.test`);
  assert.equal(legacy.status, 410);
});

test("redacción de URLs en logs", () => {
  const out = redactUrl("/api/checkout/track?orderNumber=DZ-1&email=comprador%40example.test&page=2");
  assert.ok(!out.includes("comprador"));
  assert.match(out, /email=\[redactado\]/);
  assert.match(out, /orderNumber=\[redactado\]/);
  assert.match(out, /page=2/);
});

// ── Registro y carrito (H-03, H-05) ────────────────────────────────────────
let clientCookies;

test("registro sin autorización → 400; con autorización → evidencia", async () => {
  const no = await api("POST", "/api/auth/register", {
    body: { name: "Cliente Prueba", email: "cliente@example.test", password: "ClientePrueba123" },
  });
  assert.equal(no.status, 400);
  assert.equal(await User.countDocuments({ email: "cliente@example.test" }), 0);

  const yes = await api("POST", "/api/auth/register", {
    body: { name: "Cliente Prueba", email: "cliente@example.test", password: "ClientePrueba123", privacyAuthorization: true },
  });
  assert.equal(yes.status, 201, yes.text);
  clientCookies = cookieHeader(yes);
  const rec = await ConsentRecord.findOne({ purpose: "account", subjectEmail: "cliente@example.test" });
  assert.ok(rec);
});

test("usuario registrado que sincroniza carrito NO queda inscrito en recordatorios", async () => {
  const r = await api("PUT", "/api/cart/sync", {
    cookies: clientCookies,
    body: { items: [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }] },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(await AbandonedCart.countDocuments({ email: "cliente@example.test" }), 0);
});

// ── Newsletter, baja y exportación (H-04) ──────────────────────────────────
let adminCookies;

test("newsletter: sin autorización → 400; con autorización → evidencia", async () => {
  const no = await api("POST", "/api/marketing/newsletter", { body: { email: "news@example.test" } });
  assert.equal(no.status, 400);
  assert.equal(await NewsletterSubscriber.countDocuments({ email: "news@example.test" }), 0);

  const yes = await api("POST", "/api/marketing/newsletter", {
    body: { email: "news@example.test", source: "footer", marketingConsent: true },
  });
  assert.equal(yes.status, 201, yes.text);
  const sub = await NewsletterSubscriber.findOne({ email: "news@example.test" });
  assert.ok(sub.lastConsentRecord);
});

test("exportación: excluye suscriptores sin evidencia (heredados) e incluye enlace de baja", async () => {
  await NewsletterSubscriber.create({ email: "heredado@example.test", source: "footer" });
  adminCookies = await login("admin@example.test", "AdminPrueba123");
  const r = await api("GET", "/api/admin/marketing/newsletter/export", { cookies: adminCookies });
  assert.equal(r.status, 200);
  assert.ok(r.text.includes("news@example.test"));
  assert.ok(!r.text.includes("heredado@example.test"), "sin evidencia → no se exporta");
  assert.ok(await NewsletterSubscriber.exists({ email: "heredado@example.test" }), "pero no se borra");
  assert.match(r.text, /http:\/\/localhost:3000\/baja\?t=/);
});

test("baja por token: sin sesión, idempotente, registrada y respetada en exportación", async () => {
  const sub = await NewsletterSubscriber.findOne({ email: "news@example.test" });
  const token = marketingService.getNewsletterUnsubscribeToken(sub._id);
  assert.ok(!token.includes("news@"), "el token no contiene el correo");

  const r1 = await api("POST", "/api/marketing/unsubscribe", { body: { token } });
  assert.equal(r1.status, 200, r1.text);
  const r2 = await api("POST", "/api/marketing/unsubscribe", { body: { token } });
  assert.equal(r2.status, 200, "repetir la baja no falla");
  assert.equal(await MarketingSuppression.countDocuments({ email: "news@example.test" }), 1);
  assert.equal(await ConsentRecord.countDocuments({ subjectEmail: "news@example.test", action: "revoked" }), 1);

  const bad = await api("POST", "/api/marketing/unsubscribe", { body: { token: `${token.slice(0, -2)}xx` } });
  assert.equal(bad.status, 400, "token manipulado rechazado");

  const exp = await api("GET", "/api/admin/marketing/newsletter/export", { cookies: adminCookies });
  assert.ok(!exp.text.includes("news@example.test"));
});

// ── Recordatorios de carrito (H-05) ────────────────────────────────────────
test("F3-M1: recordatorios desactivados por defecto: no se muestra, no se guarda, no se envía", async () => {
  assert.equal(process.env.MARKETING_CART_REMINDERS_ENABLED, "false");
  const cfg = await api("GET", "/api/marketing/config");
  assert.equal(cfg.status, 200);
  assert.equal(cfg.json.config.cartReminders.enabled, false, "el formulario no se ofrece");
  const items = [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }];
  const before = await ConsentRecord.countDocuments({ purpose: "marketing_cart_reminder" });
  const r = await api("POST", "/api/marketing/abandoned-cart", {
    body: { email: "desactivado@example.test", items, marketingConsent: true },
  });
  assert.equal(r.status, 503);
  assert.equal(await AbandonedCart.countDocuments({ email: "desactivado@example.test" }), 0);
  assert.equal(await ConsentRecord.countDocuments({ purpose: "marketing_cart_reminder" }), before);
  const send = await marketingService.sendDueAbandonedReminders({ now: new Date("2026-11-17T15:00:00Z") });
  assert.equal(send.reason, "feature_disabled");
  const adminSend = await api("POST", "/api/admin/marketing/abandoned-carts/send-reminders", { cookies: adminCookies });
  assert.equal(adminSend.status, 409);
});

test("recordatorio de invitado: exige autorización; envío respeta franja, baja y evidencia", async () => {
  // La función existe y se prueba habilitándola solo en este entorno aislado.
  process.env.MARKETING_CART_REMINDERS_ENABLED = "true";
  const items = [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }];
  const no = await api("POST", "/api/marketing/abandoned-cart", { body: { email: "carro@example.test", items } });
  assert.equal(no.status, 400);

  const yes = await api("POST", "/api/marketing/abandoned-cart", {
    body: { email: "carro@example.test", items, marketingConsent: true },
  });
  assert.equal(yes.status, 200, yes.text);
  assert.ok(!yes.text.includes("carro@example.test"));

  // Carrito heredado sin evidencia: nunca debe recibir correo.
  await AbandonedCart.create({ email: "heredado-carro@example.test", items: [], itemCount: 1, subtotal: 1 });

  const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  await AbandonedCart.collection.updateMany({}, { $set: { updatedAt: old } });

  // Martes 10:00 hora Colombia = 15:00 UTC.
  const tuesday = new Date("2026-11-17T15:00:00Z");
  const sunday = new Date("2026-11-22T15:00:00Z");
  assert.equal(contactWindow.isWithinCommercialWindow(tuesday), true);
  assert.equal(contactWindow.isWithinCommercialWindow(sunday), false);
  assert.equal(contactWindow.isWithinCommercialWindow(new Date("2026-11-17T01:00:00Z")), false, "20:00 lunes");

  const outside = await marketingService.sendDueAbandonedReminders({ now: sunday });
  assert.equal(outside.reason, "outside_contact_window");

  const secret = process.env.MARKETING_TOKEN_SECRET;
  process.env.MARKETING_TOKEN_SECRET = "";
  const noSecret = await marketingService.sendDueAbandonedReminders({ now: tuesday });
  assert.equal(noSecret.reason, "unsubscribe_not_configured");
  process.env.MARKETING_TOKEN_SECRET = secret;

  const first = await marketingService.sendDueAbandonedReminders({ now: tuesday });
  assert.equal(first.sent, 1, JSON.stringify(first));
  const heredado = await AbandonedCart.findOne({ email: "heredado-carro@example.test" });
  assert.equal(heredado.remindersSent, 0, "el carrito sin evidencia no recibe correo");

  // Baja desde el enlace del correo y nuevo ciclo: no se envía.
  const cart = await AbandonedCart.findOne({ email: "carro@example.test" });
  const token = require(path.join(BACKEND, "src/utils/opaqueTokens")).createUnsubscribeToken("marketing_cart_reminder", cart._id);
  const un = await api("POST", "/api/marketing/unsubscribe", { body: { token } });
  assert.equal(un.status, 200);
  await AbandonedCart.collection.updateMany({}, { $set: { updatedAt: old, lastReminderAt: old } });
  const second = await marketingService.sendDueAbandonedReminders({ now: tuesday });
  assert.equal(second.sent, 0, "la baja se respeta en recordatorios ya encolados");
  process.env.MARKETING_CART_REMINDERS_ENABLED = "false";
});

test("evidencias: 'published' autoriza; las de borrador ('Texto en revisión') NO se regularizan", async () => {
  const { hasValidMarketingConsent, recordConsent } = req("services/consentService");
  await recordConsent({ purpose: "marketing_newsletter", subjectEmail: "vigente@example.test", source: "test" });
  assert.equal(await hasValidMarketingConsent("vigente@example.test", "marketing_newsletter"), true);
  // Evidencia histórica de la fase 1 (texto en borrador).
  await ConsentRecord.create({
    purpose: "marketing_newsletter", action: "granted", textVersion: "2026-11-16-draft-1",
    textStatus: "draft", subjectEmail: "draft@example.test", source: "test",
  });
  assert.equal(await hasValidMarketingConsent("draft@example.test", "marketing_newsletter"), false);
  process.env.CONSENT_ACCEPT_DRAFT_FOR_TESTS = "true";
  assert.equal(await hasValidMarketingConsent("draft@example.test", "marketing_newsletter"), true, "solo con el permiso de prueba");
  process.env.CONSENT_ACCEPT_DRAFT_FOR_TESTS = "false";
  // El registro histórico se conserva intacto.
  assert.equal((await ConsentRecord.findOne({ subjectEmail: "draft@example.test" })).textStatus, "draft");
});

test("ConsentRecord es inmutable", async () => {
  await assert.rejects(ConsentRecord.updateOne({}, { $set: { action: "revoked" } }));
  await assert.rejects(ConsentRecord.deleteMany({}));
});

// ── Solicitudes especiales y reseñas (H-03, H-14, H-28) ────────────────────
test("solicitud especial: autorización obligatoria; seguimiento POST; GET → 410", async () => {
  const body = {
    type: "customization",
    name: "Persona Prueba",
    email: "solicitud@example.test",
    phone: "3000000002",
    customizationDetails: "Cinta personalizada de prueba",
  };
  const no = await api("POST", "/api/special-requests", { body });
  assert.equal(no.status, 400);
  const yes = await api("POST", "/api/special-requests", { body: { ...body, privacyAuthorization: true } });
  assert.equal(yes.status, 201, yes.text);
  const num = yes.json.request.requestNumber;
  assert.ok(await ConsentRecord.exists({ purpose: "special_request", subjectEmail: "solicitud@example.test" }));

  const t = await api("POST", "/api/special-requests/track", { body: { requestNumber: num, email: "solicitud@example.test" } });
  assert.equal(t.status, 200);
  const legacy = await api("GET", `/api/special-requests/track?requestNumber=${num}&email=x`);
  assert.equal(legacy.status, 410);
});

test("reseña sin autorización de publicación → 400", async () => {
  const r = await api("POST", "/api/reviews", {
    cookies: clientCookies,
    body: { productId: String(product._id), rating: 5, comment: "Comentario de prueba suficiente" },
  });
  assert.equal(r.status, 400);
});

// ── PQR y solicitudes de titulares (H-22, H-11) ────────────────────────────
let pqr;

test("PQR deshabilitada → 503 y nada se guarda", async () => {
  process.env.PQR_PUBLIC_ENABLED = "false";
  const before = await CustomerRequest.countDocuments();
  const r = await api("POST", "/api/pqr", {
    body: { category: "consumo", type: "queja", name: "X", email: "x@example.test", description: "Descripción de prueba", privacyAuthorization: true },
  });
  assert.equal(r.status, 503);
  assert.equal(await CustomerRequest.countDocuments(), before);
  process.env.PQR_PUBLIC_ENABLED = "true";
});

test("PQR: validación, persistencia, radicado con fecha y constancia", async () => {
  const base = { category: "consumo", type: "reclamo", name: "Reclamante Prueba", email: "pqr@example.test", description: "Producto llegó con un defecto (prueba)" };
  assert.equal((await api("POST", "/api/pqr", { body: base })).status, 400, "sin autorización");
  assert.equal((await api("POST", "/api/pqr", { body: { ...base, type: "supresion", privacyAuthorization: true } })).status, 400, "tipo de otra categoría");

  const r = await api("POST", "/api/pqr", { body: { ...base, privacyAuthorization: true } });
  assert.equal(r.status, 201, r.text);
  pqr = r.json.request;
  assert.match(pqr.radicado, /^PQR-\d{8}-[0-9A-F]{8}$/);
  assert.ok(new Date(pqr.receivedAt).getTime() <= Date.now());
  const doc = await CustomerRequest.findOne({ radicado: pqr.radicado }).select("+accessTokenHash");
  assert.ok(doc, "persistida antes de devolver el radicado");
  assert.notEqual(doc.accessTokenHash, pqr.accessCode, "solo se guarda el hash del código");

  const datos = await api("POST", "/api/pqr", {
    body: { category: "datos_personales", type: "supresion", name: "Titular", email: "titular@example.test", description: "Solicito supresión (prueba)", privacyAuthorization: true },
  });
  assert.equal(datos.status, 201);
  assert.equal((await CustomerRequest.findOne({ radicado: datos.json.request.radicado })).category, "datos_personales");
});

test("PQR: seguimiento protegido por código; sin acceso a solicitudes ajenas", async () => {
  const ok = await api("POST", "/api/pqr/track", { body: { radicado: pqr.radicado, accessCode: pqr.accessCode } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.request.contact, undefined, "no devuelve datos de contacto");
  const wrong = await api("POST", "/api/pqr/track", { body: { radicado: pqr.radicado, accessCode: "0".repeat(64) } });
  assert.equal(wrong.status, 404);
  const other = await CustomerRequest.findOne({ radicado: { $ne: pqr.radicado } });
  const cross = await api("POST", "/api/pqr/track", { body: { radicado: other.radicado, accessCode: pqr.accessCode } });
  assert.equal(cross.status, 404);
});

test("PQR admin: solo administradores; historial con nota pública e interna", async () => {
  const denied = await api("GET", "/api/admin/pqr", { cookies: clientCookies });
  assert.equal(denied.status, 403);
  const list = await api("GET", "/api/admin/pqr?category=consumo", { cookies: adminCookies });
  assert.equal(list.status, 200);
  const item = list.json.requests.find((x) => x.radicado === pqr.radicado);
  const upd = await api("PATCH", `/api/admin/pqr/${item.id}/status`, {
    cookies: adminCookies,
    body: { status: "en_tramite", publicNote: "Estamos revisando", internalNote: "nota-interna-secreta" },
  });
  assert.equal(upd.status, 200, upd.text);
  assert.equal(upd.json.request.history.length, 2);

  const pub = await api("POST", "/api/pqr/track", { body: { radicado: pqr.radicado, accessCode: pqr.accessCode } });
  assert.ok(pub.text.includes("Estamos revisando"));
  assert.ok(!pub.text.includes("nota-interna-secreta"));
});

// ── Validación final: pruebas negativas de seguridad (fase 2) ─────────────
const resetTrackingLimit = () => {
  const { trackingLimiter } = req("middlewares/rateLimitMiddleware");
  trackingLimiter.resetKey("127.0.0.1");
  trackingLimiter.resetKey("::ffff:127.0.0.1");
};

test("N-01: otro usuario autenticado no puede ver un pedido ajeno (ni por número ni por id)", async () => {
  resetTrackingLimit();
  // Pedido del cliente registrado (dueño).
  const own = await api("POST", "/api/checkout/orders", {
    cookies: clientCookies,
    body: guestOrderBody({ privacyAuthorization: true, buyer: { name: "Cliente Prueba", email: "cliente@example.test", phone: "3000000003" } }),
  });
  assert.equal(own.status, 201, own.text);
  const ownNumber = own.json.order.orderNumber;
  const ownId = own.json.order.id;

  // Dueño autenticado sin token → 200.
  const asOwner = await api("POST", "/api/checkout/orders/lookup", { cookies: clientCookies, body: { orderNumber: ownNumber } });
  assert.equal(asOwner.status, 200);

  // Segundo usuario.
  const reg = await api("POST", "/api/auth/register", {
    body: { name: "Otra Persona", email: "otra-persona@example.test", password: "OtraPersona123", privacyAuthorization: true },
  });
  assert.equal(reg.status, 201);
  const otherCookies = cookieHeader(reg);
  const byNumber = await api("POST", "/api/checkout/orders/lookup", { cookies: otherCookies, body: { orderNumber: ownNumber } });
  assert.equal(byNumber.status, 404, "otro usuario sin token → 404");
  const byId = await api("GET", `/api/checkout/orders/${ownId}`, { cookies: otherCookies });
  assert.equal(byId.status, 404, "conocer el id no basta");
  const anonById = await api("GET", `/api/checkout/orders/${ownId}`);
  assert.equal(anonById.status, 401);
});

test("N-02: cambiar el método HTTP no evita la autorización", async () => {
  const getLookup = await api("GET", "/api/checkout/orders/lookup");
  assert.ok([401, 404].includes(getLookup.status), `GET lookup → ${getLookup.status}`);
  const getPqrTrack = await api("GET", "/api/pqr/track");
  assert.equal(getPqrTrack.status, 404);
  const putLookup = await api("PUT", "/api/checkout/orders/lookup", { body: { orderNumber: "X" } });
  assert.equal(putLookup.status, 404);
  const legacy = await api("GET", "/api/checkout/track?orderNumber=X&email=y%40example.test");
  assert.equal(legacy.status, 410);
  assert.match(legacy.json.message, /Recarga la página/);
});

test("N-03: mensaje de autorización orienta a clientes con la versión anterior abierta", async () => {
  const r = await api("POST", "/api/checkout/orders", { body: guestOrderBody() });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /recarga la página/i);
});

test("N-04: PQR idempotente — reintento con la misma clave no duplica y rota el código", async () => {
  const key = crypto.randomUUID();
  const body = {
    category: "consumo", type: "peticion", name: "Idem Prueba", email: "idem@example.test",
    description: "Solicitud idempotente de prueba", privacyAuthorization: true, idempotencyKey: key,
  };
  const first = await api("POST", "/api/pqr", { body });
  assert.equal(first.status, 201, first.text);
  const second = await api("POST", "/api/pqr", { body });
  assert.equal(second.status, 201, second.text);
  assert.equal(second.json.request.radicado, first.json.request.radicado);
  assert.equal(second.json.request.duplicate, true);
  assert.notEqual(second.json.request.accessCode, first.json.request.accessCode);
  assert.equal(await CustomerRequest.countDocuments({ "contact.email": "idem@example.test" }), 1);

  resetTrackingLimit();
  const oldCode = await api("POST", "/api/pqr/track", { body: { radicado: first.json.request.radicado, accessCode: first.json.request.accessCode } });
  assert.equal(oldCode.status, 404, "el código anterior queda invalidado");
  const newCode = await api("POST", "/api/pqr/track", { body: { radicado: first.json.request.radicado, accessCode: second.json.request.accessCode } });
  assert.equal(newCode.status, 200);

  const hijack = await api("POST", "/api/pqr", { body: { ...body, email: "atacante@example.test" } });
  assert.equal(hijack.status, 409, "la clave no sirve para otra persona");
});

test("N-05: PQR concurrentes con la misma clave → un solo radicado", async () => {
  const key = crypto.randomUUID();
  const body = {
    category: "consumo", type: "queja", name: "Concurrente", email: "concurrente@example.test",
    description: "Prueba de concurrencia en PQR", privacyAuthorization: true, idempotencyKey: key,
  };
  const results = await Promise.all([api("POST", "/api/pqr", { body }), api("POST", "/api/pqr", { body })]);
  assert.ok(results.every((r) => r.status === 201), results.map((r) => r.text).join(" | "));
  assert.equal(await CustomerRequest.countDocuments({ "contact.email": "concurrente@example.test" }), 1);
});

test("N-06: rotación del secreto de baja — los enlaces ya enviados siguen funcionando", async () => {
  const { createUnsubscribeToken, verifyUnsubscribeToken } = req("utils/opaqueTokens");
  const original = process.env.MARKETING_TOKEN_SECRET;
  const id = "0123456789abcdef01234567";
  const oldToken = createUnsubscribeToken("marketing_newsletter", id);
  process.env.MARKETING_TOKEN_SECRET = rnd(32);
  assert.equal(verifyUnsubscribeToken(oldToken), null, "sin secreto anterior, el enlace antiguo no valida");
  process.env.MARKETING_TOKEN_SECRET_PREVIOUS = original;
  assert.deepEqual(verifyUnsubscribeToken(oldToken), { purpose: "marketing_newsletter", docId: id });
  const newToken = createUnsubscribeToken("marketing_newsletter", id);
  assert.notEqual(newToken, oldToken, "los enlaces nuevos usan el secreto vigente");
  assert.ok(verifyUnsubscribeToken(newToken));
  process.env.MARKETING_TOKEN_SECRET = "corto";
  assert.equal(createUnsubscribeToken("marketing_newsletter", id), null, "secreto < 32 caracteres → no se firma");
  process.env.MARKETING_TOKEN_SECRET = original;
  delete process.env.MARKETING_TOKEN_SECRET_PREVIOUS;
});

test("N-07: retirar estadísticas borra la cookie de conteo emitida por la API", async () => {
  const reg = await api("POST", "/api/visits/register");
  assert.equal(reg.status, 200);
  assert.ok(reg.headers.getSetCookie().some((c) => c.startsWith("dizor_visit_day=")));
  const forget = await api("POST", "/api/visits/forget", { cookies: cookieHeader(reg) });
  assert.equal(forget.status, 204);
  const cleared = forget.headers.getSetCookie().find((c) => c.startsWith("dizor_visit_day="));
  assert.ok(cleared && /Expires=Thu, 01 Jan 1970/i.test(cleared), cleared);
});

// ══ Fase 3: medios de pago, Nequi desactivado, Wompi, envío incluido ══════

const createContraEntregaOrder = async (email) => {
  const r = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: true, buyer: { name: "Pago Prueba", email, phone: "3000000009" } }),
  });
  assert.equal(r.status, 201, r.text);
  return Order.findOne({ orderNumber: r.json.order.orderNumber });
};

test("F3-P1: configuración pública: solo Wompi (si está configurado) y contraentrega; envío incluido; plazo no publicado", async () => {
  const off = await api("GET", "/api/checkout/config");
  assert.deepEqual(off.json.config.paymentMethods.map((m) => m.id), ["contra_entrega"]);
  assert.deepEqual(off.json.config.carriers, ["interrapidisimo", "servientrega"]);
  assert.equal(off.json.config.shippingIncluded, true);
  assert.equal(off.json.config.freeShippingMinAmount, 0, "sin umbral de envío gratis");
  assert.equal(off.json.config.deliveryTerms, null, "plazo pendiente de definición: no se publica");

  process.env.WOMPI_PRIVATE_KEY = "prv_test_ficticia";
  process.env.WOMPI_EVENTS_SECRET = "test_events_ficticio";
  // Aunque se intente "activar" Nequi en modo mock, sin NEQUI_DIRECT_ENABLED no aparece.
  process.env.NEQUI_ENV = "mock";
  const on = await api("GET", "/api/checkout/config");
  assert.deepEqual(on.json.config.paymentMethods.map((m) => m.id), ["wompi", "contra_entrega"]);
  process.env.NEQUI_ENV = "";
});

test("F3-P2: el backend rechaza Nequi directo, transferencia manual y métodos desconocidos (clientes antiguos o manipulados)", async () => {
  const before = await Order.countDocuments();
  for (const paymentMethod of ["nequi_api", "nequi_manual", "transferencia", "efectivo", "", undefined, { $ne: "x" }]) {
    const r = await api("POST", "/api/checkout/orders", {
      body: guestOrderBody({ privacyAuthorization: true, paymentMethod, nequiPhone: "3001234567" }),
    });
    assert.equal(r.status, 400, `paymentMethod=${JSON.stringify(paymentMethod)} → ${r.status}`);
  }
  // Ni siquiera con NEQUI_ENV=mock (sin activación explícita).
  process.env.NEQUI_ENV = "mock";
  const mock = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: true, paymentMethod: "nequi_api", nequiPhone: "3001234567" }),
  });
  assert.equal(mock.status, 400);
  process.env.NEQUI_ENV = "";
  assert.equal(await Order.countDocuments(), before, "no se creó ningún pedido");
});

test("F3-P3: transportadora no confirmada → 400; confirmada → 201", async () => {
  const bad = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: true, carrier: "envia" }),
  });
  assert.equal(bad.status, 400);
  const ok = await api("POST", "/api/checkout/orders", {
    body: guestOrderBody({ privacyAuthorization: true, carrier: "servientrega", buyer: { name: "Serv", email: "serv@example.test", phone: "3000000010" } }),
  });
  assert.equal(ok.status, 201, ok.text);
});

test("F3-P4: sin modo mock por omisión: variables ausentes, vacías o inválidas → integración desactivada", () => {
  const nequi = req("services/nequiPaymentService");
  const snapshot = { ...process.env };
  const cases = [
    { NODE_ENV: "production", NEQUI_ENV: undefined },
    { NODE_ENV: "production", NEQUI_ENV: "" },
    { NODE_ENV: "production", NEQUI_ENV: "mock" },
    { NODE_ENV: "production", NEQUI_ENV: "MOCK " },
    { NODE_ENV: "development", NEQUI_ENV: "mock" },
    { NODE_ENV: "production", NEQUI_ENV: "prod" },
    { NODE_ENV: "test", NEQUI_ENV: undefined },
  ];
  for (const c of cases) {
    for (const [k, v] of Object.entries(c)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    assert.equal(nequi.getNequiEnv(), "disabled", JSON.stringify(c));
    assert.equal(nequi.isNequiDirectEnabled(), false, JSON.stringify(c));
    assert.equal(nequi.verifyWebhookSignature("{}", "sha256=" + "0".repeat(64)), false, JSON.stringify(c));
  }
  // Activación explícita en producción SIN credenciales → sigue desactivada.
  Object.assign(process.env, { NODE_ENV: "production", NEQUI_ENV: "production", NEQUI_DIRECT_ENABLED: "true" });
  assert.equal(nequi.isNequiDirectEnabled(), false);
  assert.equal(nequi.isNequiManualEnabled(), false);
  for (const k of Object.keys(process.env)) if (!(k in snapshot)) delete process.env[k];
  Object.assign(process.env, snapshot);
  assert.equal(process.env.NODE_ENV, "test");
});

test("F3-P5: endpoints propios de Nequi → 410 sin tocar pedidos históricos (ni por 'compatibilidad')", async () => {
  // Pedido histórico nequi_api pendiente (simulado sobre un pedido real de prueba).
  const o = await createContraEntregaOrder("historico-nequi@example.test");
  await Order.updateOne({ _id: o._id }, {
    $set: { paymentMethod: "nequi_api", paymentStatus: "pendiente", orderStatus: "pago_pendiente", "nequi.paymentToken": "tok-historico", "nequi.reference": o.orderNumber },
  });
  const manual = await createContraEntregaOrder("historico-manual@example.test");
  await Order.updateOne({ _id: manual._id }, { $set: { paymentMethod: "nequi_manual" } });
  const snapshotBefore = await Order.find({ _id: { $in: [o._id, manual._id] } }).lean();

  const webhook = await api("POST", "/api/payments/nequi/webhook", {
    body: { result: { value: { statusCode: "USER_APPROVED", paymentToken: "tok-historico", reference: o.orderNumber } } },
  });
  assert.equal(webhook.status, 410, webhook.text);
  const status = await api("GET", `/api/payments/nequi/status/${o._id}`);
  assert.equal(status.status, 410);
  const create = await api("POST", "/api/payments/nequi/create", { body: { orderId: String(o._id), phoneNumber: "3001234567" } });
  assert.equal(create.status, 410);

  // Ni con NEQUI_ENV=mock (antiguo valor por defecto) el webhook aprueba.
  process.env.NEQUI_ENV = "mock";
  const mockHook = await api("POST", "/api/payments/nequi/webhook", {
    body: { result: { value: { statusCode: "USER_APPROVED", paymentToken: "tok-historico", reference: o.orderNumber } } },
  });
  assert.equal(mockHook.status, 410);
  process.env.NEQUI_ENV = "";

  const after = await Order.find({ _id: { $in: [o._id, manual._id] } }).lean();
  for (const a of after) {
    const b = snapshotBefore.find((x) => String(x._id) === String(a._id));
    assert.equal(a.paymentStatus, b.paymentStatus, "estado de pago intacto");
    assert.equal(a.orderStatus, b.orderStatus, "estado del pedido intacto");
    assert.equal(a.paymentMethod, b.paymentMethod, "no se reclasifica");
    assert.equal(a.statusHistory.length, b.statusHistory.length, "sin nuevas entradas");
  }
  // Se conservan (no se eliminan).
  assert.equal(await Order.countDocuments({ paymentMethod: { $in: ["nequi_api", "nequi_manual"] } }), 2);
});

// ── Wompi ────────────────────────────────────────────────────────────────
const wompiEvent = (tx, { ageSec = 0, environment = "test", secret = process.env.WOMPI_EVENTS_SECRET, inBody = false } = {}) => {
  const timestamp = Math.floor(Date.now() / 1000) - ageSec;
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const data = { transaction: tx };
  const chain = properties.map((p) => p.split(".").reduce((v, k) => v?.[k], data)).join("") + timestamp + secret;
  const checksum = crypto.createHash("sha256").update(chain).digest("hex").toUpperCase();
  return {
    body: { event: "transaction.updated", data, environment, signature: { properties, ...(inBody ? { checksum } : {}) }, timestamp, sent_at: new Date().toISOString() },
    checksum,
  };
};
const postWompi = async ({ body, checksum }, { header = true } = {}) => {
  const res = await fetch(`${base}/api/webhooks/wompi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(header ? { "X-Event-Checksum": checksum } : {}) },
    body: JSON.stringify(body),
  });
  return res.status;
};

test("F3-W1: webhook Wompi verifica checksum, entorno, moneda, monto y método; Nequi dentro de Wompi sí se acepta", async () => {
  assert.ok(process.env.WOMPI_EVENTS_SECRET, "secreto de prueba fijado en F3-P1");
  const o = await createContraEntregaOrder("wompi@example.test");
  await Order.updateOne({ _id: o._id }, { $set: { paymentMethod: "wompi", paymentStatus: "pendiente", orderStatus: "pendiente" } });
  const cents = Math.round(o.total * 100);
  const tx = (extra) => ({ id: `tx-${crypto.randomUUID()}`, status: "APPROVED", amount_in_cents: cents, currency: "COP", reference: o.orderNumber, payment_method_type: "NEQUI", ...extra });
  const paid = async () => (await Order.findById(o._id)).paymentStatus;

  assert.equal(await postWompi({ ...wompiEvent(tx()), checksum: "0".repeat(64) }), 401, "checksum inválido");
  assert.equal(await postWompi(wompiEvent(tx(), { secret: "otro-secreto" })), 401, "firmado con otro secreto");
  assert.equal(await postWompi(wompiEvent(tx(), { ageSec: 30 * 3600 })), 401, "evento de hace 30 h");
  assert.equal(await paid(), "pendiente");

  assert.equal(await postWompi(wompiEvent(tx(), { environment: "prod" })), 200);
  assert.equal(await paid(), "pendiente", "evento de otro entorno no aplica");

  assert.equal(await postWompi(wompiEvent(tx({ currency: "USD" }))), 200);
  assert.equal(await paid(), "pendiente", "moneda distinta no confirma");
  assert.equal(await postWompi(wompiEvent(tx({ amount_in_cents: cents - 100 }))), 200);
  assert.equal(await paid(), "pendiente", "monto distinto no confirma");

  // Reintento oficial (hasta 24 h después) y checksum en el cuerpo.
  assert.equal(await postWompi(wompiEvent(tx(), { ageSec: 3 * 3600, inBody: true }), { header: false }), 200);
  const after = await Order.findById(o._id);
  assert.equal(after.paymentStatus, "pagado", "Nequi procesado dentro de Wompi confirma el pago");
  assert.equal(after.orderStatus, "pagado");

  // Un evento posterior DECLINED/VOIDED no degrada el pedido pagado.
  for (const status of ["DECLINED", "VOIDED", "ERROR"]) {
    assert.equal(await postWompi(wompiEvent(tx({ status }))), 200);
  }
  const final = await Order.findById(o._id);
  assert.equal(final.paymentStatus, "pagado");
  assert.equal(final.orderStatus, "pagado");
});

test("F3-W2: un evento Wompi no modifica pedidos de contraentrega ni pedidos Nequi históricos", async () => {
  const ce = await createContraEntregaOrder("ce-wompi@example.test");
  const ev = wompiEvent({ id: "tx-ce", status: "APPROVED", amount_in_cents: Math.round(ce.total * 100), currency: "COP", reference: ce.orderNumber });
  assert.equal(await postWompi(ev), 200);
  const declined = wompiEvent({ id: "tx-ce2", status: "DECLINED", amount_in_cents: Math.round(ce.total * 100), currency: "COP", reference: ce.orderNumber });
  assert.equal(await postWompi(declined), 200);
  const after = await Order.findById(ce._id);
  assert.equal(after.paymentStatus, "pendiente", "contraentrega sigue pendiente");
  assert.notEqual(after.orderStatus, "cancelado");
});

test("F3-S1: envío incluido en carrito y checkout; reversible con SHIPPING_INCLUDED_IN_PRICE=false", async () => {
  const items = [{ productId: String(product._id), variantId: String(variantId), quantity: 1 }];
  const cart = await api("POST", "/api/cart/validate", { body: { items, department: "Nariño" } });
  assert.equal(cart.json.shippingIncluded, true);
  assert.equal(cart.json.shippingCost, 0);
  assert.equal(cart.json.total, 100000);
  const calc = await api("POST", "/api/checkout/calculate", { body: { items, department: "Antioquia" } });
  assert.equal(calc.json.totals.shippingIncluded, true);
  assert.equal(calc.json.totals.freeShippingApplied, false, "no se presenta como 'envío gratis'");
  assert.equal(calc.json.totals.total, 100000);

  process.env.SHIPPING_INCLUDED_IN_PRICE = "false";
  const rev = await api("POST", "/api/cart/validate", { body: { items, department: "Nariño" } });
  assert.equal(rev.json.shippingIncluded, false);
  assert.equal(rev.json.shippingCost, 15000, "vuelve al modo guardado en BD");
  delete process.env.SHIPPING_INCLUDED_IN_PRICE;
});

test("F3-Q1: PQR avisa a la bandeja de atención con datos mínimos; la constancia identifica al vendedor", async () => {
  const pqrService = req("services/customerRequestService");
  const sent = [];
  pqrService.setRequestReceiptTransport(async (msg) => { sent.push(msg); return { devMode: true }; });
  process.env.ADMIN_NOTIFY_EMAIL = "atencion@example.test";
  // Se llama al servicio directamente: el endpoint público ya agotó su
  // límite de 10 solicitudes/hora en las pruebas anteriores (el límite
  // funciona según lo diseñado).
  const created = await pqrService.createCustomerRequest({
    body: { category: "consumo", type: "peticion", name: "Aviso Prueba", email: "aviso@example.test", description: "Descripción confidencial de prueba", privacyAuthorization: true },
    user: null,
  });
  const toStaff = sent.find((m) => m.to === "atencion@example.test");
  const toUser = sent.find((m) => m.to === "aviso@example.test");
  assert.ok(toStaff && toUser, "constancia + aviso interno");
  assert.ok(toStaff.html.includes(created.radicado));
  assert.ok(!toStaff.html.includes("aviso@example.test") && !toStaff.html.includes("confidencial"), "aviso interno sin datos del solicitante");
  assert.ok(toUser.html.includes("901.027.825-5") && toUser.html.includes("lunes a viernes"));
  delete process.env.ADMIN_NOTIFY_EMAIL;
  process.env.ADMIN_NOTIFY_EMAIL = "";
  pqrService.setRequestReceiptTransport(null);
});
