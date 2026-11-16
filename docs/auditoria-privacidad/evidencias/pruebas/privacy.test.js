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
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  CLIENT_URL: "http://localhost:3000",
  MARKETING_TOKEN_SECRET: rnd(32),
  PQR_PUBLIC_ENABLED: "true",
  CONSENT_ACCEPT_DRAFT_FOR_TESTS: "true",
  ORDER_DELIVERY_TIME_TEXT: "",
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
  carrier: "envia",
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
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongod.stop();
  assert.deepEqual(blockedRequests, [], `Intentos de red saliente: ${blockedRequests.join(", ")}`);
});

// ── Textos legales ─────────────────────────────────────────────────────────
test("GET /api/legal/notices expone versiones del servidor; términos ausentes", async () => {
  const r = await api("GET", "/api/legal/notices");
  assert.equal(r.status, 200);
  assert.equal(r.json.notices.order_processing.status, "draft");
  assert.equal(r.json.notices.marketing_newsletter.required, false);
  assert.equal(r.json.notices.terms.status, "missing");
});

// ── Checkout, acuse y confirmación (H-03, H-06, H-19, H-20) ────────────────
let orderNumber, accessToken, idemKey;

test("checkout sin autorización de tratamiento → 400 y no crea pedido", async () => {
  const before = await Order.countDocuments();
  const r = await api("POST", "/api/checkout/orders", { body: guestOrderBody() });
  assert.equal(r.status, 400);
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
  assert.equal(order.legal.privacyNoticeVersion, "2026-11-16-draft-1");
  assert.equal(order.legal.privacyNoticeStatus, "draft");
  assert.equal(order.legal.termsVersion, null);
  assert.ok(order.guestAccess.tokenHash && order.guestAccess.tokenHash !== accessToken);
  assert.ok(order.guestAccess.expiresAt > new Date());
  assert.ok(order.buyerReceipt.sentAt, "acuse marcado como enviado");

  const rec = await ConsentRecord.findOne({ referenceType: "Order", referenceId: order._id }).lean();
  assert.equal(rec.purpose, "order_processing");
  assert.equal(rec.textVersion, "2026-11-16-draft-1", "versión fijada por el servidor, no por el cliente");
  assert.equal(rec.subjectEmail, "comprador@example.test");
  assert.ok(rec.recordedAt instanceof Date);
  assert.equal(rec.ip, undefined);

  assert.equal(sentReceipts.length, 1);
  const msg = sentReceipts[0];
  assert.equal(msg.to, "comprador@example.test");
  for (const needle of [orderNumber, "Precio unitario", "Total", "Forma de pago", "Pago pendiente", "Tiempo de entrega", "Sombrero Ficticio"]) {
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
test("recordatorio de invitado: exige autorización; envío respeta franja, baja y evidencia", async () => {
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
});

test("sin el permiso de prueba, una evidencia con texto en borrador NO autoriza envíos", async () => {
  const { hasValidMarketingConsent, recordConsent } = req("services/consentService");
  await recordConsent({ purpose: "marketing_newsletter", subjectEmail: "draft@example.test", source: "test" });
  assert.equal(await hasValidMarketingConsent("draft@example.test", "marketing_newsletter"), true);
  process.env.CONSENT_ACCEPT_DRAFT_FOR_TESTS = "false";
  assert.equal(await hasValidMarketingConsent("draft@example.test", "marketing_newsletter"), false);
  process.env.CONSENT_ACCEPT_DRAFT_FOR_TESTS = "true";
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
