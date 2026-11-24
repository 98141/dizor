const test = require("node:test"), assert = require("node:assert/strict");
const f = require("./helpers/wompiRecoveryFixture.cjs");
test.before(async () => { await f.setup(); });
test.after(async () => { await f.close(); });
const verify = order => f.api("POST", `/api/admin/orders/${order._id}/reconcile-wompi`, { cookie: f.cookies.admin, body: {} });
async function withWebhook(value, work) {
  const previous = process.env.WOMPI_WEBHOOK_URL;
  if (value === undefined) delete process.env.WOMPI_WEBHOOK_URL; else process.env.WOMPI_WEBHOOK_URL = value;
  try { return await work(); } finally {
    if (previous === undefined) delete process.env.WOMPI_WEBHOOK_URL; else process.env.WOMPI_WEBHOOK_URL = previous;
  }
}

test("DG01: falta de receptor declara el problema real, sin afirmar que no hubo pago", async () => {
  const s = await f.newWompi(); const before = f.provider.calls.length;
  const result = await withWebhook(undefined, () => verify(s.order));
  assert.equal(result.status, 409); assert.match(result.json.message, /URL pública/);
  assert.match(result.json.message, /no demuestra que el cliente no haya pagado/);
  assert.doesNotMatch(result.json.message, /Espera la notificación/);
  assert.equal(f.provider.calls.length, before); // No invented discovery endpoint.
  const order = await f.fresh(s.order._id); assert.equal(order.paymentStatus, "pendiente"); assert.equal(order.requiresReview, false);
  assert.equal(await f.stockOf(s.p), 5);
});

test("DG02: declarar una URL no equivale a recibir una transacción ni a confirmar dinero", async () => {
  const s = await f.newWompi();
  const result = await withWebhook("https://api.example.test/api/webhooks/wompi", () => verify(s.order));
  assert.equal(result.status, 409); assert.match(result.json.message, /Aún no hemos recibido la transacción/);
  assert.doesNotMatch(result.json.message, /no declara una URL pública/);
  assert.equal((await f.fresh(s.order._id)).paymentStatus, "pendiente"); assert.equal(await f.stockOf(s.p), 5);
});

test("DG03: retorno aprobado permite verificar con un clic incluso sin webhook", async () => {
  const s = await f.newWompi(); const tx = f.linkTx(s.order); f.provider.tx.set(tx.id, { ...tx });
  await withWebhook(undefined, async () => {
    const returned = await f.api("POST", "/api/checkout/orders/wompi-return", { body: {
      orderNumber: s.order.orderNumber, accessToken: s.r.json.accessToken, transactionId: tx.id,
    } });
    assert.equal(returned.status, 200); assert.equal(returned.json.order.paymentStatus, "pagado");
    for (let i = 0; i < 2; i++) {
      const result = await verify(s.order); assert.equal(result.status, 200); assert.equal(result.json.message, "Pago confirmado con Wompi.");
    }
  });
  const order = await f.fresh(s.order._id); assert.equal(order.requiresReview, false); assert.equal(order.wompi.transactionId, tx.id);
  assert.equal(await f.stockOf(s.p), 4); assert.equal(await f.M.PaymentEvent.countDocuments({ transactionId: tx.id }), 1);
});
