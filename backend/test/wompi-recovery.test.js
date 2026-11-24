const test = require("node:test");
const assert = require("node:assert/strict");
const f = require("./helpers/wompiRecoveryFixture.cjs");
test.before(async () => { await f.setup(); });
test.after(async () => { await f.close(); });
const pub = tx => f.provider.tx.set(tx.id, { ...tx });
const returned = (sample, id, extra = {}) => f.api("POST", "/api/checkout/orders/wompi-return", {
  body: { orderNumber: sample.order.orderNumber, accessToken: sample.r.json.accessToken, transactionId: id, ...extra },
});
const verify = (order, cookie = f.cookies.admin) => f.api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie, body: {} });
const queryCalls = () => f.provider.calls.filter(c => c.path.startsWith("/v1/transactions/"));

test("W01: retorno autorizado confirma sin webhook ni código escrito por el cliente", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  const result = await returned(s, tx.id);
  assert.equal(result.status, 200, result.text);
  assert.equal(result.json.order.paymentStatus, "pagado");
  assert.equal((await f.fresh(s.order._id)).wompi.transactionId, tx.id);
  assert.equal(await f.stockOf(s.p), 4);
  const receipt = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  assert.equal(receipt.source, "provider_query"); assert.ok(receipt.processedAt);
});

test("W02: pedido ajeno, token incorrecto o vencido no consultan al proveedor", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  const before = queryCalls().length;
  for (const accessToken of [undefined, "incorrecto"]) assert.equal((await returned(s, tx.id, { accessToken })).status, 404);
  assert.equal((await f.api("POST", "/api/checkout/orders/wompi-return", { cookie: f.cookies.client2,
    body: { orderNumber: s.order.orderNumber, transactionId: tx.id } })).status, 404);
  await f.M.Order.updateOne({ _id: s.order._id }, { $set: { "guestAccess.expiresAt": new Date(0) } });
  assert.equal((await returned(s, tx.id)).status, 404);
  assert.equal(queryCalls().length, before);
});

test("W03: dueño autenticado verifica sin token invitado; otro cliente no", async () => {
  const s = await f.newWompi(5, 150000, {}, f.cookies.client); const tx = f.linkTx(s.order); pub(tx);
  const body = { orderNumber: s.order.orderNumber, transactionId: tx.id };
  assert.equal((await f.api("POST", "/api/checkout/orders/wompi-return", { body, cookie: f.cookies.client2 })).status, 404);
  assert.equal((await f.api("POST", "/api/checkout/orders/wompi-return", { body, cookie: f.cookies.client })).status, 200);
});

test("W04: ID de otro pedido no produce evidencia, incidencias ni pagos en ninguno", async () => {
  const a = await f.newWompi(), b = await f.newWompi(); const tx = f.linkTx(b.order); pub(tx);
  const before = await f.M.PaymentEvent.countDocuments();
  assert.equal((await returned(a, tx.id)).status, 409);
  assert.equal(await f.M.PaymentEvent.countDocuments(), before);
  for (const s of [a, b]) {
    const o = await f.fresh(s.order._id); assert.equal(o.paymentStatus, "pendiente"); assert.equal(o.incidents.length, 0);
    assert.equal(await f.stockOf(s.p), 5);
  }
});

test("W05: status, importe y ambiente del navegador no son evidencia", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order, { status: "PENDING" }); pub(tx);
  assert.equal((await returned(s, tx.id, { status: "APPROVED", amount_in_cents: 1, environment: "prod", paymentStatus: "pagado" })).status, 200);
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal(await f.stockOf(s.p), 5);
});

test("W06: ID inventado o mal formado no aprueba ni altera el pedido", async () => {
  const s = await f.newWompi();
  for (const id of ["../invalido", "", {}, "tx-inexistente"]) assert.equal((await returned(s, id)).status, 409);
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal(await f.stockOf(s.p), 5);
});

for (const mismatch of [{ amount_in_cents: 1 }, { currency: "USD" }]) test(`W07: diferencia financiera ${JSON.stringify(mismatch)} bloquea preparación`, async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order, mismatch); pub(tx);
  assert.equal((await returned(s, tx.id)).status, 200);
  const o = await f.fresh(s.order._id); assert.notEqual(o.paymentStatus, "pagado"); assert.equal(o.requiresReview, true);
  assert.equal(await f.stockOf(s.p), 5); assert.equal((await f.canPrepare(s.order._id)).status, 409);
});

