"use strict";
// Auditoría independiente de Fase 3. No modifica la aplicación ni las pruebas de Codex.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const fixture = require("../../../backend/test/helpers/phase2Fixture.cjs");
const Notification = require("../../../backend/src/models/notification");
const workspace = require("../../../backend/src/services/orderWorkspace");

const results = [];
const record = (id, verdict, detail) => results.push({ id, verdict, detail });
const api = (...args) => fixture.api(...args);
const admin = () => fixture.context.adminCookie;
const vendor = () => fixture.context.vendorCookie;
const list = (query = "", cookie = admin()) => api("GET", `/api/admin/orders${query ? `?${query}` : ""}`, { cookie });
const detail = (order, cookie = admin()) => api("GET", `/api/admin/orders/${order._id || order}`, { cookie });
const status = (order, orderStatus, cookie = admin(), extra = {}) => api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie, body: { orderStatus, ...extra } });
const ship = (order, cookie = admin()) => api("PATCH", `/api/admin/orders/${order._id}/shipping`, {
  cookie, body: { carrier: "servientrega", trackingNumber: "GUIA-AUD-3" },
});
const create = async (method = "contra_entrega") => {
  const { product, variantId } = await fixture.makeProduct(12);
  const response = await api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, variantId, { paymentMethod: method }) });
  assert.equal(response.status, 201, response.text);
  return { order: await fixture.context.Order.findById(response.json.order.id), product, variantId };
};
const patch = (order, fields) => fixture.context.Order.collection.updateOne({ _id: order._id }, { $set: fields });
const ids = (response) => response.json.orders.map((order) => order.id);
const countsOf = async (cookie = admin()) => (await list("limit=50", cookie)).json.counts;
const snapshot = async (order) => fixture.context.Order.collection.findOne({ _id: order._id });

test.before(async () => { await fixture.setup(); await Notification.init(); });
test.beforeEach(async () => {
  await fixture.context.Order.deleteMany({});
  await Notification.deleteMany({});
  process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
});
test.after(async () => {
  fs.writeFileSync(path.join(__dirname, "independiente-resultados.json"), JSON.stringify({
    at: new Date().toISOString(), blocked: fixture.context.blocked, results,
  }, null, 2));
  try { assert.deepEqual(fixture.context.blocked, []); }
  finally { await fixture.close(); }
});

