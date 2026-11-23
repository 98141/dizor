// Independent versions of P06/P23. Historical assertions remain untouched.
const test=require('node:test'),assert=require('node:assert/strict');
const f=require('../../docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/fixture-claude.cjs');
test.before(async()=>{await f.setup();});test.after(async()=>{await f.close();});
test('P06-v2: monto o moneda discrepantes conservan evidencia sin declarar pago íntegro',async()=>{
  for(const extra of [{amount_in_cents:12345},{currency:'USD'}]){
    const {order,p}=await f.newWompi();const tx=f.linkTx(order,extra);f.provider.tx.set(tx.id,tx);assert.equal((await f.postEvent(tx)).status,200);
    const o=await f.fresh(order._id);assert.notEqual(o.paymentStatus,'pagado');assert.ok(o.requiresReview);assert.equal(o.stockDeducted,false);assert.equal(await f.stockOf(p),5);
    const event=await f.M.PaymentEvent.findOne({transactionId:tx.id});assert.equal(event.amountInCents,tx.amount_in_cents);assert.equal(event.currency,tx.currency);assert.equal((await f.canPrepare(order._id)).status,409);
  }
});
test('P23-v2: política vigente no autocancela Wompi PENDING; aceptación comercial sigue pendiente',async()=>{
  const p=await f.makeProduct(5),r=await f.createOrder(p,{},f.cookies.client),order=await f.fresh(r.json.order.id),tx=f.linkTx(order,{status:'PENDING'});
  f.provider.tx.set(tx.id,tx);await f.postEvent(tx);assert.equal(require('../src/services/orderTransitions').canSelfCancel(await f.fresh(order._id)),false);
  assert.equal((await f.api('PATCH',`/api/checkout/orders/${order._id}/cancel`,{cookie:f.cookies.client})).status,409);
  const o=await f.fresh(order._id);assert.notEqual(o.orderStatus,'cancelado');assert.equal(o.paymentStatus,'pendiente');assert.equal(await f.stockOf(p),5);
});
