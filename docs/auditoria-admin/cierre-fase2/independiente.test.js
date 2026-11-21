"use strict";
// Auditoría independiente de Fase 2. No modifica la aplicación ni las pruebas de Codex.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const fixture = require("../../../backend/test/helpers/phase2Fixture.cjs");
const Notification = require("../../../backend/src/models/notification");
const delivery = require("../../../backend/src/services/notificationDelivery");
const { inTransaction } = require("../../../backend/src/services/transactionService");
const { enqueue } = require("../../../backend/src/services/notificationEvents");

const outDir = __dirname;
const calls = [];
const results = [];
const record = (id, verdict, detail) => results.push({ id, verdict, detail });
const accept = async (message, ctx) => {
  calls.push({ key: ctx.idempotencyKey, text: message.text, html: message.html, to: message.to });
  return { data: { id: `audit-${calls.length}` } };
};
const waitFor = async (predicate, ms = 3000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("tiempo de espera agotado");
};
const create = async (method = "contra_entrega") => {
  const { product, variantId } = await fixture.makeProduct(8);
  const response = await fixture.api("POST", "/api/checkout/orders", {
    body: fixture.orderBody(product, variantId, { paymentMethod: method }),
  });
  assert.equal(response.status, 201, response.text);
  const order = await fixture.context.Order.findById(response.json.order.id);
  return { order, product, variantId, response };
};
const rows = (order, event) => Notification.find({ order: order._id, ...(event ? { event } : {}) }).select("+recipient +snapshot +message +reason");
const raw = (order) => fixture.context.Order.collection.findOne({ _id: order._id });
const stock = (product, variantId) => fixture.stockOf(product, variantId);
const admin = () => fixture.context.adminCookie;
const status = (order, orderStatus, extra = {}) => fixture.api("PATCH", `/api/admin/orders/${order._id}/status`, {
  cookie: admin(), body: { orderStatus, ...extra },
});

test.before(async () => {
  await fixture.setup();
  await Notification.init();
});
test.beforeEach(async () => {
  calls.length = 0;
  await Notification.deleteMany({});
  process.env.ADMIN_NOTIFY_EMAIL = "notify@example.test";
  process.env.EMAIL_FROM = "DIZOR <sender@example.test>";
  process.env.RESEND_API_KEY = "";
  process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
  delivery.setReceiptTransport(null);
  delivery.setTransportForTests(accept);
});
test.after(async () => {
  fs.writeFileSync(path.join(outDir, "independiente-resultados.json"), JSON.stringify({
    at: new Date().toISOString(), blocked: fixture.context.blocked, results,
  }, null, 2));
  try { assert.deepEqual(fixture.context.blocked, []); }
  finally { await fixture.close(); }
});

