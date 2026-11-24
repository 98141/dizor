const test = require("node:test"), assert = require("node:assert/strict");
const f = require("./helpers/wompiRecoveryFixture.cjs");
const worker = require("../src/services/wompiRecoveryWorker");
const Task = require("../src/models/wompiRecoveryTask");
const recovery = require("../src/services/wompiEventRecovery");
const status = require("../src/services/wompiRecoveryStatus");
const wompi = require("../src/services/wompiService");
test.before(async () => { await f.setup(); await Task.init(); });
test.after(async () => { await f.close(); });
// Isolate queue scheduling between cases while keeping real financial records.
test.beforeEach(async () => { await Task.deleteMany({}); });
const pub = tx => f.provider.tx.set(tx.id, { ...tx });
const txReceipt = tx => f.M.PaymentEvent.findOne({ transactionId: tx.id, status: tx.status });
const directReturn = (s, tx) => f.api("POST", "/api/checkout/orders/wompi-return", {
  body: { orderNumber: s.order.orderNumber, accessToken: s.r.json.accessToken, transactionId: tx.id },
});
async function failQuery(tx, work) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith(`/v1/transactions/${tx.id}`)) throw new TypeError("Simulated provider outage");
    return original(input, init);
  };
  try { return await work(); } finally { globalThis.fetch = original; }
}
const due = id => Task.updateOne({ _id: id }, { $set: { nextAttemptAt: new Date(0) } });

test("A00: worker real toma una devolución persistida sin botón ni segundo retorno", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  assert.equal((await failQuery(tx, () => directReturn(s, tx))).status, 503);
  const task = await Task.findOne({ order: s.order._id }); await due(task._id);
  const stop = worker.startWorker();
  try {
    // The engine records the financial fact before its fulfillment phase.
    // Wait for the entire recovery task, not just the first paid observation.
    for (let i = 0; i < 200 && (await Task.findById(task._id)).status !== "complete"; i++) await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal((await Task.findById(task._id)).status, "complete");
    assert.equal((await f.fresh(s.order._id)).paymentStatus, "pagado"); assert.equal(await f.stockOf(s.p), 4);
  } finally { stop(); }
});

test("A01: varios pedidos se confirman por webhook sin regresar del checkout", async () => {
  for (let i = 0; i < 3; i++) {
    const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
    assert.equal((await f.postEvent(tx)).status, 200);
    const order = await f.fresh(s.order._id); assert.equal(order.paymentStatus, "pagado");
    assert.equal(order.requiresReview, false); assert.equal(await f.stockOf(s.p), 4);
  }
});

test("A02: evento sin enlace se asocia automáticamente con la consulta privada", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  assert.equal((await f.postEvent({ ...tx, payment_link_id: null })).status, 200);
  const original = await txReceipt(tx); assert.equal(original.processedAt, null); assert.equal(original.paymentLinkId, "");
  await worker.discover(); const task = await Task.findOne({ event: original._id });
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "complete");
  const after = await f.fresh(s.order._id); assert.equal(after.paymentStatus, "pagado"); assert.equal(after.requiresReview, false);
  const evidence = await f.M.PaymentEvent.findById(original._id); assert.equal(evidence.paymentLinkId, ""); assert.ok(evidence.checksum); assert.ok(evidence.processedAt);
  assert.equal(evidence.providerObservation.paymentLinkId, tx.payment_link_id); assert.equal(await f.stockOf(s.p), 4);
});

test("A03: consulta caída en webhook se recupera sin otro envío del proveedor", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  assert.equal((await failQuery(tx, () => f.postEvent(tx))).status, 503);
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente");
  await worker.discover(); const task = await Task.findOne({ transactionId: tx.id });
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "complete");
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pagado"); assert.equal(await f.stockOf(s.p), 4);
});

test("A04: retorno durante caída queda persistido; recuperador continúa sin navegador", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  assert.equal((await failQuery(tx, () => directReturn(s, tx))).status, 503);
  const task = await Task.findOne({ kind: "buyer_return", order: s.order._id });
  assert.equal(task.status, "waiting"); assert.equal(task.attempts, 1); assert.ok(task.nextAttemptAt > new Date());
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 0);
  assert.equal((await f.fresh(s.order._id)).wompi.transactionId, "");
  await due(task._id); await worker.processOne({ taskId: task._id });
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pagado"); assert.equal(await f.stockOf(s.p), 4);
});

