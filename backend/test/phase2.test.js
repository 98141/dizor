"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fixture = require("./helpers/phase2Fixture.cjs");
const Notification = require("../src/models/notification");
const delivery = require("../src/services/notificationDelivery");
const { mutateOrder, transition } = require("../src/services/orderOperations");
const { inTransaction } = require("../src/services/transactionService");
const { enqueue } = require("../src/services/notificationEvents");
const { buildMessage, snapshotOrder } = require("../src/services/notificationTemplates");
let inbox, calls, paymentLinks = new Map();
const accept = async (message, { idempotencyKey }) => {
  calls.push({ message: structuredClone(message), key: idempotencyKey });
  if (inbox.has(idempotencyKey)) {
    assert.deepEqual(inbox.get(idempotencyKey).message, message);
    return { data: { id: inbox.get(idempotencyKey).id } };
  }
  const record = { id: `fake-${crypto.randomUUID()}`, message: structuredClone(message) };
  inbox.set(idempotencyKey, record); return { data: { id: record.id } };
};
const newOrder = async (method = "contra_entrega", cookie, extra = {}) => {
  const { product, variantId } = await fixture.makeProduct(100);
  const r = await fixture.api("POST", "/api/checkout/orders", { cookie,
    body: fixture.orderBody(product, variantId, { paymentMethod: method, ...extra }) });
  assert.equal(r.status, 201, r.text);
  const receipt = await Notification.findOne({ order: r.json.order.id, event: "order.received" });
  if (receipt) await delivery.processOne(receipt._id); // simulate the worker after HTTP commit
  return fixture.context.Order.findById(r.json.order.id);
};
const events = (order, event) => Notification.find({ order: order._id, ...(event ? { event } : {}) }).select("+recipient +snapshot +message +reason");
const status = (order, orderStatus, cookie = fixture.context.adminCookie) => fixture.api("PATCH", `/api/admin/orders/${order._id}/status`, { cookie, body: { orderStatus } });
const ship = async (order) => {
  assert.equal((await status(order, "en_preparacion")).status, 200);
  const r = await fixture.api("PATCH", `/api/admin/orders/${order._id}/shipping`, { cookie: fixture.context.adminCookie, body: { carrier: "servientrega", trackingNumber: "FICTICIA-1" } });
  assert.equal(r.status, 200, r.text);
};
const notification = async (order, event) => { const rows = await events(order, event); assert.equal(rows.length, 1); return rows[0]; };
const rawOrder = (o) => fixture.context.Order.collection.findOne({ _id: o._id });
const list = (o, cookie = fixture.context.adminCookie) => fixture.api("GET", `/api/admin/orders/${o._id}/communications`, { cookie });
const retry = (o, n, cookie = fixture.context.adminCookie) => fixture.api("POST", `/api/admin/orders/${o._id}/communications/${n._id}/retry`, { cookie });
const resend = (o, n, body, cookie = fixture.context.adminCookie) => fixture.api("POST", `/api/admin/orders/${o._id}/communications/${n._id}/resend`, { cookie, body });

test.before(async () => {
  await fixture.setup(); await Notification.init();
  const fetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.hostname === "sandbox.wompi.co" && url.pathname.startsWith("/v1/payment_links/")) {
      const id = decodeURIComponent(url.pathname.split("/").at(-1));
      return Promise.resolve(new Response(JSON.stringify({ data: paymentLinks.get(id) }), { status: paymentLinks.has(id) ? 200 : 404 }));
    }
    return fetch(input, init);
  };
});
test.beforeEach(async () => {
  await Notification.deleteMany({}); calls = []; inbox = new Map(); paymentLinks.clear();
  process.env.ADMIN_NOTIFY_EMAIL = "notify@example.test";
  process.env.EMAIL_FROM = "DIZOR <sender@example.test>";
  process.env.RESEND_API_KEY = "";
  delivery.setReceiptTransport(null); delivery.setTransportForTests(accept);
});
test.after(async () => { try { assert.deepEqual(fixture.context.blocked, []); } finally { await fixture.close(); } });

