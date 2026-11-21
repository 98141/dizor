"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./helpers/phase2Fixture.cjs");
const Notification = require("../src/models/notification");
const workspace = require("../src/services/orderWorkspace");
const api = (...args) => fixture.api(...args);
const list = (query = "", cookie = fixture.context.adminCookie) => api("GET", `/api/admin/orders${query ? `?${query}` : ""}`, { cookie });
const detail = (o, cookie = fixture.context.adminCookie) => api("GET", `/api/admin/orders/${o._id}`, { cookie });
const status = (o, state, cookie = fixture.context.adminCookie) => api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie, body: { orderStatus: state } });
const ship = (o, cookie = fixture.context.adminCookie) => api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie, body: { carrier: "servientrega", trackingNumber: "GUIA-FICTICIA" } });
const create = async (method = "contra_entrega", extra = {}) => {
  const { product, variantId } = await fixture.makeProduct(100);
  const r = await api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, variantId, { paymentMethod: method, ...extra }) });
  assert.equal(r.status, 201, r.text);
  return fixture.context.Order.findById(r.json.order.id);
};
// Raw fixture writes deliberately bypass immutable createdAt for date-boundary cases.
const patch = (o, fields) => fixture.context.Order.collection.updateOne({ _id: o._id }, { $set: fields });
const ids = (r) => r.json.orders.map((o) => o.id);
test.before(async () => { await fixture.setup(); await Notification.init(); });
test.beforeEach(async () => {
  await fixture.context.Order.deleteMany({}); await Notification.deleteMany({});
  process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
});
test.after(async () => { try { assert.deepEqual(fixture.context.blocked, []); } finally { await fixture.close(); } });