test("F2-I01 carrera de aprobación y rechazo: el correo corresponde al estado final", async () => {
  const { order, product, variantId } = await create("wompi");
  const before = await stock(product, variantId);
  const approved = fixture.txFor(order);
  const declined = { ...approved, status: "DECLINED" };
  const race = await Promise.all([
    fixture.postEvent(approved), fixture.postEvent(declined), fixture.postEvent(approved), fixture.postEvent(declined),
  ]);
  const final = await raw(order);
  await delivery.processBatch();
  const approvedRows = await rows(order, "payment.approved");
  const declinedRows = await rows(order, "payment.declined");
  const sentDecline = declinedRows.filter((row) => row.status === "sent");
  const ready = await rows(order, "admin.ready");
  const consistent = final.paymentStatus === "pagado" && final.stockDeducted === true
    && (await stock(product, variantId)) === before - 1
    && approvedRows.length === 1 && approvedRows[0].status === "sent"
    && sentDecline.length === 0 && ready.length <= 1
    && !calls.some((call) => /Reembolso realizado|reembolso confirmado/i.test(call.text));
  record("F2-I01", consistent ? "pass" : "fail", {
    race: race.map((item) => item.status), pay: final.paymentStatus, deducted: final.stockDeducted,
    approved: approvedRows.map((row) => row.status), declined: declinedRows.map((row) => row.status),
    ready: ready.length,
  });
  assert.equal(consistent, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I02 lease vencido durante la llamada conserva clave, cuerpo y una sola fila", async () => {
  const { order, product, variantId } = await create();
  const notice = await Notification.findOne({ order: order._id, event: "admin.ready" });
  const before = await raw(order);
  const beforeStock = await stock(product, variantId);
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  const seen = [];
  delivery.setTransportForTests(async (message, ctx) => {
    seen.push({ key: ctx.idempotencyKey, text: message.text });
    if (seen.length === 1) await hold;
    return { data: { id: "prov-lease" } };
  });
  const first = delivery.processOne(notice._id);
  await waitFor(() => seen.length === 1);
  await Notification.updateOne({ _id: notice._id }, { $set: { leaseUntil: new Date(0) } });
  const second = delivery.processOne(notice._id);
  await waitFor(async () => seen.length >= 2 || (await Notification.findById(notice._id)).leaseToken !== undefined, 1500).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 80));
  release();
  await Promise.allSettled([first, second]);
  const left = await rows(order, "admin.ready");
  const after = await raw(order);
  const sameKey = new Set(seen.map((item) => item.key)).size === 1;
  const sameBody = new Set(seen.map((item) => item.text)).size <= 1;
  const ok = left.length === 1 && left[0].status === "sent" && sameKey && sameBody
    && after.paymentStatus === before.paymentStatus && after.orderStatus === before.orderStatus
    && (await stock(product, variantId)) === beforeStock;
  record("F2-I02", ok ? "pass" : "fail", {
    calls: seen.length, keys: seen.map((item) => item.key), status: left.map((row) => row.status),
    payment: after.paymentStatus,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I03 caída antes del proveedor y reintento ambiguo reutilizan la misma clave", async () => {
  const { order, product, variantId } = await create();
  const notice = await Notification.findOne({ order: order._id, event: "admin.ready" });
  await Notification.updateOne({ _id: notice._id }, {
    $set: { status: "processing", attempts: 1, leaseUntil: new Date(0), leaseToken: "trabajador-muerto", message: null, firstAttemptAt: new Date() },
  });
  const beforeStock = await stock(product, variantId);
  await delivery.processOne(notice._id);
  const recovered = await Notification.findById(notice._id).select("+message");
  const firstKey = calls.at(-1)?.key;
  await delivery.processOne(notice._id);
  let boom = true;
  const keys = [];
  delivery.setTransportForTests(async (message, ctx) => {
    keys.push({ key: ctx.idempotencyKey, text: message.text });
    if (boom) throw new Error("conexión reiniciada");
    return { data: { id: "prov-retry" } };
  });
  const receipt = await Notification.findOne({ order: order._id, event: "order.received" });
  await delivery.processOne(receipt._id);
  const ambiguous = await Notification.findById(receipt._id).select("+message");
  await Notification.updateOne({ _id: receipt._id }, { $set: { nextAttemptAt: new Date(0) } });
  boom = false;
  await delivery.processOne(receipt._id);
  const done = await Notification.findById(receipt._id);
  const after = await raw(order);
  const ok = recovered.status === "sent" && calls.filter((call) => call.key === firstKey).length === 1
    && ambiguous.errorCode === "result_ambiguous" && ambiguous.retryable === true
    && keys.length === 2 && keys[0].key === keys[1].key && keys[0].text === keys[1].text
    && done.status === "sent" && after.paymentStatus === "pendiente"
    && (await stock(product, variantId)) === beforeStock;
  record("F2-I03", ok ? "pass" : "fail", {
    recovered: recovered.status, ambiguous: ambiguous.errorCode, retryKeys: keys.map((item) => item.key),
    final: done.status, payment: after.paymentStatus,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I04 error permanente, ventana de 23 h y salto inválido no crean efectos comerciales", async () => {
  const { order, product, variantId } = await create();
  const notice = await Notification.findOne({ order: order._id, event: "admin.ready" });
  const before = await raw(order);
  delivery.setTransportForTests(async () => ({ error: { statusCode: 422, message: "CLAVE-PROVEEDOR-NO-MOSTRAR" } }));
  await delivery.processOne(notice._id);
  const permanent = await Notification.findById(notice._id);
  assert.equal(await delivery.processOne(notice._id), null);
  await Notification.updateOne({ _id: notice._id }, {
    $set: { status: "failed", retryable: true, attempts: 1, firstAttemptAt: new Date(Date.now() - 23 * 60 * 60 * 1000 - 1000), nextAttemptAt: new Date(0) },
  });
  const callsBefore = calls.length;
  delivery.setTransportForTests(accept);
  assert.equal(await delivery.processOne(notice._id), null);
  const expired = await Notification.findById(notice._id);
  const jump = await status(order, "enviado");
  const shipped = await rows(order, "order.shipped");
  const after = await raw(order);
  const listed = await fixture.api("GET", `/api/admin/orders/${order._id}/communications`, { cookie: admin() });
  const ok = permanent.status === "failed" && permanent.retryable === false && permanent.errorCode === "permanent_error"
    && calls.length === callsBefore && expired.retryable === false && expired.errorCode === "review_required"
    && jump.status === 409 && shipped.length === 0
    && after.paymentStatus === before.paymentStatus && after.orderStatus === before.orderStatus
    && (await stock(product, variantId)) === 7
    && !JSON.stringify(listed.json).includes("CLAVE-PROVEEDOR-NO-MOSTRAR");
  record("F2-I04", ok ? "pass" : "fail", {
    permanent: permanent.errorCode, expired: expired.errorCode, jump: jump.status, shipped: shipped.length,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I05 contraentrega, Wompi pendiente, reembolso no confirmado y reenvío tardío", async () => {
  const cod = await create();
  assert.equal((await status(cod.order, "en_preparacion", { note: "NOTA-INTERNA-9f3a" })).status, 200);
  assert.equal((await fixture.api("PATCH", `/api/admin/orders/${cod.order._id}/shipping`, {
    cookie: admin(), body: { carrier: "servientrega", trackingNumber: "GUIA-AUD-1" },
  })).status, 200);
  assert.equal((await status(cod.order, "enviado")).status, 200);
  await delivery.processBatch();
  const shipped = await rows(cod.order, "order.shipped");
  assert.equal((await status(cod.order, "entregado")).status, 200);
  await delivery.processBatch();
  const delivered = await rows(cod.order, "order.delivered");
  const collected = await fixture.api("PATCH", `/api/admin/orders/${cod.order._id}/payment`, {
    cookie: admin(), body: { reference: "REC-AUD-1", receivedAt: new Date().toISOString() },
  });
  const wompi = await create("wompi");
  await delivery.processBatch();
  const paid = await create("wompi");
  assert.equal((await fixture.postEvent(fixture.txFor(paid.order))).status, 200);
  await delivery.processBatch();
  const approval = await Notification.findOne({ order: paid.order._id, event: "payment.approved" });
  assert.equal((await status(paid.order, "cancelado", { note: "NOTA-CANCEL-INTERNA" })).status, 200);
  await delivery.processBatch();
  const cancelled = await rows(paid.order, "order.cancelled");
  const resend = await fixture.api("POST", `/api/admin/orders/${paid.order._id}/communications/${approval._id}/resend`, {
    cookie: admin(),
    body: { requestKey: crypto.randomUUID(), confirmed: true, reason: "Copia posterior a la cancelación", recipient: "intruso@example.test", status: "sent" },
  });
  const copy = resend.status === 202 ? await Notification.findById(resend.json.id).select("+recipient +message") : null;
  if (copy) await delivery.processOne(copy._id);
  const copyAfter = copy ? await Notification.findById(copy._id) : null;
  const texts = [...(await rows(cod.order)), ...(await rows(wompi.order)), ...(await rows(paid.order))]
    .map((row) => `${row.message?.text || ""} ${row.message?.html || ""}`).join("\n");
  const codText = delivered[0]?.message?.text || "";
  const ok = delivered.length === 1 && /recaudo aún figura pendiente/.test(codText)
    && !/Pago confirmado/.test(codText) && shipped[0]?.message?.text.includes("GUIA-AUD-1")
    && !texts.includes("NOTA-INTERNA-9f3a") && !texts.includes("NOTA-CANCEL-INTERNA") && !texts.includes("424242")
    && collected.status === 200 && (await raw(cod.order)).paymentStatus === "pagado"
    && (await rows(cod.order, "payment.approved")).length === 0
    && (await rows(wompi.order, "payment.approved")).length === 0
    && !/pago confirmado|reembolso realizado|reembolso confirmado/i.test(wompi.order ? (await rows(wompi.order, "order.received"))[0].message.text : "")
    && /no confirma un reembolso/.test(cancelled[0].message.text)
    && copyAfter && copyAfter.status === "skipped" && copyAfter.errorCode === "superseded"
    && copy.recipient !== "intruso@example.test"
    && !calls.some((call) => call.key === copy.eventKey);
  record("F2-I05", ok ? "pass" : "fail", {
    collected: collected.status, resend: resend.status, copy: copyAfter?.status, copyError: copyAfter?.errorCode,
    delivered: codText.slice(0, 180),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I06 historial, permisos, reenvío manipulado y carrera reintento-reenvío", async () => {
  const { order } = await create();
  const buyer = order.buyer.email;
  await inTransaction(async (session) => {
    const current = await fixture.context.Order.findById(order._id).session(session);
    current.items[0].productName = "Pieza <b>x</b>\n\nReembolso realizado";
    for (let index = 0; index < 21; index += 1) await enqueue(current, "order.delivered", `pagina-${index}`, session);
    await current.save({ session });
  });
  const page1 = await fixture.api("GET", `/api/admin/orders/${order._id}/communications?page=1`, { cookie: admin() });
  const page2 = await fixture.api("GET", `/api/admin/orders/${order._id}/communications?page=2`, { cookie: admin() });
  const ids = [...page1.json.notifications, ...page2.json.notifications].map((row) => row.id);
  const vendor = await fixture.api("GET", `/api/admin/orders/${order._id}/communications`, { cookie: fixture.context.vendorCookie });
  const sample = page1.json.notifications[0];
  const vendorRetry = await fixture.api("POST", `/api/admin/orders/${order._id}/communications/${sample.id}/retry`, { cookie: fixture.context.vendorCookie });
  const client = await fixture.api("GET", `/api/admin/orders/${order._id}/communications`, { cookie: fixture.context.clientCookie });
  const anonymous = await fixture.api("GET", `/api/admin/orders/${order._id}/communications`, { cookie: "" });
  const body = JSON.stringify(page1.json) + JSON.stringify(vendor.json);
  const failed = await Notification.findOne({ order: order._id, event: "admin.ready" });
  delivery.setTransportForTests(async () => ({ error: { statusCode: 503 } }));
  await delivery.processOne(failed._id);
  const retryAndResend = await Promise.all([
    fixture.api("POST", `/api/admin/orders/${order._id}/communications/${failed._id}/retry`, { cookie: admin() }),
    fixture.api("POST", `/api/admin/orders/${order._id}/communications/${failed._id}/resend`, {
      cookie: admin(), body: { requestKey: crypto.randomUUID(), confirmed: true, reason: "Carrera de recuperación" },
    }),
  ]);
  delivery.setTransportForTests(accept);
  const beforeCalls = calls.length;
  await delivery.processOne(failed._id);
  const pendingCopies = await Notification.find({ resendOf: failed._id });
  for (const copy of pendingCopies) await delivery.processOne(copy._id);
  const extraSends = calls.length - beforeCalls;
  const original = await Notification.findById(failed._id);
  const copies = await Notification.countDocuments({ resendOf: failed._id });
  const sentCopies = await Notification.countDocuments({ resendOf: failed._id, status: "sent" });
  const escaped = await Notification.findOne({ order: order._id, event: "order.delivered" }).select("+snapshot +message");
  await fixture.context.Order.updateOne({ _id: order._id }, { $set: { orderStatus: "entregado" } });
  await delivery.processOne(escaped._id);
  const rendered = await Notification.findById(escaped._id).select("+message");
  const pageOk = page1.json.notifications.length === 20 && page2.json.notifications.length >= 1
    && new Set(ids).size === ids.length && page1.json.total >= 21;
  const privacyOk = !body.includes(buyer) && body.includes("***") && !body.includes("snapshot") && !body.includes("424242");
  const escapeOk = rendered.message.html.includes("&lt;b&gt;") && !rendered.message.html.includes("<b>x</b>")
    && rendered.message.text.includes("Pieza <b>x</b>");
  const vendorOk = vendor.status === 200 && vendor.json.notifications.every((row) => row.audience === "buyer" && !row.retryable && !row.canResend)
    && vendorRetry.status === 403 && client.status === 403 && anonymous.status === 401;
  const oneRecovery = extraSends <= 1 && sentCopies <= 1 && !(original.status === "sent" && sentCopies === 1);
  const ok = pageOk && privacyOk && escapeOk && vendorOk && oneRecovery && retryAndResend.every((item) => [202, 409].includes(item.status));
  record("F2-I06", ok ? "pass" : "defect", {
    page: [page1.json.notifications.length, page2.json.total], vendor: vendor.status, client: client.status,
    race: retryAndResend.map((item) => item.status), extraSends, copies, sentCopies, original: original.status,
    superseded: !!original.supersededBy, newline: rendered.message.text.includes("\n\nReembolso realizado"),
  });
  assert.equal(pageOk && privacyOk && escapeOk && vendorOk, true, JSON.stringify(results.at(-1).detail));
  assert.equal(oneRecovery, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I09 doce carreras de reintento y reenvío no entregan dos veces", async () => {
  const outcomes = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { order } = await create();
    const notice = await Notification.findOne({ order: order._id, event: "admin.ready" });
    delivery.setTransportForTests(async () => ({ error: { statusCode: 503 } }));
    await delivery.processOne(notice._id);
    const responses = await Promise.all([
      fixture.api("POST", `/api/admin/orders/${order._id}/communications/${notice._id}/retry`, { cookie: admin() }),
      fixture.api("POST", `/api/admin/orders/${order._id}/communications/${notice._id}/resend`, {
        cookie: admin(), body: { requestKey: crypto.randomUUID(), confirmed: true, reason: `Carrera ${attempt} de recuperacion` },
      }),
    ]);
    delivery.setTransportForTests(accept);
    const before = calls.length;
    await delivery.processOne(notice._id);
    const copies = await Notification.find({ resendOf: notice._id });
    for (const copy of copies) await delivery.processOne(copy._id);
    const row = await Notification.findById(notice._id);
    outcomes.push({
      http: responses.map((item) => item.status).sort(),
      sends: calls.length - before,
      copies: copies.length,
      status: row.status,
      superseded: !!row.supersededBy,
    });
  }
  const duplicated = outcomes.filter((item) => item.sends > 1);
  const misleading = outcomes.filter((item) => item.superseded && item.status === "pending");
  const ok = duplicated.length === 0 && outcomes.every((item) => item.sends === 1 && item.http.every((code) => [202, 409].includes(code)));
  record("F2-I09", ok ? "pass" : "fail", { duplicated: duplicated.length, misleading: misleading.length, outcomes });
  assert.equal(duplicated.length, 0, JSON.stringify(duplicated));
  assert.equal(ok, true, JSON.stringify(outcomes));
});

test("F2-I07 alertas de correo e inventario no se duplican ni mezclan incidencias financieras", async () => {
  const { order } = await create();
  const other = await create();
  await fixture.context.Order.updateOne({ _id: other.order._id }, { $set: { requiresReview: true } });
  const orphan = new fixture.context.mongoose.Types.ObjectId();
  await Notification.insertMany([
    { eventKey: crypto.randomUUID(), order: order._id, event: "order.shipped", audience: "buyer", status: "failed", errorCode: "temporary_error" },
    { eventKey: crypto.randomUUID(), order: order._id, event: "order.delivered", audience: "buyer", status: "failed", errorCode: "temporary_error" },
    { eventKey: crypto.randomUUID(), order: order._id, event: "admin.ready", audience: "admin", status: "failed", errorCode: "temporary_error", supersededBy: orphan },
    { eventKey: crypto.randomUUID(), order: other.order._id, event: "order.received", audience: "buyer", status: "pending", errorCode: "" },
  ]);
  const sample = await fixture.context.Product.findOne();
  const mixed = await fixture.context.Product.create({
    name: "AAA variante mixta auditoria", category: sample.category, salePrice: 1000, internalCost: 10,
    mainImage: "https://example.test/p.jpg", images: [{ url: "https://example.test/p.jpg" }],
    variants: [
      { size: sample.variants[0].size, color: sample.variants[0].color, sku: `AUD0${crypto.randomUUID().slice(0, 6)}`, stock: 0, isActive: true },
      { size: sample.variants[0].size, color: sample.variants[0].color, sku: `AUD3${crypto.randomUUID().slice(0, 6)}`, stock: 3, isActive: true },
    ],
  });
  const alerts = await fixture.api("GET", "/api/admin/alerts", { cookie: admin() });
  const vendorAlerts = await fixture.api("GET", "/api/admin/alerts", { cookie: fixture.context.vendorCookie });
  const panel = alerts.json.alerts;
  const groups = panel.communications.items.filter((item) => String(item.orderId) === String(order._id));
  const otherGroups = panel.communications.items.filter((item) => String(item.orderId) === String(other.order._id));
  const outIds = panel.outOfStock.items.map((item) => String(item.id));
  const lowIds = panel.lowStock.items.map((item) => String(item.id));
  const mixedOut = panel.outOfStock.items.find((item) => String(item.id) === String(mixed._id));
  const ok = alerts.status === 200 && vendorAlerts.status === 403
    && groups.length === 1 && groups[0].count === 2 && otherGroups.length === 0
    && outIds.filter((id) => id === String(mixed._id)).length === 1
    && !lowIds.includes(String(mixed._id))
    && mixedOut.affectedVariants.length === 2;
  record("F2-I07", ok ? "pass" : "fail", {
    groups, otherGroups: otherGroups.length, vendor: vendorAlerts.status,
    mixedOut: !!mixedOut, mixedLow: lowIds.includes(String(mixed._id)),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F2-I08 rollback, finanzas conciliadas y bandera de entrega apagada", async () => {
  const { order } = await create();
  const before = await Notification.countDocuments({ order: order._id });
  await assert.rejects(inTransaction(async (session) => {
    const current = await fixture.context.Order.findById(order._id).session(session);
    await enqueue(current, "order.cancelled", "rollback-auditor", session);
    current.orderStatus = "cancelado";
    await current.save({ session });
    throw new Error("rollback ficticio");
  }));
  const kept = (await raw(order)).orderStatus !== "cancelado" && await Notification.countDocuments({ order: order._id }) === before;
  delivery.setTransportForTests(null);
  process.env.RESEND_API_KEY = "FAKE-NOT-A-REAL-KEY";
  process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
  const fresh = await create();
  await delivery.processOne((await Notification.findOne({ order: fresh.order._id, event: "order.received" }))._id);
  const skipped = await Notification.findOne({ order: fresh.order._id, event: "order.received" });
  const from = new Date(Date.now() - 86400000).toISOString();
  const to = new Date(Date.now() + 86400000).toISOString();
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const beforeReport = await fixture.api("GET", `/api/admin/finance/report?${query}`, { cookie: fixture.context.superCookie });
  const beforeHistory = await fixture.api("GET", `/api/admin/finance/history?${query}`, { cookie: fixture.context.superCookie });
  await fixture.context.Order.collection.insertMany([
    { orderNumber: `AUD-OK-${crypto.randomUUID().slice(0, 8)}`, buyer: { name: "F", email: "f@example.test", phone: "1" }, items: [], subtotal: 80000, total: 80000, paymentMethod: "wompi", paymentStatus: "pagado", orderStatus: "entregado", requiresReview: false, createdAt: new Date(), updatedAt: new Date() },
    { orderNumber: `AUD-CAN-${crypto.randomUUID().slice(0, 8)}`, buyer: { name: "F", email: "f@example.test", phone: "1" }, items: [], subtotal: 50000, total: 50000, paymentMethod: "wompi", paymentStatus: "pagado", orderStatus: "cancelado", requiresReview: false, createdAt: new Date(), updatedAt: new Date() },
  ]);
  const afterReport = await fixture.api("GET", `/api/admin/finance/report?${query}`, { cookie: fixture.context.superCookie });
  const afterHistory = await fixture.api("GET", `/api/admin/finance/history?${query}`, { cookie: fixture.context.superCookie });
  const reportDelta = afterReport.json.sales.ordersCount - beforeReport.json.sales.ordersCount;
  const historyDelta = afterHistory.json.summary.totalOrders - beforeHistory.json.summary.totalOrders;
  const moneyReport = afterReport.json.sales.totalCollected - beforeReport.json.sales.totalCollected;
  const moneyHistory = afterHistory.json.summary.totalRevenue - beforeHistory.json.summary.totalRevenue;
  const financeOk = reportDelta === 1 && historyDelta === 1 && moneyReport === 80000 && moneyHistory === 80000;
  const ok = kept && skipped.status === "skipped" && skipped.errorCode === "delivery_disabled" && skipped.acceptedAt == null
    && financeOk && fixture.context.blocked.length === 0;
  record("F2-I08", ok ? "pass" : "fail", {
    kept, skipped: skipped.errorCode, reportDelta, historyDelta, moneyReport, moneyHistory, blocked: fixture.context.blocked,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});