test("N01 contraentrega crea acuse y aviso administrativo, sin confirmar pago", async () => {
  const o = await newOrder();
  assert.deepEqual((await events(o)).map((n) => n.event).sort(), ["admin.ready", "order.received"]);
  assert.equal((await rawOrder(o)).paymentStatus, "pendiente");
  await delivery.processBatch(); assert.equal(inbox.size, 2);
  assert.equal((await notification(o, "admin.ready")).recipient, process.env.ADMIN_NOTIFY_EMAIL);
});
test("N02 Wompi creado solo acusa recepción, sin correo de pago ni listo para preparar", async () => {
  const o = await newOrder("wompi");
  assert.deepEqual((await events(o)).map((n) => n.event), ["order.received"]);
  assert.match(calls[0].message.text, /Crear el enlace no confirma el pago/);
});
test("N03 Wompi aprobado crea pago y pedido listo, con destinatarios correctos", async () => {
  const o = await newOrder("wompi"); assert.equal((await fixture.postEvent(fixture.txFor(o))).status, 200);
  await delivery.processBatch();
  assert.equal((await notification(o, "payment.approved")).status, "sent");
  assert.equal((await notification(o, "admin.ready")).status, "sent");
  assert.equal((await notification(o, "payment.approved")).recipient, o.buyer.email);
});
test("N04 rechazo sin enlace verificable ofrece atención sin inventar URL", async () => {
  const o = await newOrder("wompi"); await fixture.postEvent(fixture.txFor(o, { status: "DECLINED" }));
  const n = await notification(o, "payment.declined"); await delivery.processOne(n._id);
  const saved = await Notification.findById(n._id).select("+message");
  assert.match(saved.message.text, /no cancela automáticamente/); assert.doesNotMatch(saved.message.html, /Revisar pago en Wompi/);
});
test("N05 rechazo solo ofrece enlace consultado activo, monto correcto y no vencido", async () => {
  const o = await newOrder("wompi"); paymentLinks.set(o.wompi.paymentLinkId, { id: o.wompi.paymentLinkId, active: true, currency: "COP", amount_in_cents: o.total * 100, expires_at: "2099-01-01T00:00:00Z" });
  await fixture.postEvent(fixture.txFor(o, { status: "DECLINED" }));
  await delivery.processOne((await notification(o, "payment.declined"))._id);
  const n = await notification(o, "payment.declined"); assert.match(n.message.html, /Revisar pago en Wompi/);
  assert.ok(n.message.text.includes(o.wompi.paymentLinkUrl));
});
test("N06 enlace vencido o monto distinto nunca se ofrece para reintento", async () => {
  const o = await newOrder("wompi"); paymentLinks.set(o.wompi.paymentLinkId, { id: o.wompi.paymentLinkId, active: true, currency: "COP", amount_in_cents: 1, expires_at: "2000-01-01" });
  await fixture.postEvent(fixture.txFor(o, { status: "DECLINED" })); await delivery.processOne((await notification(o, "payment.declined"))._id);
  assert.doesNotMatch((await notification(o, "payment.declined")).message.html, /Revisar pago en Wompi/);
});
test("N07 webhook repetido secuencial no genera mensajes nuevos", async () => {
  const o = await newOrder("wompi"), tx = fixture.txFor(o);
  await fixture.postEvent(tx); const count = await Notification.countDocuments({ order: o._id });
  await fixture.postEvent(tx); await fixture.postEvent(tx); assert.equal(await Notification.countDocuments({ order: o._id }), count);
});
test("N08 tres aprobaciones concurrentes crean una sola confirmación de cada tipo", async () => {
  const o = await newOrder("wompi"), tx = fixture.txFor(o);
  const rs = await Promise.all(Array.from({ length: 3 }, () => fixture.postEvent(tx))); assert.ok(rs.every((r) => r.status === 200));
  await notification(o, "payment.approved"); await notification(o, "admin.ready");
});
test("N09 preparar no envía un correo de pago ni otro aviso listo", async () => {
  const o = await newOrder(); const before = await Notification.countDocuments({ order: o._id });
  assert.equal((await status(o, "en_preparacion")).status, 200);
  assert.equal(await Notification.countDocuments({ order: o._id }), before);
});
test("N10 despachar con guía genera comunicación única, sin marcar pago", async () => {
  const o = await newOrder(); await ship(o); await delivery.processBatch();
  const n = await notification(o, "order.shipped"); assert.match(n.message.text, /Servientrega/); assert.match(n.message.text, /FICTICIA-1/);
  assert.equal((await rawOrder(o)).paymentStatus, "pendiente");
});
test("N11 corregir guía crea evento distinguible y suprime pendiente con guía antigua", async () => {
  const o = await newOrder(); await ship(o);
  const r = await fixture.api("PATCH", `/api/admin/orders/${o._id}/shipping`, { cookie: fixture.context.adminCookie, body: { trackingNumber: "CORREGIDA" } }); assert.equal(r.status, 200);
  await delivery.processBatch();
  assert.equal((await notification(o, "order.shipped")).errorCode, "superseded");
  assert.match((await notification(o, "shipping.corrected")).message.text, /CORREGIDA/);
});
test("N12 entregar contraentrega comunica entrega y distingue recaudo pendiente", async () => {
  const o = await newOrder(); await ship(o); assert.equal((await status(o, "entregado")).status, 200); await delivery.processBatch();
  assert.match((await notification(o, "order.delivered")).message.text, /recaudo aún figura pendiente/);
  assert.equal((await rawOrder(o)).paymentStatus, "pendiente");
});
test("N13 cancelación del cliente avisa a comprador y administrador una sola vez", async () => {
  const o = await newOrder("contra_entrega", fixture.context.clientCookie);
  assert.equal((await fixture.api("PATCH", `/api/checkout/orders/${o._id}/cancel`, { cookie: fixture.context.clientCookie })).status, 200);
  await notification(o, "order.cancelled"); await notification(o, "admin.cancelled");
});
test("N14 cancelación administrativa no se atribuye al cliente ni inventa reembolso", async () => {
  const o = await newOrder(); await status(o, "cancelado"); await delivery.processBatch();
  const n = await notification(o, "order.cancelled"); assert.match(n.message.text, /no confirma un pago ni un reembolso/);
  assert.equal((await events(o, "admin.cancelled")).length, 0);
});
test("N15 aprobación tras cancelación alerta solo de la incidencia, sin compra normal", async () => {
  const o = await newOrder("wompi"); await status(o, "cancelado"); await fixture.postEvent(fixture.txFor(o));
  assert.ok((await events(o, "admin.incident")).length > 0);
  assert.equal((await events(o, "payment.approved")).length, 0); assert.equal((await events(o, "admin.ready")).length, 0);
});
test("N16 pago sin inventario notifica revisión y no indica pedido listo", async () => {
  const o = await newOrder("wompi");
  await fixture.context.Product.updateOne({ _id: o.items[0].product, "variants._id": o.items[0].variantId }, { $set: { "variants.$.stock": 0 } });
  await fixture.postEvent(fixture.txFor(o)); await delivery.processBatch();
  await notification(o, "payment.review"); assert.ok((await events(o, "admin.incident")).length);
  assert.equal((await events(o, "admin.ready")).length, 0); assert.equal((await events(o, "payment.approved")).length, 0);
});
test("N17 proveedor no configurado queda no enviado, nunca aceptado", async () => {
  delivery.setTransportForTests(null); const o = await newOrder();
  const n = await notification(o, "order.received"); assert.equal(n.status, "skipped"); assert.equal(n.errorCode, "service_not_configured");
  assert.equal(n.acceptedAt, null); assert.equal((await rawOrder(o)).buyerReceipt.sentAt, null);
});
test("N18 error temporal deja reintento acotado y no cambia pedido ni inventario", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"), before = await rawOrder(o);
  delivery.setTransportForTests(async () => ({ error: { statusCode: 503, message: "SECRETO NO EXPONER" } })); await delivery.processOne(n._id);
  const after = await Notification.findById(n._id); assert.equal(after.status, "failed"); assert.ok(after.retryable && after.nextAttemptAt);
  assert.deepEqual(await rawOrder(o), before); assert.doesNotMatch(JSON.stringify((await list(o)).json), /SECRETO/);
});
test("N19 error permanente no se repite automáticamente", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready");
  delivery.setTransportForTests(async () => ({ error: { statusCode: 400, name: "validation_error" } })); await delivery.processOne(n._id);
  const after = await Notification.findById(n._id); assert.equal(after.retryable, false); assert.equal(after.nextAttemptAt, null);
  assert.equal(await delivery.processOne(n._id), null);
});
test("N20 reintentar pendiente conserva fila, clave e historial", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready");
  delivery.setTransportForTests(async () => ({ error: { statusCode: 429 } })); await delivery.processOne(n._id);
  assert.equal((await retry(o, n)).status, 202); delivery.setTransportForTests(accept); await delivery.processOne(n._id);
  const after = await Notification.findById(n._id); assert.equal(after.status, "sent"); assert.equal(after.attempts, 2); assert.equal(after.eventKey, n.eventKey);
  assert.ok(after.history.some((h) => h.outcome === "retry_requested"));
});
test("N21 tres reintentos concurrentes reclaman una sola entrega", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"), before = calls.length;
  await Promise.all(Array.from({ length: 3 }, () => delivery.processOne(n._id))); assert.equal(calls.length - before, 1);
});
test("N22 reenvío manual autorizado conserva original, responsable y motivo", async () => {
  const o = await newOrder(), n = await notification(o, "order.received"), before = await rawOrder(o);
  const r = await resend(o, n, { requestKey: crypto.randomUUID(), reason: "Cliente solicita una copia", confirmed: true }); assert.equal(r.status, 202, r.text);
  const copy = await Notification.findById(r.json.id).select("+reason"); assert.equal(String(copy.resendOf), String(n._id)); assert.ok(copy.requestedBy); assert.match(copy.reason, /Cliente/);
  assert.deepEqual(await rawOrder(o), before); await delivery.processOne(copy._id); assert.equal((await Notification.findById(n._id)).status, "sent");
});
test("N23 tres solicitudes de reenvío con la misma clave crean una sola copia", async () => {
  const o = await newOrder(), n = await notification(o, "order.received"), body = { requestKey: crypto.randomUUID(), reason: "Copia solicitada por comprador", confirmed: true };
  const rs = await Promise.all(Array.from({ length: 3 }, () => resend(o, n, body))); assert.ok(rs.every((r) => r.status === 202), JSON.stringify(rs));
  assert.equal(new Set(rs.map((r) => r.json.id)).size, 1); assert.equal(await Notification.countDocuments({ resendOf: n._id }), 1);
});
test("N24 vendedor solo consulta comunicaciones operativas, sin acciones ni destinatario administrativo", async () => {
  const o = await newOrder(), n = await notification(o, "order.received"), r = await list(o, fixture.context.vendorCookie);
  assert.equal(r.status, 200); assert.ok(r.json.notifications.every((row) => row.audience === "buyer" && !row.retryable && !row.canResend));
  assert.equal((await retry(o, n, fixture.context.vendorCookie)).status, 403);
  assert.equal((await resend(o, n, {}, fixture.context.vendorCookie)).status, 403);
});
test("N25 cliente y usuario anónimo no acceden al historial administrativo", async () => {
  const o = await newOrder(); assert.equal((await list(o, fixture.context.clientCookie)).status, 403);
  assert.equal((await list(o, "")).status, 401);
});
test("N26 plantillas escapan HTML y excluyen notas, costos, credenciales y tokens", async () => {
  const o = await newOrder(); const snapshot = snapshotOrder({ ...o.toObject(), customerNotes: "PRIVADO", password: "PASSWORD", items: [{ productName: '<script>alert("x")</script>&', quantity: 1, unitCost: 424242, lineTotal: 100 }] });
  const m = buildMessage("order.received", snapshot, { retryUrl: "javascript:alert(1)" });
  assert.doesNotMatch(m.html, /<script>|PRIVADO|424242|PASSWORD|javascript:/); assert.match(m.html, /&lt;script&gt;/); assert.match(m.text, /<script>/);
  assert.doesNotMatch(buildMessage("order.received", snapshot, { retryUrl: "https://checkout.wompi.co/l/FICTICIO" }).html, /Revisar pago en Wompi/);
});
test("N27 destinatario inválido o inexistente no se entrega", async () => {
  const o = await newOrder(); await fixture.context.Order.updateOne({ _id: o._id }, { $set: { "buyer.email": "correo-invalido" } });
  await mutateOrder(o._id, async (current, session) => enqueue(current, "order.received", "invalid", session));
  const row = await Notification.findOne({ order: o._id, errorCode: "invalid_recipient" }); assert.ok(row); assert.equal(row.status, "skipped");
  process.env.ADMIN_NOTIFY_EMAIL = "";
  await mutateOrder(o._id, async (current, session) => enqueue(current, "admin.incident", "missing", session));
  assert.ok(await Notification.exists({ order: o._id, errorCode: "recipient_missing", status: "skipped" }));
});
test("N28 transacción revertida elimina evento y no invoca proveedor", async () => {
  const o = await newOrder(), before = await Notification.countDocuments({ order: o._id }), attempts = calls.length;
  await assert.rejects(inTransaction(async (session) => {
    const order = await fixture.context.Order.findById(o._id).session(session);
    await enqueue(order, "order.delivered", "rollback", session); order.orderStatus = "entregado"; await order.save({ session }); throw new Error("rollback ficticio");
  }));
  assert.equal(await Notification.countDocuments({ order: o._id }), before); assert.equal(calls.length, attempts); assert.equal((await rawOrder(o)).orderStatus, "pendiente");
});
test("N29 interrupción después de aceptación reutiliza la clave del proveedor", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"), original = Notification.updateOne;
  Notification.updateOne = function (filter, update, ...rest) { if (update?.$set?.status === "sent") throw new Error("Proceso interrumpido"); return original.call(this, filter, update, ...rest); };
  try { await assert.rejects(delivery.processOne(n._id)); } finally { Notification.updateOne = original; }
  assert.equal((await Notification.findById(n._id)).status, "processing");
  await Notification.updateOne({ _id: n._id }, { $set: { leaseUntil: new Date(0) } });
  const acceptedBefore = inbox.size; await delivery.processOne(n._id); assert.equal(inbox.size, acceptedBefore);
  assert.equal((await Notification.findById(n._id)).status, "sent");
});
test("N30 resultado ambiguo fuera de 23h no se vuelve a enviar ciegamente", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"), before = calls.length;
  await Notification.updateOne({ _id: n._id }, { $set: { status: "processing", firstAttemptAt: new Date(Date.now() - 24 * 3600000), leaseUntil: new Date(0) } });
  assert.equal(await delivery.processOne(n._id), null); assert.equal(calls.length, before);
  const after = await Notification.findById(n._id); assert.equal(after.errorCode, "review_required"); assert.equal(after.retryable, false);
});
test("N31 alertas agrupan fallos sin generar correos por fallos", async () => {
  delivery.setTransportForTests(null); const o = await newOrder(); await delivery.processBatch();
  const r = await fixture.api("GET", "/api/admin/alerts", { cookie: fixture.context.adminCookie }); assert.equal(r.status, 200);
  assert.ok(r.json.alerts.communications.count >= 1); assert.ok(r.json.alerts.communications.items.some((i) => String(i.orderId) === String(o._id)));
  assert.equal((await events(o)).length, 2);
});
test("N32 variante agotada y producto sin variantes disponibles aparecen una vez", async () => {
  const { product } = await fixture.makeProduct(0); const other = await fixture.makeProduct(10);
  await fixture.context.Product.updateOne({ _id: other.product._id }, { $set: { "variants.$[].isActive": false } });
  const r = await fixture.api("GET", "/api/admin/alerts", { cookie: fixture.context.adminCookie });
  const items = r.json.alerts.outOfStock.items; assert.equal(items.filter((i) => i.id === String(product._id)).length, 1);
  assert.ok(items.some((i) => i.id === String(other.product._id) && i.unavailable));
});
test("N33 acuse existente no se duplica y sent no significa delivered", async () => {
  const o = await newOrder(), before = calls.length;
  await require("../src/services/orderReceiptService").sendOrderReceiptOnce(o._id);
  const n = await notification(o, "order.received"); assert.equal(calls.length, before); assert.equal(n.status, "sent"); assert.equal(n.deliveredAt, null); assert.ok(n.acceptedAt && n.providerId);
});
test("N34 nunca se entrega un rechazo desactualizado después de la aprobación", async () => {
  const o = await newOrder("wompi"); await fixture.postEvent(fixture.txFor(o, { status: "DECLINED" })); await fixture.postEvent(fixture.txFor(o));
  await delivery.processBatch(); assert.equal((await notification(o, "payment.declined")).errorCode, "superseded");
});
test("N35 el historial oculta snapshots, cuerpos, emails completos y errores del proveedor", async () => {
  const o = await newOrder(), r = await list(o);
  const body = JSON.stringify(r.json); assert.doesNotMatch(body, /snapshot|message|unitCost|tokenHash|providerId/); assert.ok(!body.includes(o.buyer.email)); assert.ok(body.includes("***"));
});