test("A05: PENDING pasa a aprobado por sondeo aunque no llegue el siguiente webhook", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order, { status: "PENDING" }); pub(tx);
  assert.equal((await directReturn(s, tx)).status, 200);
  const task = await Task.findOne({ kind: "buyer_return", order: s.order._id }); assert.equal(task.status, "waiting");
  pub({ ...tx, status: "APPROVED" }); await due(task._id); await worker.processOne({ taskId: task._id });
  assert.equal((await Task.findById(task._id)).status, "complete");
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pagado"); assert.equal(await f.stockOf(s.p), 4);
});

test("A06: dos recuperadores, webhook y retorno concurrentes no duplican efectos", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  const task = await worker.rememberReturn(s.order, tx.id);
  const before = f.provider.calls.filter(c => c.path.endsWith(`/transactions/${tx.id}`)).length;
  const results = await Promise.all([worker.processOne({ taskId: task._id }), worker.processOne({ taskId: task._id })]);
  assert.ok(results.every(result => !result || result.outcome === "complete"));
  assert.equal(f.provider.calls.filter(c => c.path.endsWith(`/transactions/${tx.id}`)).length - before, 1);
  await Promise.all([f.postEvent(tx), directReturn(s, tx)]);
  assert.equal(await f.stockOf(s.p), 4); assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 1);
});

test("A07: tarea running abandonada se recupera tras reinicio; lease vigente se respeta", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  const task = await worker.rememberReturn(s.order, tx.id);
  await Task.updateOne({ _id: task._id }, { $set: { status: "running", leaseToken: "old-process", leaseUntil: new Date(Date.now() + 60000) } });
  assert.equal(await worker.processOne({ taskId: task._id }), null);
  await Task.updateOne({ _id: task._id }, { $set: { leaseUntil: new Date(0) } });
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "complete"); assert.equal(await f.stockOf(s.p), 4);
});

test("A08: retorno ajeno nunca paga otro pedido ni se convierte en evidencia", async () => {
  const one = await f.newWompi(), two = await f.newWompi(); const tx = f.linkTx(two.order); pub(tx);
  const task = await worker.rememberReturn(one.order, tx.id);
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "rejected");
  for (const s of [one, two]) { assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal(await f.stockOf(s.p), 5); }
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 0);
});

test("A09: discrepancia de importe firmada no se procesa ni se archiva automáticamente", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  await f.postEvent({ ...tx, amount_in_cents: tx.amount_in_cents + 1 });
  const original = await f.M.PaymentEvent.findOne({ transactionId: tx.id });
  await worker.discover(); const task = await Task.findOne({ event: original._id });
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "review");
  const after = await f.M.PaymentEvent.findById(original._id); assert.equal(after.processedAt, null); assert.equal(after.administrativeArchive.active, false);
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal(await f.stockOf(s.p), 5);
});

test("A10: enlace contradictorio no se cambia por el enlace consultado", async () => {
  const s = await f.newWompi(), other = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  await f.postEvent({ ...tx, payment_link_id: other.order.wompi.paymentLinkId });
  const original = await txReceipt(tx); await worker.discover(); const task = await Task.findOne({ event: original._id });
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "review");
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal((await f.fresh(other.order._id)).paymentStatus, "pendiente");
  assert.equal((await f.M.PaymentEvent.findById(original._id)).paymentLinkId, other.order.wompi.paymentLinkId);
});

test("A11: VOIDED firmado pendiente bloquea aunque consulta privada no responda", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx); await f.postEvent(tx);
  const original = await f.M.PaymentEvent.create({ key: "queued-signed-void", transactionId: tx.id, status: "VOIDED", environment: "test",
    amountInCents: tx.amount_in_cents, currency: "COP", paymentLinkId: "", source: "webhook", checksum: "previously-validated", providerTimestamp: Math.floor(Date.now() / 1000) });
  await failQuery(tx, () => recovery.reprocess(original._id, { automatic: true }));
  const after = await f.fresh(s.order._id); assert.equal(after.paymentStatus, "rechazado"); assert.equal(after.requiresReview, true);
  assert.ok((await f.M.PaymentEvent.findById(original._id)).processedAt);
  assert.equal((await f.canPrepare(s.order._id)).status, 409); assert.equal(await f.stockOf(s.p), 4);
});