test("W08: retorno, webhook y botón simultáneos aplican stock una sola vez", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  // Associate through the return, then race all supported recovery paths.
  assert.equal((await returned(s, tx.id)).status, 200);
  const first = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  const results = await Promise.all([returned(s, tx.id), returned(s, tx.id), f.postEvent(tx), verify(s.order), verify(s.order)]);
  assert.ok(results.every(r => r.status === 200), results.map(r => r.text).join("\n"));
  assert.equal(await f.stockOf(s.p), 4);
  assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 1);
  const after = await f.M.PaymentEvent.findOne({ transactionId: tx.id }).lean();
  assert.equal(+after.processedAt, +first.processedAt);
});

test("W09: botón recupera evento fallido aunque el pedido aún no tenga ID", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub({ ...tx, status: "PENDING" });
  assert.equal((await f.postEvent(tx)).status, 503);
  assert.equal((await f.fresh(s.order._id)).wompi.transactionId, "");
  pub(tx); const result = await verify(s.order); assert.equal(result.status, 200, result.text);
  assert.match(result.json.message, /Pago confirmado/); assert.equal(await f.stockOf(s.p), 4);
});

test("W10: evento con vínculo omitido se recupera por observación privada", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  await f.M.PaymentEvent.create({ key: "recovery-observation", transactionId: tx.id, status: "APPROVED", environment: "test",
    amountInCents: tx.amount_in_cents, currency: "COP", providerObservation: { paymentLinkId: tx.payment_link_id, checkedAt: new Date() } });
  assert.equal((await verify(s.order)).status, 200); assert.equal((await f.fresh(s.order._id)).paymentStatus, "pagado");
});

test("W11: botón sin evidencia no aprueba por declaración del administrador", async () => {
  const s = await f.newWompi(); const result = await verify(s.order);
  assert.equal(result.status, 409); assert.match(result.json.message, /no necesitas copiar/i);
  const o = await f.fresh(s.order._id); assert.equal(o.paymentStatus, "pendiente"); assert.equal(o.requiresReview, false);
  assert.equal(await f.stockOf(s.p), 5);
});

test("W12: evento de otro ambiente u otro enlace no descubre candidatos", async () => {
  const s = await f.newWompi(), other = await f.newWompi();
  for (const [key, link, environment] of [["wrong-env", s.order.wompi.paymentLinkId, "prod"], ["wrong-link", other.order.wompi.paymentLinkId, "test"]]) {
    await f.M.PaymentEvent.create({ key, transactionId: key, status: "APPROVED", amountInCents: 15000000, currency: "COP", paymentLinkId: link, environment });
  }
  assert.equal((await verify(s.order)).status, 409);
});

test("W13: botón sin ID sigue reservado a administradores", async () => {
  const s = await f.newWompi();
  assert.equal((await verify(s.order, undefined)).status, 409); // default administrator: no evidence
  assert.equal((await verify(s.order, "")).status, 401);
  for (const cookie of [f.cookies.vendor, f.cookies.client]) assert.equal((await verify(s.order, cookie)).status, 403);
});

test("W14: múltiples aprobaciones conocidas conservan incidencia de segundo cobro", async () => {
  const s = await f.newWompi(); const one = f.linkTx(s.order), two = f.linkTx(s.order); pub(one); pub(two);
  await returned(s, one.id); await returned(s, two.id);
  const result = await verify(s.order); assert.equal(result.status, 200); assert.match(result.json.message, /incidencias/);
  const o = await f.fresh(s.order._id); assert.equal(o.requiresReview, true);
  assert.ok(o.incidents.some(i => i.code === "additional_approved_payment" && !i.resolvedAt));
  assert.equal(await f.stockOf(s.p), 4);
});

test("W15: VOIDED auténtico no se oculta con botón ni retorno APPROVED antiguo", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx); await returned(s, tx.id);
  pub({ ...tx, status: "VOIDED" }); await f.postEvent({ ...tx, status: "VOIDED" }); pub(tx);
  await Promise.all([returned(s, tx.id), verify(s.order)]);
  const o = await f.fresh(s.order._id); assert.equal(o.paymentStatus, "rechazado"); assert.equal(o.requiresReview, true);
  assert.equal((await f.canPrepare(s.order._id)).status, 409);
});

test("W16: caída de consulta no se transforma en pago; retorno se recupera al reintentar", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); pub(tx);
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes(`/v1/transactions/${tx.id}`)) throw new TypeError("Fallo simulado");
    return original(input, init);
  };
  try { assert.equal((await returned(s, tx.id)).status, 503); } finally { globalThis.fetch = original; }
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal(await f.stockOf(s.p), 5);
  assert.equal((await returned(s, tx.id)).status, 200); assert.equal(await f.stockOf(s.p), 4);
});