test("N36 claves distintas concurrentes no acumulan reenvíos pendientes del mismo original", async () => {
  const o = await newOrder(), n = await notification(o, "order.received");
  const rs = await Promise.all(Array.from({ length: 3 }, () => resend(o, n, { requestKey: crypto.randomUUID(), confirmed: true, reason: "Solicito nueva copia" })));
  assert.equal(rs.filter((r) => r.status === 202).length, 1); assert.ok(rs.every((r) => [202, 409].includes(r.status)));
  assert.equal(await Notification.countDocuments({ resendOf: n._id }), 1);
  assert.equal((await list(o)).json.notifications.find((r) => r.id === String(n._id)).canResend, false);
});
test("N37 errores temporales se acotan a cinco intentos y no se reinician para siempre", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready");
  let attempts = 0; delivery.setTransportForTests(async () => { attempts++; return { error: { statusCode: 503 } }; });
  for (let i = 0; i < 6; i++) { await Notification.updateOne({ _id: n._id }, { $set: { nextAttemptAt: new Date(0) } }); await delivery.processOne(n._id); }
  assert.equal(attempts, 5); const row = await Notification.findById(n._id); assert.equal(row.attempts, 5); assert.equal(row.retryable, false);
});
test("N38 reintento manual concurrente conserva una sola petición de recuperación", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready");
  delivery.setTransportForTests(async () => ({ error: { statusCode: 429 } })); await delivery.processOne(n._id);
  const rs = await Promise.all(Array.from({ length: 3 }, () => retry(o, n))); assert.ok(rs.every((r) => r.status === 202));
  const row = await Notification.findById(n._id); assert.equal(row.history.filter((h) => h.outcome === "retry_requested").length, 1);
});
test("N39 cambiar destinatario impide enviar la instantánea al correo anterior", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"); process.env.ADMIN_NOTIFY_EMAIL = "other@example.test";
  const before = calls.length; await delivery.processOne(n._id); assert.equal(calls.length, before);
  assert.equal((await Notification.findById(n._id)).errorCode, "recipient_changed");
});
test("N40 una comunicación no puede reenviarse mediante el identificador de otro pedido", async () => {
  const o = await newOrder(), other = await newOrder(), n = await notification(o, "order.received");
  assert.equal((await resend(other, n, { requestKey: crypto.randomUUID(), confirmed: true, reason: "Nueva copia" })).status, 404);
});
test("N41 reenvío exige confirmación, motivo y reconocimiento del resultado ambiguo", async () => {
  const o = await newOrder(), n = await notification(o, "order.received"); assert.equal((await resend(o, n, {})).status, 400);
  await Notification.updateOne({ _id: n._id }, { $set: { status: "failed", ambiguous: true, retryable: false } });
  assert.equal((await resend(o, n, { requestKey: crypto.randomUUID(), reason: "Nueva copia", confirmed: true })).status, 409);
});
test("N42 corrección repetida de la misma guía no crea una nueva comunicación", async () => {
  const o = await newOrder(); await ship(o); const url = `/api/admin/orders/${o._id}/shipping`, body = { trackingNumber: "CORRECCION-UNICA" };
  await fixture.api("PATCH", url, { cookie: fixture.context.adminCookie, body }); await fixture.api("PATCH", url, { cookie: fixture.context.adminCookie, body });
  await notification(o, "shipping.corrected");
});
test("N43 falla de persistencia outbox revierte transición sin enviar correos", async () => {
  const o = await newOrder(); await status(o, "en_preparacion"); const original = Notification.findOneAndUpdate;
  Notification.findOneAndUpdate = () => { throw new Error("Outbox no disponible"); }; const attempts = calls.length;
  try { await assert.rejects(mutateOrder(o._id, async (order, session) => {
    order.carrier = "servientrega"; order.trackingNumber = "NO-COMMIT";
    await transition(order, "enviado", { id: null, role: "admin" }, "Prueba", session);
  })); } finally { Notification.findOneAndUpdate = original; }
  assert.equal((await rawOrder(o)).orderStatus, "en_preparacion"); assert.equal((await events(o, "order.shipped")).length, 0); assert.equal(calls.length, attempts);
});
test("N44 aceptación correcta exige identificador del proveedor y nunca inventa entrega", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"); delivery.setTransportForTests(async () => ({ data: {} }));
  await delivery.processOne(n._id); const row = await Notification.findById(n._id); assert.equal(row.status, "failed"); assert.equal(row.acceptedAt, null); assert.equal(row.deliveredAt, null);
});
test("N45 registro histórico de acuse no se reenvía automáticamente", async () => {
  const o = await newOrder(); await Notification.deleteMany({ order: o._id }); const before = calls.length;
  await require("../src/services/orderReceiptService").sendOrderReceiptOnce(o._id); assert.equal(calls.length, before);
  const r = await list(o); assert.ok(r.json.legacyReceipt?.unverified); assert.equal(r.json.notifications.length, 0);
});
test("N46 un rechazo permanente conserva su clasificación después de 24 horas", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready"); delivery.setTransportForTests(async () => ({ error: { statusCode: 400 } })); await delivery.processOne(n._id);
  await Notification.updateOne({ _id: n._id }, { $set: { firstAttemptAt: new Date(0) } }); await delivery.processOne(n._id);
  assert.equal((await Notification.findById(n._id)).errorCode, "permanent_error");
});