test("A12: ambiente distinto y archivo administrativo suspenden recuperación", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  const task = await worker.rememberReturn(s.order, tx.id);
  // Bypass schema immutability ONLY to simulate a task belonging to another environment.
  await Task.collection.updateOne({ _id: task._id }, { $set: { environment: "prod" } });
  assert.equal(await worker.processOne({ taskId: task._id }), null);
  const original = await f.M.PaymentEvent.create({ key: "archived-recovery", transactionId: tx.id, status: "APPROVED", environment: "test",
    amountInCents: tx.amount_in_cents, currency: "COP", administrativeArchive: { active: true } });
  await assert.rejects(recovery.reprocess(original._id, { automatic: true }), /Reabre/);
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente");
});

test("A13: evidencia perdida entre inbox y cola se descubre; revisión antigua no bloquea tareas nuevas", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx); await f.postEvent({ ...tx, payment_link_id: null });
  const original = await txReceipt(tx); assert.equal(await Task.countDocuments(), 0);
  await worker.discover(); const task = await Task.findOne({ event: original._id });
  await Task.updateOne({ _id: task._id }, { $set: { status: "review" } });
  assert.equal(await worker.discover(), 0);
  const other = await f.newWompi(); const tx2 = f.linkTx(other.order); pub(tx2); await f.postEvent({ ...tx2, payment_link_id: null });
  await worker.discover(); assert.ok(await Task.findOne({ transactionId: tx2.id }));
});

test("A14: reintentos agotados quedan visibles en revisión y nunca cancelan el pedido", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); const task = await worker.rememberReturn(s.order, tx.id);
  await Task.updateOne({ _id: task._id }, { $set: { attempts: 72 } });
  await worker.processBatch({ limit: 1 });
  assert.equal((await Task.findById(task._id)).status, "review");
  const order = await f.fresh(s.order._id); assert.equal(order.paymentStatus, "pendiente"); assert.equal(order.orderStatus, "pago_pendiente");
  const report = await status.inspect(); assert.ok(report.tasks.review >= 1); assert.ok(report.reviewItems.some(row => String(row.order) === String(s.order._id)));
  const button = await f.api("POST", `/api/admin/orders/${s.order._id}/reconcile-wompi`, { cookie: f.cookies.admin, body: {} });
  assert.equal(button.status, 409); assert.match(button.json.message, /verificación automática/);
});

test("A15: inspección operativa requiere administrador y no expone secretos", async () => {
  const path = "/api/admin/orders/payment-recovery";
  assert.equal((await f.api("GET", path)).status, 401);
  assert.equal((await f.api("GET", path, { cookie: f.cookies.vendor })).status, 403);
  const response = await f.api("GET", path, { cookie: f.cookies.admin }); assert.equal(response.status, 200);
  assert.doesNotMatch(response.text, /prv_test_|test_events_|tokenHash/); assert.equal(response.json.configuration.deliveryVerification, "requires_provider_test");
});

test("A16: producción rechaza checkout sin receptor HTTPS público o recuperador activo", () => {
  const config = { NODE_ENV: "production", WOMPI_ENV: "production", WOMPI_CHECKOUT_ENABLED: "true", WOMPI_PRIVATE_KEY: "prv_prod_fake", WOMPI_EVENTS_SECRET: "prod_events_fake" };
  for (const url of [undefined, "http://localhost:5000/api/webhooks/wompi", "https://127.0.0.1/api/webhooks/wompi", "https://10.0.0.2/api/webhooks/wompi", "https://api.example.test/wrong", "https://secret@api.example.test/api/webhooks/wompi"]) {
    assert.throws(() => wompi.validateConfiguration({ ...config, WOMPI_WEBHOOK_URL: url }), /WOMPI_WEBHOOK_URL/);
  }
  const valid = { ...config, WOMPI_WEBHOOK_URL: "https://api.example.test/api/webhooks/wompi" };
  assert.doesNotThrow(() => wompi.validateConfiguration(valid));
  assert.throws(() => wompi.validateConfiguration({ ...valid, WOMPI_RECOVERY_ENABLED: "false" }), /recuperación/);
  assert.doesNotThrow(() => wompi.validateConfiguration({ ...config, WOMPI_CHECKOUT_ENABLED: "false" }));
});

test("A17: recuperación cierra sólo fallos técnicos y registra auditoría del sistema", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  await failQuery(tx, () => f.api("POST", `/api/admin/orders/${s.order._id}/reconcile-wompi`, {
    cookie: f.cookies.admin, body: { transactionId: tx.id },
  }));
  const before = await f.fresh(s.order._id); assert.ok(before.incidents.some(i => i.code === "reconciliation_query_failed" && !i.resolvedAt));
  const task = await worker.rememberReturn(s.order, tx.id); await worker.processOne({ taskId: task._id });
  const after = await f.fresh(s.order._id); assert.equal(after.paymentStatus, "pagado"); assert.equal(after.requiresReview, false);
  assert.ok(after.incidents.every(i => i.resolvedAt));
  assert.equal(await require("../src/models/AuditLog").countDocuments({ entityId: s.order._id, action: "wompi_query_failures_resolved", role: "system" }), 1);
  assert.equal((await f.canPrepare(s.order._id)).status, 200);
});