test("F3-I01 un pedido puede ocupar varias bandejas y un cancelado con dinero sigue visible", async () => {
  const moving = await create();
  assert.equal((await status(moving.order, "en_preparacion")).status, 200);
  assert.equal((await ship(moving.order)).status, 200);
  await patch(moving.order, { requiresReview: true, incidents: [{ code: "payment_amount_or_currency_mismatch", detail: "Monto ficticio", resolvedAt: null }] });
  const cancelled = await fixture.context.Order.collection.insertOne({
    orderNumber: `DIZ-CAN-${crypto.randomUUID().slice(0, 8)}`,
    buyer: { name: "Cierre", email: "cierre@example.test", phone: "3000000000" },
    items: [{ productName: "Pieza", quantity: 1, unitPrice: 90000, lineTotal: 90000, unitCost: 424242 }],
    subtotal: 90000, total: 90000, paymentMethod: "wompi", paymentStatus: "pagado", orderStatus: "cancelado",
    stockDeducted: false, requiresReview: true, createdAt: new Date(), updatedAt: new Date(),
    incidents: [{ code: "received_payment_pending_resolution", detail: "Dinero recibido", resolvedAt: null, createdAt: new Date() }],
  });
  const counts = await countsOf();
  const transit = await list("tray=transit");
  const review = await list("tray=review");
  const closedDetail = await detail(cancelled.insertedId);
  const movingDetail = await detail(moving.order);
  const again = await ship(moving.order);
  const saved = await snapshot(moving.order);
  const ok = transit.json.total === 1 && ids(transit).includes(String(moving.order._id))
    && review.json.total === 2
    && counts.transit === 1 && counts.review === 2 && counts.prepare === 0 && counts.collection === 0
    && movingDetail.json.order.operation.primary.code === "review"
    && movingDetail.json.order.paymentStatus === "pendiente"
    && again.status === 409 && saved.paymentStatus === "pendiente" && saved.orderStatus === "enviado"
    && closedDetail.json.order.operation.primary.code === "review"
    && closedDetail.json.order.paymentStatus === "pagado"
    && !(await list("tray=prepare")).json.orders.some((order) => order.id === String(cancelled.insertedId))
    && !(await list("tray=collection")).json.orders.some((order) => order.id === String(cancelled.insertedId));
  record("F3-I01", ok ? "pass" : "fail", {
    counts, primary: movingDetail.json.order.operation.primary.code, closed: closedDetail.json.order.operation.primary.code, again: again.status,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F3-I02 Wompi pendiente, contraentrega sin recaudo y vendedor sin finanzas", async () => {
  const pending = await create("wompi");
  await patch(pending.order, { createdAt: new Date("2020-06-01T18:00:00Z") });
  const cod = await create();
  assert.equal((await status(cod.order, "en_preparacion")).status, 200);
  assert.equal((await ship(cod.order)).status, 200);
  assert.equal((await status(cod.order, "entregado")).status, 200);
  await fixture.context.Order.updateOne({ _id: cod.order._id, "items._id": cod.order.items[0]._id }, { $set: { "items.$.unitCost": 424242 } });
  const vendorDetail = await detail(cod.order, vendor());
  const vendorPay = await api("PATCH", `/api/admin/orders/${cod.order._id}/payment`, {
    cookie: vendor(), body: { reference: "NO-DEBE", receivedAt: new Date().toISOString(), paymentStatus: "pagado" },
  });
  const raw = await snapshot(cod.order);
  const tamper = await status(cod.order, "entregado", admin(), { paymentStatus: "pagado" });
  const vendorTray = await list("tray=communications", vendor());
  const prepare = await list("tray=prepare");
  const collection = await list("tray=collection");
  const saved = await snapshot(cod.order);
  const body = JSON.stringify(vendorDetail.json);
  const ok = (await list("tray=prepare")).json.total === 0
    && (await detail(pending.order)).json.order.operation.primary.code === "waiting_payment"
    && (await status(pending.order, "en_preparacion")).status === 409
    && (await snapshot(pending.order)).orderStatus === "pago_pendiente"
    && ids(collection).includes(String(cod.order._id)) && saved.paymentStatus === "pendiente"
    && vendorDetail.json.order.operation.canCollect === false
    && vendorDetail.json.order.operation.canCancel === false
    && vendorDetail.json.order.operation.primary.code === "waiting_collection"
    && vendorPay.status === 403 && vendorTray.status === 403
    && raw.items[0].unitCost === 424242 && !body.includes("424242")
    && tamper.status === 200 && tamper.json.order.paymentStatus === "pendiente"
    && prepare.json.orders.every((order) => order.paymentMethod !== "wompi" || order.paymentStatus === "pagado");
  record("F3-I02", ok ? "pass" : "fail", {
    vendorPay: vendorPay.status, vendorTray: vendorTray.status, payment: saved.paymentStatus,
    primary: vendorDetail.json.order.operation.primary.code, tamper: tamper.status,
    responsePayment: tamper.json.order?.paymentStatus, costHidden: !body.includes("424242"),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F3-I03 filtros, paginación, caracteres especiales y lecturas que no escriben", async () => {
  const named = await create();
  await patch(named.order, { "buyer.name": "Cliente [a].*+" });
  const second = await create();
  const third = await create();
  const before = await snapshot(named.order);
  const beforeStock = await fixture.stockOf(named.product, named.variantId);
  await list("tray=all");
  await api("GET", "/api/admin/dashboard", { cookie: admin() });
  await detail(named.order);
  const after = await snapshot(named.order);
  const literal = await list(`q=${encodeURIComponent("[a].*+")}`);
  const dotStar = await list("q=.*");
  const anchor = await list(`q=${encodeURIComponent("^")}`);
  const page1 = await list("tray=all&limit=1&page=1");
  const page2 = await list("tray=all&limit=1&page=2");
  const combined = await list("tray=prepare&paymentMethod=wompi&q=Cliente");
  const badDate = await list("from=2026-02-31&to=2026-02-31");
  const inverted = await list("from=2026-11-20&to=2026-11-19");
  const ok = literal.json.total === 1 && ids(literal)[0] === String(named.order._id)
    && dotStar.json.total === 1 && ids(dotStar)[0] === String(named.order._id)
    && anchor.json.total === 0
    && page1.json.total === 3 && page1.json.orders.length === 1 && page2.json.orders.length === 1
    && page1.json.orders[0].id !== page2.json.orders[0].id
    && combined.json.total === 0 && badDate.status === 400 && inverted.status === 400
    && String(before.updatedAt) === String(after.updatedAt)
    && before.paymentStatus === after.paymentStatus
    && (await fixture.stockOf(named.product, named.variantId)) === beforeStock
    && [second.order._id, third.order._id].every((id) => page1.json.counts.all === 3);
  record("F3-I03", ok ? "pass" : "fail", {
    literal: literal.json.total, dotStar: dotStar.json.total, anchor: anchor.json.total, pages: [page1.json.orders[0]?.id, page2.json.orders[0]?.id],
    badDate: badDate.status, inverted: inverted.status, combined: combined.json.total,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F3-I04 día colombiano, histórico incompleto y cambios concurrentes", async () => {
  const inside = await create();
  const edge = await create();
  const beforeDay = await create();
  const nextDay = await create();
  await patch(inside.order, { createdAt: new Date("2026-11-20T05:00:00.000Z") });
  await patch(edge.order, { createdAt: new Date("2026-11-21T04:59:00.000Z") });
  await patch(beforeDay.order, { createdAt: new Date("2026-11-20T04:30:00.000Z") });
  await patch(nextDay.order, { createdAt: new Date("2026-11-21T05:00:00.000Z") });
  const day = await list("from=2026-11-20&to=2026-11-20&limit=50");
  const found = new Set(ids(day));
  const period = workspace.bogotaPeriod(new Date("2026-03-01T04:30:00.000Z"));
  const historical = await fixture.context.Order.collection.insertOne({
    orderNumber: "DIZ-20240115-INCOMPLETO",
    buyer: { name: "Histórico", email: "historico@example.test", phone: "3001111111" },
    items: [], subtotal: 1000, total: 1000, paymentMethod: "contra_entrega", paymentStatus: "pendiente",
    orderStatus: "pendiente", createdAt: new Date("2024-01-15T15:00:00.000Z"), updatedAt: new Date("2024-01-15T15:00:00.000Z"),
  });
  const historicalDetail = await detail(historical.insertedId);
  const deliveries = await workspace.countDeliveries(new Date("2024-01-01"), new Date("2024-02-01"));
  const concurrent = await create();
  const raced = await Promise.all([
    list("tray=prepare&limit=50"),
    status(concurrent.order, "en_preparacion"),
    status(concurrent.order, "en_preparacion"),
  ]);
  const fresh = await snapshot(concurrent.order);
  const notices = await Notification.countDocuments({ order: concurrent.order._id, event: "order.shipped" });
  const prepareNotes = fresh.statusHistory.filter((entry) => entry.status === "en_preparacion").length;
  const ok = found.has(String(inside.order._id)) && found.has(String(edge.order._id))
    && !found.has(String(beforeDay.order._id)) && !found.has(String(nextDay.order._id))
    && period.today.toISOString() === "2026-02-28T05:00:00.000Z"
    && period.monthStart.toISOString() === "2026-02-01T05:00:00.000Z"
    && historicalDetail.status === 200
    && historicalDetail.json.order.operation.primary.code === "review"
    && historicalDetail.json.order.deliveredAt == null
    && deliveries === 0
    && raced[0].status === 200 && raced.slice(1).every((item) => item.status === 200)
    && prepareNotes === 1
    && fresh.orderStatus === "en_preparacion" && fresh.paymentStatus === "pendiente" && notices === 0;
  record("F3-I04", ok ? "pass" : "fail", {
    day: [...found], today: period.today, monthStart: period.monthStart,
    historical: historicalDetail.json.order?.operation?.primary?.code, raced: raced.map((item) => item.status), prepareNotes,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F3-I05 despacho, entrega, doble envío y comunicaciones no duplican efectos", async () => {
  const { order, product, variantId } = await create();
  const stockBefore = await fixture.stockOf(product, variantId);
  assert.equal((await status(order, "en_preparacion")).status, 200);
  const ships = await Promise.all([ship(order), ship(order), ship(order)]);
  const shipped = await snapshot(order);
  const shippedNotes = await Notification.countDocuments({ order: order._id, event: "order.shipped" });
  const delivers = await Promise.all([status(order, "entregado"), status(order, "entregado"), status(order, "entregado")]);
  const delivered = await snapshot(order);
  const deliveredNotes = await Notification.countDocuments({ order: order._id, event: "order.delivered" });
  const history = await api("GET", `/api/admin/orders/${order._id}/communications`, { cookie: admin() });
  const dashboard = await api("GET", "/api/admin/dashboard", { cookie: admin() });
  const listCollection = await list("tray=collection");
  const ok = ships.every((item) => item.status === 200)
    && shipped.orderStatus === "enviado" && shipped.paymentStatus === "pendiente" && shipped.trackingNumber === "GUIA-AUD-3"
    && shipped.statusHistory.filter((entry) => entry.status === "enviado").length === 1
    && shippedNotes === 1
    && delivers.every((item) => item.status === 200)
    && delivered.orderStatus === "entregado" && delivered.paymentStatus === "pendiente"
    && delivered.statusHistory.filter((entry) => entry.status === "entregado").length === 1
    && deliveredNotes === 1
    && history.json.notifications.some((row) => row.event.includes("Entrega") || row.event.includes("camino") || row.event)
    && history.json.notifications.filter((row) => /entrega/i.test(row.event)).length === 1
    && ids(listCollection).includes(String(order._id))
    && dashboard.json.dashboard.attention.collection === listCollection.json.total
    && (await fixture.stockOf(product, variantId)) === stockBefore;
  record("F3-I05", ok ? "pass" : "fail", {
    ships: ships.map((item) => item.status), delivers: delivers.map((item) => item.status),
    shippedNotes, deliveredNotes, payment: delivered.paymentStatus,
    events: history.json.notifications.map((row) => row.event),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F3-I06 volumen ficticio, índices y ventas que siguen conciliadas", async () => {
  const before = await api("GET", "/api/admin/dashboard", { cookie: admin() });
  const base = before.json.dashboard.orders.revenueMonth;
  const now = new Date();
  const batch = Array.from({ length: 250 }, (_, index) => ({
    orderNumber: `DIZ-VOL-${index}-${crypto.randomUUID().slice(0, 6)}`,
    buyer: { name: `Volumen ${index}`, email: `v${index}@example.test`, phone: "3000000000" },
    items: [], subtotal: 1000, total: 1000, paymentMethod: index % 2 ? "wompi" : "contra_entrega",
    paymentStatus: "pendiente", orderStatus: "pendiente", stockDeducted: true, checkoutState: "ready",
    requiresReview: false, createdAt: now, updatedAt: now,
  }));
  batch.push({
    orderNumber: `DIZ-VOL-CERRADO-${crypto.randomUUID().slice(0, 6)}`,
    buyer: { name: "Cerrado", email: "cerrado@example.test", phone: "1" },
    items: [], subtotal: 999999, total: 999999, paymentMethod: "wompi", paymentStatus: "pagado",
    orderStatus: "cancelado", requiresReview: true, stockDeducted: false, createdAt: now, updatedAt: now,
    incidents: [{ code: "received_payment_pending_resolution", detail: "No contar", resolvedAt: null }],
  });
  await fixture.context.Order.collection.insertMany(batch);
  const started = Date.now();
  const page = await list("tray=prepare&limit=15&page=2");
  const elapsed = Date.now() - started;
  const after = await api("GET", "/api/admin/dashboard", { cookie: admin() });
  const indexes = await fixture.context.Order.collection.indexes();
  let plan = "no-medido";
  try {
    const explained = await fixture.context.Order.aggregate([{ $match: { orderStatus: "pendiente" } }, { $limit: 15 }]).explain("queryPlanner");
    plan = JSON.stringify(explained).includes("COLLSCAN") ? "COLLSCAN" : "indexado";
  } catch (error) { plan = error.message.slice(0, 120); }
  const ok = page.status === 200 && page.json.orders.length === 15 && page.json.total === 125
    && page.json.counts.prepare === page.json.total && page.json.counts.all === 251
    && after.json.dashboard.orders.revenueMonth === base
    && elapsed < 5000;
  record("F3-I06", ok ? "pass" : "fail", {
    elapsed, total: page.json.total, page: page.json.orders.length, revenue: after.json.dashboard.orders.revenueMonth, base, plan,
    indexes: indexes.map((index) => index.name),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});