test("N47 recuperación de incidente persistido antes de una interrupción crea alerta una sola vez", async () => {
  const o = await newOrder("wompi");
  await fixture.context.Order.updateOne({ _id: o._id }, { $set: { requiresReview: true }, $push: { incidents: { code: "checkout_completion_failed", detail: "Interrupción simulada" } } });
  const before = await rawOrder(o); await delivery.recoverIncidents(); await delivery.recoverIncidents();
  assert.equal((await events(o, "admin.incident")).length, 1); const after = await rawOrder(o);
  assert.equal(after.paymentStatus, before.paymentStatus); assert.equal(after.stockDeducted, before.stockDeducted); assert.equal(after.orderStatus, before.orderStatus);
});
test("N48 inbox financiero interrumpido genera aviso administrativo sin ejecutar el pago otra vez", async () => {
  const o = await newOrder("wompi");
  await fixture.context.Order.updateOne({ _id: o._id }, { $set: { paymentStatus: "pagado", requiresReview: true } });
  const event = await require("../src/models/paymentEvent").create({ key: crypto.randomUUID(), order: o._id, transactionId: "FICTICIA-INTERRUMPIDA", status: "APPROVED", amountInCents: o.total * 100 });
  await require("../src/models/paymentEvent").updateOne({ _id: event._id }, { $set: { updatedAt: new Date(Date.now() - 120000) } }, { timestamps: false });
  await delivery.recoverIncidents(); await delivery.recoverIncidents();
  assert.equal((await events(o, "admin.incident")).length, 1);
  assert.equal((await rawOrder(o)).stockDeducted, false); assert.equal((await events(o, "payment.approved")).length, 0);
});