test("A18: recuperación no cierra otras incidencias ni desbloquea el pedido", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  await failQuery(tx, () => f.api("POST", `/api/admin/orders/${s.order._id}/reconcile-wompi`, { cookie: f.cookies.admin, body: { transactionId: tx.id } }));
  await f.M.Order.updateOne({ _id: s.order._id }, { $push: { incidents: { code: "received_payment_pending_resolution", detail: "Gestión financiera independiente" } } });
  const task = await worker.rememberReturn(s.order, tx.id); await worker.processOne({ taskId: task._id });
  const after = await f.fresh(s.order._id); assert.equal(after.requiresReview, true);
  assert.ok(after.incidents.find(i => i.code === "reconciliation_query_failed").resolvedAt);
  assert.equal(after.incidents.find(i => i.code === "received_payment_pending_resolution").resolvedAt, null);
  assert.equal((await f.canPrepare(s.order._id)).status, 409);
});

test("A19: fallo al cerrar tarea después de aplicar el pago permite reintentar sin duplicar stock", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx); const task = await worker.rememberReturn(s.order, tx.id);
  const update = Task.updateOne; let failed = false;
  Task.updateOne = function (filter, change, ...args) {
    if (!failed && change.$set?.status === "complete") { failed = true; throw new Error("Fallo de persistencia de cierre simulado"); }
    return update.call(this, filter, change, ...args);
  };
  try { assert.equal((await worker.processOne({ taskId: task._id })).outcome, "waiting"); } finally { Task.updateOne = update; }
  const receipt = await txReceipt(tx); assert.equal((await f.fresh(s.order._id)).paymentStatus, "pagado"); assert.equal(await f.stockOf(s.p), 4);
  await due(task._id); await worker.processOne({ taskId: task._id });
  assert.equal(await f.stockOf(s.p), 4); assert.equal(+(await txReceipt(tx)).processedAt, +receipt.processedAt);
});

test("A20: seguimiento concluido por admin cierra la tarea pendiente sin nuevo archivo automático", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  await f.postEvent({ ...tx, status: "DECLINED" });
  const original = await f.M.PaymentEvent.findOne({ transactionId: tx.id, status: "DECLINED" });
  await worker.discover(); const task = await Task.findOne({ event: original._id });
  assert.equal((await worker.processOne({ taskId: task._id })).outcome, "review");
  assert.equal((await f.api("POST", `/api/admin/orders/${s.order._id}/reconcile-wompi`, { cookie: f.cookies.admin, body: { transactionId: tx.id } })).status, 200);
  const proof = await txReceipt(tx);
  const base = `/api/admin/orders/payment-events/${original._id}`;
  assert.equal((await f.api("POST", base + "/archive", { cookie: f.cookies.admin,
    body: { evidenceReceiptId: proof._id, reason: "Contradicción revisada con consulta privada" } })).status, 200);
  assert.equal((await f.api("POST", base + "/conclude-follow-up", { cookie: f.cookies.admin,
    body: { reason: "Pago verificado y pedido sin incidencias" } })).status, 200);
  await worker.discover(); assert.equal((await Task.findById(task._id)).status, "complete");
  const archived = await f.M.PaymentEvent.findById(original._id); assert.equal(archived.administrativeArchive.active, true);
  assert.equal(archived.administrativeArchive.financialFollowUp, false);
});

test("A21: recuperador y webhook concurrentes consumen el cupón una sola vez", async () => {
  const coupon = await f.M.Coupon.create({ code: "AUTO-RECOVERY-ONCE", type: "fixed", value: 10000, maxUses: 1 });
  const s = await f.newWompi(5, 150000, { couponCode: coupon.code }); const tx = f.linkTx(s.order); pub(tx);
  const task = await worker.rememberReturn(s.order, tx.id);
  await Promise.all([worker.processOne({ taskId: task._id }), f.postEvent(tx)]);
  assert.equal((await f.M.Coupon.findById(coupon._id)).usedCount, 1); assert.equal(await f.stockOf(s.p), 4);
  assert.equal((await f.fresh(s.order._id)).couponConsumed, true);
});