test("U01 contraentrega nueva está en Por preparar con pago pendiente", async () => {
  const o = await create(); const r = await list("tray=prepare"); assert.equal(r.status, 200, r.text);
  assert.deepEqual(ids(r), [String(o._id)]); assert.equal(r.json.orders[0].paymentStatus, "pendiente");
});
test("U02 Wompi pendiente no está en Por preparar y no se cancela por antigüedad", async () => {
  const o = await create("wompi"); await patch(o, { createdAt: new Date("2020-01-01") });
  assert.equal((await list("tray=prepare")).json.total, 0);
  assert.equal((await detail(o)).json.order.operation.primary.code, "waiting_payment");
  assert.equal((await fixture.context.Order.findById(o._id)).orderStatus, "pago_pendiente");
});
test("U03 Wompi aprobado entra en Por preparar", async () => {
  const o = await create("wompi"); assert.equal((await fixture.postEvent(fixture.txFor(o))).status, 200);
  assert.deepEqual(ids(await list("tray=prepare")), [String(o._id)]);
});
test("U04 preparación está en Por despachar y no sigue en Por preparar", async () => {
  const o = await create(); assert.equal((await status(o, "en_preparacion")).status, 200);
  assert.equal((await list("tray=prepare")).json.total, 0); assert.deepEqual(ids(await list("tray=dispatch")), [String(o._id)]);
});
test("U05 enviado está en En camino", async () => {
  const o = await create(); await status(o, "en_preparacion"); assert.equal((await ship(o)).status, 200);
  assert.deepEqual(ids(await list("tray=transit")), [String(o._id)]);
});
test("U06 entregado contraentrega pendiente aparece en recaudo", async () => {
  const o = await create(); await status(o, "en_preparacion"); await ship(o); await status(o, "entregado");
  assert.deepEqual(ids(await list("tray=collection")), [String(o._id)]);
  assert.equal((await detail(o)).json.order.paymentStatus, "pendiente");
});
test("U07 recaudo confirmado desaparece de pendientes sin cambiar entrega", async () => {
  const o = await create(); await status(o, "en_preparacion"); await ship(o); await status(o, "entregado");
  const r = await api("PATCH", `/api/admin/orders/${o._id}/payment`, { cookie: fixture.context.adminCookie, body: { reference: "GIRO-FICTICIO", receivedAt: new Date(Date.now() - 1000).toISOString(), paymentProofUrl: "https://example.test/comprobante" } });
  assert.equal(r.status, 200, r.text); assert.equal((await list("tray=collection")).json.total, 0);
  const saved = (await detail(o)).json.order; assert.equal(saved.orderStatus, "entregado"); assert.equal(saved.collection.reference, "GIRO-FICTICIO");
});
test("U08 incidencia activa incluso con bandera antigua se clasifica y bloquea preparación", async () => {
  const o = await create(); await patch(o, { requiresReview: false, incidents: [{ code: "payment_processing_failed", detail: "FICTICIA" }] });
  assert.deepEqual(ids(await list("tray=review")), [String(o._id)]); assert.equal((await list("tray=prepare")).json.total, 0);
  assert.equal((await status(o, "en_preparacion")).status, 409);
});
test("U09 cancelado sin incidencia solo permanece en Todos", async () => {
  const o = await create(); assert.equal((await status(o, "cancelado")).status, 200);
  for (const tray of ["prepare", "dispatch", "transit", "collection", "review"]) assert.equal((await list(`tray=${tray}`)).json.total, 0);
  assert.deepEqual(ids(await list("tray=all")), [String(o._id)]);
});
test("U10 contadores, listas y dashboard usan la misma clasificación sin duplicar pedidos", async () => {
  await create(); const o = await create(); await status(o, "en_preparacion");
  const incident = await create(); await patch(incident, { requiresReview: true, incidents: [{ code: "x" }, { code: "y" }] });
  const d = (await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie })).json.dashboard;
  for (const tray of ["prepare", "dispatch", "transit", "collection", "review", "all", "communications"]) {
    const r = await list(`tray=${tray}&limit=50`); assert.equal(r.json.total, r.json.orders.length);
    assert.equal(r.json.counts[tray], r.json.total); assert.equal(d.attention[tray], r.json.total);
  }
  assert.equal(d.attention.review, 1);
});
test("U11 filtros combinados conservan contadores sobre el mismo universo", async () => {
  const o = await create(); await status(o, "en_preparacion"); await ship(o); await create("wompi");
  const r = await list("tray=transit&paymentMethod=contra_entrega&paymentStatus=pendiente&orderStatus=enviado&carrier=servientrega");
  assert.equal(r.json.total, 1); assert.equal(r.json.counts.all, 1); assert.deepEqual(ids(r), [String(o._id)]);
});
test("U12 búsqueda por número encuentra solo el pedido solicitado", async () => {
  const o = await create(); await create(); assert.deepEqual(ids(await list(`q=${o.orderNumber}`)), [String(o._id)]);
});
test("U13 búsqueda por cliente también admite correo y teléfono", async () => {
  const o = await create(); await patch(o, { "buyer.name": "Comprador Único Fase Tres", "buyer.email": "unico-fase3@example.test", "buyer.phone": "3005551234" });
  for (const q of ["Único Fase", "unico-fase3@example.test", "3005551234"]) assert.deepEqual(ids(await list(`q=${encodeURIComponent(q)}`)), [String(o._id)]);
});
test("U14 caracteres especiales se buscan literalmente", async () => {
  const o = await create(); await patch(o, { "buyer.name": "Artesano [A+B].* (Colombia)" }); await create();
  assert.deepEqual(ids(await list(`q=${encodeURIComponent("[A+B].*")}`)), [String(o._id)]);
  assert.equal((await list(`q=${encodeURIComponent(".*$")}`)).json.total, 0);
});
test("U15 paginación estable en servidor, límites seguros y sin repetición", async () => {
  for (let i = 0; i < 4; i++) await create();
  const first = await list("page=1&limit=2"), second = await list("page=2&limit=2");
  assert.equal(first.json.totalPages, 2); assert.equal(first.json.orders.length, 2);
  assert.equal(new Set([...ids(first), ...ids(second)]).size, 4);
  assert.equal((await list("page=NaN")).status, 400); assert.equal((await list("limit=-1")).status, 400);
});
test("U16 siguiente acción viene del backend para cada paso contraentrega", async () => {
  const o = await create(); assert.equal((await detail(o)).json.order.operation.primary.code, "prepare");
  await status(o, "en_preparacion"); assert.equal((await detail(o)).json.order.operation.primary.code, "dispatch");
  await ship(o); assert.equal((await detail(o)).json.order.operation.primary.code, "deliver");
  await status(o, "entregado"); assert.equal((await detail(o)).json.order.operation.primary.code, "collect");
});
test("U17 vendedor tiene acciones operativas y nunca acciones financieras ni cierre", async () => {
  const o = await create(); const cookie = fixture.context.vendorCookie;
  let op = (await detail(o, cookie)).json.order.operation; assert.equal(op.primary.code, "prepare"); assert.equal(op.canCancel, false); assert.equal(op.canReconcile, false);
  await status(o, "en_preparacion", cookie); await ship(o, cookie); await status(o, "entregado", cookie);
  op = (await detail(o, cookie)).json.order.operation; assert.equal(op.primary.code, "waiting_collection"); assert.equal(op.canCollect, false); assert.equal(op.canReturn, false);
  assert.equal((await api("PATCH", `/api/admin/orders/${o._id}/payment`, { cookie, body: {} })).status, 403);
  assert.equal((await status(o, "cancelado", cookie)).status, 403);
});
test("U18 administrador obtiene consulta Wompi verificable, nunca aprobación manual", async () => {
  const o = await create("wompi"); await patch(o, { "wompi.transactionId": "tx-ficticia" });
  assert.equal((await detail(o)).json.order.operation.canReconcile, true);
  assert.equal((await detail(o, fixture.context.vendorCookie)).json.order.operation.canReconcile, false);
  assert.equal((await api("PATCH", `/api/admin/orders/${o._id}/payment`, { cookie: fixture.context.adminCookie, body: { paymentStatus: "pagado" } })).status, 409);
});
test("U19 guía y despacho son una operación atómica, sin segundo cambio de estado", async () => {
  const o = await create(); await status(o, "en_preparacion"); assert.equal((await ship(o)).status, 200);
  const saved = (await detail(o)).json.order; assert.equal(saved.orderStatus, "enviado"); assert.equal(saved.trackingNumber, "GUIA-FICTICIA"); assert.equal(saved.paymentStatus, "pendiente");
  assert.equal(await Notification.countDocuments({ order: o._id, event: "order.shipped" }), 1);
});
test("U20 despacho inválido no guarda parcialmente la transportadora", async () => {
  const o = await create(); await status(o, "en_preparacion");
  const r = await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: fixture.context.adminCookie, body: { carrier: "servientrega", trackingNumber: "" } });
  assert.equal(r.status, 400); const saved = await fixture.context.Order.findById(o._id); assert.equal(saved.orderStatus, "en_preparacion"); assert.equal(saved.carrier, o.carrier);
});
test("U21 incidencia bloquea despacho y presenta revisión, no formulario operativo", async () => {
  const o = await create(); await status(o, "en_preparacion"); await patch(o, { incidents: [{ code: "approved_without_stock" }] });
  assert.equal((await detail(o)).json.order.operation.primary.code, "review");
  assert.equal((await ship(o)).status, 409); assert.equal((await list("tray=dispatch")).json.total, 0);
});
test("U22 tres despachos concurrentes y tres entregas publican una notificación por hecho", async () => {
  const o = await create(); await status(o, "en_preparacion");
  assert.ok((await Promise.all([ship(o), ship(o), ship(o)])).every((r) => r.status === 200));
  assert.ok((await Promise.all([status(o, "entregado"), status(o, "entregado"), status(o, "entregado")])).every((r) => r.status === 200));
  for (const event of ["order.shipped", "order.delivered"]) assert.equal(await Notification.countDocuments({ order: o._id, event }), 1);
  assert.equal((await detail(o)).json.order.paymentStatus, "pendiente");
});
test("U23 consultas, filtros y dashboard no alteran pagos, inventario ni notificaciones", async () => {
  const o = await create(); const before = await fixture.context.Order.collection.findOne({ _id: o._id });
  const notices = await Notification.countDocuments(); const stock = await fixture.context.Product.findById(o.items[0].product).lean();
  await list("tray=prepare"); await detail(o); await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie });
  assert.deepEqual(await fixture.context.Order.collection.findOne({ _id: o._id }), before);
  assert.equal(await Notification.countDocuments(), notices); assert.deepEqual(await fixture.context.Product.findById(o.items[0].product).lean(), stock);
});
test("U24 ventas conciliadas excluyen cancelados e incidencias aunque la bandera sea antigua", async () => {
  const good = await create(), bad = await create(), disputed = await create();
  await patch(good, { paymentStatus: "pagado", total: 80000 }); await patch(bad, { paymentStatus: "pagado", orderStatus: "cancelado", total: 50000 });
  await patch(disputed, { paymentStatus: "pagado", requiresReview: false, incidents: [{ code: "x" }], total: 30000 });
  const r = await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie });
  assert.equal(r.json.dashboard.orders.revenueMonth, 80000);
});
test("U25 pedidos históricos siguen consultables y sin inventar fechas de entrega", async () => {
  const o = await create(); await fixture.context.Order.collection.updateOne({ _id: o._id }, { $set: { orderNumber: "DIZ-20240115-0007", paymentMethod: "nequi_manual" }, $unset: { stockDeducted: "", deliveredAt: "", checkoutState: "" } });
  assert.equal((await list("tray=all&q=DIZ-20240115-0007")).json.total, 1);
  const r = await detail(o); assert.equal(r.status, 200); assert.equal(r.json.order.orderNumber, "DIZ-20240115-0007"); assert.equal(r.json.order.deliveredAt, null);
});
test("U26 intervalo de fechas usa el día colombiano completo y rechaza fechas imposibles", async () => {
  const before = await create(), first = await create(), last = await create(), after = await create();
  for (const [o, date] of [[before, "2026-11-20T04:59:59.999Z"], [first, "2026-11-20T05:00:00Z"], [last, "2026-11-21T04:59:59.999Z"], [after, "2026-11-21T05:00:00Z"]]) await patch(o, { createdAt: new Date(date) });
  assert.deepEqual(new Set(ids(await list("from=2026-11-20&to=2026-11-20"))), new Set([String(first._id), String(last._id)]));
  assert.equal((await list("from=2026-02-30")).status, 400); assert.equal((await list("from=2026-11-21&to=2026-11-20")).status, 400);
  assert.equal((await list("from=2026-11-20T12:00:00")).status, 400);
});
test("U27 límites de hoy y mes son independientes de la zona horaria del servidor", () => {
  assert.equal(workspace.bogotaPeriod(new Date("2026-12-01T04:59:59Z")).today.toISOString(), "2026-11-30T05:00:00.000Z");
  assert.equal(workspace.bogotaPeriod(new Date("2026-12-01T05:00:00Z")).monthStart.toISOString(), "2026-12-01T05:00:00.000Z");
});
test("U28 despacho hoy se mide por historial, no por una edición de metadatos", async () => {
  const o = await create(); await status(o, "en_preparacion"); await ship(o); await status(o, "entregado");
  const r = await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie });
  assert.equal(r.json.dashboard.orders.shippedToday, 1); assert.equal(r.json.dashboard.deliveredToday, 1);
  await patch(o, { deliveredAt: null, statusHistory: [{ status: "enviado", changedAt: new Date("2020-01-01") }], updatedAt: new Date() });
  assert.equal((await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie })).json.dashboard.orders.shippedToday, 0);
});
test("U29 comunicaciones fallidas cuentan pedidos distintos y conservan los permisos", async () => {
  const o = await create(); await Notification.updateMany({ order: o._id }, { $set: { status: "failed", errorCode: "permanent_error" } });
  assert.equal((await list("tray=communications")).json.total, 1); assert.equal((await list("tray=communications")).json.orders[0].communicationFailure, true);
  assert.equal((await list("tray=communications", fixture.context.vendorCookie)).status, 403);
  const vendor = await list("tray=all", fixture.context.vendorCookie); assert.equal(vendor.json.counts.communications, undefined); assert.equal(vendor.json.orders[0].communicationFailure, false);
});
test("U30 historial de comunicaciones conserva rutas y restricciones de Fase 2", async () => {
  const o = await create(); const r = await api("GET", `/api/admin/orders/${o._id}/communications`, { cookie: fixture.context.vendorCookie });
  assert.equal(r.status, 200); assert.ok(r.json.notifications.every((n) => !n.canResend && !n.retryable && n.audience === "buyer"));
  assert.equal(r.json.deliveryEnabled, false); assert.equal(process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED, "false");
});
test("U31 incidencias resueltas dejan de bloquear la preparación", async () => {
  const o = await create(); await patch(o, { incidents: [{ code: "payment_processing_failed", resolvedAt: new Date() }], requiresReview: false });
  assert.equal((await list("tray=prepare")).json.total, 1); assert.equal((await list("tray=review")).json.total, 0);
  assert.equal((await detail(o)).json.order.operation.primary.code, "prepare");
});
test("U32 exportación conserva la bandeja y rechaza filtros inválidos", async () => {
  await create(); const r = await api("GET", "/api/admin/orders/export/pdf?tray=prepare", { cookie: fixture.context.adminCookie });
  assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /pdf/);
  assert.equal((await list("tray=not-a-tray")).status, 400); assert.equal((await list("carrier=other")).status, 400);
});
test("U33 corregir hoy una guía despachada ayer no cuenta otro despacho", async () => {
  const o = await create(); await status(o, "en_preparacion"); await ship(o);
  await patch(o, { statusHistory: [{ status: "enviado", changedAt: new Date("2020-01-01"), note: "Guía registrada" }] });
  const r = await api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: fixture.context.adminCookie, body: { carrier: "servientrega", trackingNumber: "GUIA-CORREGIDA" } });
  assert.equal(r.status, 200);
  const d = await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie });
  assert.equal(d.json.dashboard.orders.shippedToday, 0);
  assert.equal((await api("GET", "/api/admin/orders/stats", { cookie: fixture.context.vendorCookie })).json.stats.shippedToday, 0);
});
test("U34 recaudar hoy un pedido entregado antes no cuenta otra entrega", async () => {
  const o = await create(); await status(o, "en_preparacion"); await ship(o); await status(o, "entregado");
  await patch(o, { deliveredAt: new Date("2020-01-01"), statusHistory: [{ status: "entregado", changedAt: new Date("2020-01-01") }] });
  const r = await api("PATCH", `/api/admin/orders/${o._id}/payment`, { cookie: fixture.context.adminCookie,
    body: { reference: "GIRO-OTRO-DIA", receivedAt: new Date(Date.now() - 1000).toISOString() } });
  assert.equal(r.status, 200);
  assert.equal((await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie })).json.dashboard.deliveredToday, 0);
  // Missing legacy deliveredAt can use only the FIRST recorded delivery.
  await patch(o, { deliveredAt: null });
  assert.equal((await api("GET", "/api/admin/dashboard", { cookie: fixture.context.adminCookie })).json.dashboard.deliveredToday, 0);
});