test("N49 recuperación de comunicaciones no altera la fecha operativa del pedido", async () => {
  const o = await newOrder("wompi");
  await fixture.context.Order.updateOne({ _id: o._id }, { $set: { requiresReview: true, updatedAt: new Date("2024-01-01T00:00:00Z") }, $push: { incidents: { code: "payment_processing_failed", detail: "Prueba de fecha" } } }, { timestamps: false });
  await delivery.recoverIncidents(); assert.equal((await rawOrder(o)).updatedAt.toISOString(), "2024-01-01T00:00:00.000Z");
});

test("N50 incidentes históricos sin ID ni fecha no crean alertas nuevas en cada lectura", async () => {
  const o = await newOrder("wompi");
  await fixture.context.Order.collection.updateOne({ _id: o._id }, { $set: { requiresReview: true, incidents: [{ code: "approved_without_stock", detail: "Histórico sin ID" }] } });
  await delivery.recoverIncidents(); await delivery.recoverIncidents(); await delivery.recoverIncidents();
  assert.equal((await events(o, "admin.incident")).length, 1);
});

test("N51 reenvío explícito detiene el reintento automático anterior y resuelve su alerta", async () => {
  const o = await newOrder(), n = await notification(o, "admin.ready");
  delivery.setTransportForTests(async () => ({ error: { statusCode: 503 } })); await delivery.processOne(n._id);
  const r = await resend(o, n, { requestKey: crypto.randomUUID(), confirmed: true, reason: "Recuperación explícita del aviso", acknowledgeDuplicateRisk: true }); assert.equal(r.status, 202, r.text);
  const original = await Notification.findById(n._id); assert.equal(original.retryable, false); assert.equal(original.nextAttemptAt, null); assert.equal(String(original.supersededBy), r.json.id);
  delivery.setTransportForTests(accept); const before = calls.length; await delivery.processBatch(); assert.equal(calls.length - before, 1);
  assert.equal((await retry(o, n)).status, 409);
  const alerts = await require("../src/controllers/notificationAdminController").communicationAlerts(); assert.equal(alerts.items.filter((i) => String(i.orderId) === String(o._id)).length, 0);
});
test("N52 una comunicación reemplazada no permite abrir otra rama de reenvío", async () => {
  const o = await newOrder(), n = await notification(o, "order.received");
  const body = { requestKey: crypto.randomUUID(), confirmed: true, reason: "Copia solicitada" };
  const r = await resend(o, n, body); assert.equal(r.status, 202);
  await delivery.processOne(r.json.id);
  assert.equal((await resend(o, n, { ...body, requestKey: crypto.randomUUID() })).status, 409);
  assert.equal((await resend(o, n, body)).json.id, r.json.id); // same intent still idempotent
});

test("N53 configuración de Resend por sí sola no habilita correos reales en la fase local", async () => {
  delivery.setTransportForTests(null); process.env.RESEND_API_KEY = "FAKE-NOT-A-REAL-KEY"; process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
  const o = await newOrder(), n = await notification(o, "order.received"); assert.equal(n.status, "skipped"); assert.equal(n.errorCode, "delivery_disabled");
  assert.equal(n.acceptedAt, null); assert.deepEqual(fixture.context.blocked, []);
});
