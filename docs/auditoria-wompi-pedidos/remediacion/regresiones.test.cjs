const test = require('node:test'), assert = require('node:assert/strict');
const f = require('./fixture.cjs');
test.before(async () => { await f.setup(); });
test.after(async () => { await f.close(); });
const reconcile = (o, tx, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/${o._id}/reconcile-wompi`, {cookie, body: {transactionId: tx.id}});
const resolve = (o, i, body, cookie = f.cookies.admin) => f.api('POST', `/api/admin/orders/${o._id}/incidents/${i._id}/resolve`, {cookie, body});

test('R01: inbox durable sin pedido, sin datos sensibles, alerta única y permisos', async () => {
  const {order} = await f.newWompi(); const tx = f.linkTx(order, {payment_link_id: null});
  assert.equal((await f.postEvent(tx)).status, 200);
  await Promise.all(Array.from({length: 5}, () => f.postEvent(tx)));
  const events = await f.M.PaymentEvent.find({transactionId: tx.id}).lean();
  assert.equal(events.length, 1); assert.equal(events[0].order, null); assert.equal(events[0].processingState, 'unassociated');
  assert.ok(!JSON.stringify(events).includes('customer_email'));
  assert.equal(await f.M.Notification.countDocuments({paymentEvent: events[0]._id}), 1);
  assert.equal((await f.fresh(order._id)).paymentStatus, 'pendiente');
  assert.equal((await f.api('GET', '/api/admin/orders/payment-events', {cookie: f.cookies.vendor})).status, 403);
  const list = await f.api('GET', '/api/admin/orders/payment-events', {cookie: f.cookies.admin});
  assert.equal(list.status, 200); assert.ok(list.json.events.some(e => e.transactionId === tx.id));
});
test('R02: evento conservado tras reinicio del servicio y reprocesado por proveedor', async () => {
  const {order, p} = await f.newWompi(); const tx = f.linkTx(order);
  await f.postEvent({...tx, payment_link_id: null});
  const receipt = await f.M.PaymentEvent.findOne({transactionId: tx.id});
  f.provider.tx.set(tx.id, tx);
  delete require.cache[require.resolve('../../../backend/src/services/wompiPaymentService')];
  const r = await f.api('POST', `/api/admin/orders/payment-events/${receipt._id}/reprocess`, {cookie:f.cookies.admin});
  assert.equal(r.status,200,r.text); assert.equal((await f.fresh(order._id)).paymentStatus,'pagado'); assert.equal(await f.stockOf(p),4);
  assert.equal(await f.M.PaymentEvent.countDocuments({transactionId:tx.id}),1);
});
test('R03: inbox fallido nunca devuelve 200, y reintento conserva un efecto', async () => {
  const {order} = await f.newWompi(); const tx=f.linkTx(order,{payment_link_id:null});
  await f.failpoint({times:1},{failCommands:['findAndModify'],errorCode:2});
  assert.equal((await f.postEvent(tx)).status,500);
  await f.failpoint('off'); assert.equal((await f.postEvent(tx)).status,200);
  assert.equal(await f.M.PaymentEvent.countDocuments({transactionId:tx.id}),1);
});
test('R04: recuperación sin webhook valida ID, enlace, permisos y concurrencia', async () => {
  const {order,p}=await f.newWompi(); const tx=f.linkTx(order); f.provider.tx.set(tx.id,tx);
  assert.equal((await reconcile(order,tx,f.cookies.vendor)).status,403);
  const results=await Promise.all([reconcile(order,tx),f.postEvent(tx),f.postEvent(tx)]);
  assert.ok(results.every(r=>r.status===200)); assert.equal((await f.fresh(order._id)).paymentStatus,'pagado'); assert.equal(await f.stockOf(p),4);
  const other=await f.newWompi(); assert.equal((await reconcile(other.order,tx)).status,409); assert.equal((await f.fresh(other.order._id)).paymentStatus,'pendiente');
});
test('R05: contradicción de referencia y duplicidad de enlace no asignan dinero', async () => {
  const a=await f.newWompi(),b=await f.newWompi(); const tx=f.linkTx(a.order,{reference:b.order.orderNumber});
  assert.equal((await f.postEvent(tx)).status,200);
  assert.equal((await f.fresh(a.order._id)).paymentStatus,'pendiente'); assert.equal((await f.fresh(b.order._id)).paymentStatus,'pendiente');
  assert.equal((await f.M.PaymentEvent.findOne({transactionId:tx.id})).processingState,'unassociated');
  await f.M.Order.updateOne({_id:b.order._id},{$set:{'wompi.paymentLinkId':a.order.wompi.paymentLinkId}});
  const dup=f.linkTx(a.order); await f.postEvent(dup); assert.equal((await f.fresh(a.order._id)).paymentStatus,'pendiente');
});
test('R06: importe incorrecto conserva cobro y bloqueo sin afirmar pagado', async () => {
  const {order,p}=await f.newWompi(); const tx=f.linkTx(order,{amount_in_cents:100}); await f.postEvent(tx);
  const o=await f.fresh(order._id); assert.notEqual(o.paymentStatus,'pagado'); assert.ok(o.incidents.some(i=>i.code==='payment_amount_or_currency_mismatch'));
  assert.equal((await f.canPrepare(order._id)).status,409); assert.equal(await f.stockOf(p),5);
  assert.ok(await f.M.PaymentEvent.exists({transactionId:tx.id,status:'APPROVED'}));
});
test('R07: VOIDED bloquea preparación y APPROVED antiguo no rehabilita', async () => {
  const {order,p}=await f.newWompi(); const tx=f.linkTx(order); await f.postEvent(tx); await f.postEvent({...tx,status:'VOIDED'});
  await f.postEvent(tx); f.provider.tx.set(tx.id,tx); await reconcile(order,tx);
  const o=await f.fresh(order._id); assert.equal(o.paymentStatus,'rechazado'); assert.equal(o.wompi.status,'VOIDED'); assert.ok(o.incidents.some(i=>i.code==='payment_voided'));
  assert.equal((await f.canPrepare(order._id)).status,409); assert.equal(await f.stockOf(p),4);
});
test('R08: VOIDED concurrente con APPROVED y después de despacho conserva inventario', async () => {
  const {order,p}=await f.newWompi(); const tx=f.linkTx(order);
  await Promise.all([f.postEvent(tx),f.postEvent({...tx,status:'VOIDED'})]);
  assert.notEqual((await f.fresh(order._id)).paymentStatus,'pagado'); assert.ok([4,5].includes(await f.stockOf(p)));
  const b=await f.newWompi(); const t=f.linkTx(b.order); await f.postEvent(t);
  await f.M.Order.updateOne({_id:b.order._id},{$set:{orderStatus:'enviado'}}); await f.postEvent({...t,status:'VOIDED'});
  const o=await f.fresh(b.order._id); assert.equal(o.orderStatus,'enviado'); assert.equal(o.paymentStatus,'rechazado'); assert.equal(await f.stockOf(b.p),4);
});
test('R09: vendedor y texto libre no resuelven un pago duplicado', async () => {
  const {order}=await f.newWompi(); await f.postEvent(f.linkTx(order)); await f.postEvent(f.linkTx(order));
  const o=await f.fresh(order._id),i=o.incidents.find(i=>i.code==='additional_approved_payment');
  assert.equal((await resolve(o,i,{reason:'Revisado con proveedor',decision:'accept_discount'},f.cookies.vendor)).status,403);
  assert.equal((await resolve(o,i,{reason:'Ya fue devuelto',decision:'manual_refund_confirmed'})).status,403);
  assert.equal((await f.canPrepare(order._id)).status,409);
});
test('R10: resolución de cupón auditada, motivo obligatorio, concurrencia idempotente', async () => {
  const {order}=await f.newWompi(); await f.postEvent(f.linkTx(order));
  await f.M.Order.updateOne({_id:order._id},{$set:{requiresReview:true},$push:{incidents:{code:'coupon_reconciliation',detail:'FICTICIO'}}});
  const o=await f.fresh(order._id),i=o.incidents[0];
  assert.equal((await resolve(o,i,{decision:'accept_discount',reason:''})).status,400);
  const responses=await Promise.all([resolve(o,i,{decision:'accept_discount',reason:'Asumir descuento ya cobrado'}),resolve(o,i,{decision:'accept_discount',reason:'Asumir descuento ya cobrado'})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.canPrepare(order._id)).status,200);
  const Audit=require('../../../backend/src/models/AuditLog'); assert.equal(await Audit.countDocuments({action:'payment_incident_resolved',entityId:order._id}),1);
});
test('R11: autocancelación Wompi no se ofrece ni cancela intento potencial; COD sí', async () => {
  const {order}=await f.newWompi(); const rules=require('../../../backend/src/services/orderTransitions');
  assert.equal(rules.canSelfCancel(order),false);
  assert.equal(rules.canSelfCancel({...order,paymentMethod:'contra_entrega',orderStatus:'pendiente'}),true);
});

test('R12: fallo de AuditLog revierte resolución, historial y desbloqueo', async () => {
  const {order}=await f.newWompi(); await f.postEvent(f.linkTx(order));
  await f.M.Order.updateOne({_id:order._id},{$set:{requiresReview:true},$push:{incidents:{code:'coupon_reconciliation',detail:'FICTICIO'}}});
  const o=await f.fresh(order._id),i=o.incidents[0];
  await f.failpoint({times:1},{failCommands:['insert'],errorCode:2});
  assert.equal((await resolve(o,i,{decision:'accept_discount',reason:'Asumir descuento con aprobación'})).status,500);
  await f.failpoint('off'); const after=await f.fresh(order._id);
  assert.equal(after.incidents[0].resolvedAt,null); assert.equal(after.requiresReview,true); assert.equal(after.statusHistory.length,o.statusHistory.length);
});
test('R13: devolución manual adicional exige superadmin, evidencia exacta y libera sólo pago principal válido', async () => {
  const {order,p}=await f.newWompi(); const primary=f.linkTx(order),extra=f.linkTx(order); await f.postEvent(primary); await f.postEvent(extra);
  const o=await f.fresh(order._id),i=o.incidents.find(i=>i.code==='additional_approved_payment');
  const evidence={transactionId:extra.id,reference:'DEV-FICTICIA-001',url:'https://example.test/comprobante',amountInCents:extra.amount_in_cents,currency:'COP',recordedAt:new Date().toISOString()};
  await f.M.User.updateOne({_id:f.users.admin._id},{$set:{role:'superadmin'}});
  try {
    assert.equal((await resolve(o,i,{decision:'manual_refund_confirmed',reason:'Comprobante externo verificado',evidence:{...evidence,amountInCents:1}})).status,409);
    assert.equal((await resolve(o,i,{decision:'manual_refund_confirmed',reason:'Comprobante externo verificado',evidence})).status,200);
    const after=await f.fresh(order._id); assert.equal(after.wompi.transactionId,primary.id); assert.equal(after.paymentStatus,'pagado');
    assert.equal(after.requiresReview,false); assert.equal((await f.canPrepare(order._id)).status,200); assert.equal(await f.stockOf(p),4);
    f.provider.tx.set(extra.id,extra); await reconcile(order,extra); assert.equal((await f.fresh(order._id)).requiresReview,false);
    assert.equal(f.provider.calls.filter(c=>/\/refund|\/void/.test(c.path)).length,0);
  } finally { await f.M.User.updateOne({_id:f.users.admin._id},{$set:{role:'admin'}}); }
});
test('R14: devolución manual de monto discrepante no habilita preparación ni reabre pago', async () => {
  const {order}=await f.newWompi(); const tx=f.linkTx(order,{amount_in_cents:100}); await f.postEvent(tx);
  await f.api('PATCH',`/api/admin/orders/${order._id}/status`,{cookie:f.cookies.admin,body:{orderStatus:'cancelado'}});
  const o=await f.fresh(order._id),i=o.incidents.find(i=>i.code==='payment_amount_or_currency_mismatch');
  await f.M.User.updateOne({_id:f.users.admin._id},{$set:{role:'superadmin'}});
  try {
    const body={decision:'manual_refund_confirmed',reason:'Devolución externa del monto discrepante',evidence:{transactionId:tx.id,reference:'DEV-FICTICIA-002',url:'https://example.test/comprobante',amountInCents:100,currency:'COP',recordedAt:new Date().toISOString()}};
    assert.equal((await resolve(o,i,body)).status,200); assert.equal((await f.canPrepare(order._id)).status,409);
    f.provider.tx.set(tx.id,tx); await reconcile(order,tx); assert.notEqual((await f.fresh(order._id)).paymentStatus,'pagado');
  } finally { await f.M.User.updateOne({_id:f.users.admin._id},{$set:{role:'admin'}}); }
});
test('R15: vigilancia se archiva con actor y motivo sin certificar ausencia de pagos futuros', async () => {
  const {order}=await f.newWompi(); await f.api('PATCH',`/api/admin/orders/${order._id}/status`,{cookie:f.cookies.admin,body:{orderStatus:'cancelado'}});
  const o=await f.fresh(order._id),i=o.incidents.find(i=>i.code==='cancelled_wompi_watch');
  assert.equal((await resolve(o,i,{decision:'acknowledge_closed_watch',reason:'Vigilancia asumida por administración'})).status,200);
  const tx=f.linkTx(order); await f.postEvent(tx); const after=await f.fresh(order._id);
  assert.equal(after.orderStatus,'cancelado'); assert.equal(after.requiresReview,true); assert.equal(after.paymentStatus,'pagado'); assert.equal((await f.canPrepare(order._id)).status,409);
});
test('R16: configuración falla cerrada sin revelar llaves y plantillas escapan eventos', () => {
  const w=require('../../../backend/src/services/wompiService');
  assert.doesNotThrow(()=>w.validateConfiguration({WOMPI_ENV:'sandbox',WOMPI_PRIVATE_KEY:'prv_test_x',WOMPI_EVENTS_SECRET:'test_events_x'}));
  for(const env of [{WOMPI_ENV:'bad'},{WOMPI_ENV:'sandbox',NODE_ENV:'production'},{WOMPI_ENV:'production',WOMPI_PRIVATE_KEY:'prv_test_secret',WOMPI_EVENTS_SECRET:'prod_events_secret'}]) assert.throws(()=>w.validateConfiguration(env),e=>!e.message.includes('secret'));
  const n=require('../../../backend/src/services/notificationTemplates').buildMessage('admin.payment_event',{transactionId:'<script>x</script>',status:'APPROVED',environment:'test'});
  assert.ok(n.html.includes('&lt;script&gt;')); assert.ok(!n.html.includes('<script>'));
});
test('R17: sin stock reconoce cobro válido y recuperación no duplica inventario', async () => {
  const {order,p}=await f.newWompi(1); await f.M.Product.updateOne({_id:p.product._id},{$set:{'variants.0.stock':0}});
  const tx=f.linkTx(order); await f.postEvent(tx); const before=await f.fresh(order._id);
  assert.equal(before.paymentStatus,'pagado'); assert.ok(before.incidents.some(i=>i.code==='approved_without_stock')); assert.equal((await f.canPrepare(order._id)).status,409);
  await f.M.Product.updateOne({_id:p.product._id},{$set:{'variants.0.stock':1}}); f.provider.tx.set(tx.id,tx);
  await reconcile(order,tx); await reconcile(order,tx); assert.equal(await f.stockOf(p),0); assert.equal((await f.fresh(order._id)).requiresReview,false);
});
test('R18: alertas detectan pendientes antiguos y entrega administrativa usa outbox existente', async () => {
  const {order}=await f.newWompi(); await f.M.Order.collection.updateOne({_id:order._id},{$set:{createdAt:new Date(Date.now()-25*3600000)}});
  const tx=f.linkTx(order,{payment_link_id:null}); await f.postEvent(tx);
  const alerts=await f.api('GET','/api/admin/alerts',{cookie:f.cookies.admin}); assert.equal(alerts.status,200); assert.ok(alerts.json.alerts.oldPendingPayments.count>0);
  const receipt=await f.M.PaymentEvent.findOne({transactionId:tx.id}),n=await f.M.Notification.findOne({paymentEvent:receipt._id});
  const delivery=require('../../../backend/src/services/notificationDelivery'); let sent=0; delivery.setTransportForTests(async()=>{sent++;return {data:{id:'FAKE-ACCEPTED'}};});
  try {await delivery.processOne(n._id); await delivery.processOne(n._id); assert.equal(sent,1); const after=await f.M.Notification.findById(n._id);assert.equal(after.status,'sent');assert.equal(after.deliveredAt,null);} finally {delivery.setTransportForTests(null);}
});
test('R19: fallo de outbox no confirma recepción; inbox sobrevive y reintento genera un aviso', async () => {
  const {order}=await f.newWompi(); const tx=f.linkTx(order,{payment_link_id:null});
  // Skip inbox findAndModify, fail the transactional outbox upsert.
  await f.failpoint({skip:1},{failCommands:['findAndModify'],errorCode:2});
  assert.equal((await f.postEvent(tx)).status,500); await f.failpoint('off');
  const receipt=await f.M.PaymentEvent.findOne({transactionId:tx.id}); assert.ok(receipt); assert.equal(receipt.processedAt,null);
  assert.equal((await f.postEvent(tx)).status,200); assert.equal(await f.M.Notification.countDocuments({paymentEvent:receipt._id}),1);
});
test('R20: modificar campos de vínculo no firmados jamás aplica pago a otro pedido', async () => {
  const a=await f.newWompi(),b=await f.newWompi(); const tx=f.linkTx(a.order); f.provider.tx.set(tx.id,tx);
  const r=await f.postEvent(tx,{mutate:e=>{e.data.transaction.payment_link_id=b.order.wompi.paymentLinkId;}});
  assert.equal(r.status,200); assert.equal((await f.fresh(b.order._id)).paymentStatus,'pendiente');
  assert.equal((await f.M.PaymentEvent.findOne({transactionId:tx.id})).associationError,'provider_binding_mismatch');
});
test('R21: indisponibilidad de consulta conserva inbox y aviso, devuelve 503 y permite reintento', async () => {
  const {order,p}=await f.newWompi();const tx=f.linkTx(order),w=require('../../../backend/src/services/wompiService'),get=w.getTransaction;
  w.getTransaction=async()=>{throw Error('Proveedor simulado no disponible');};
  try{assert.equal((await f.postEvent(tx)).status,503);}finally{w.getTransaction=get;}
  const receipt=await f.M.PaymentEvent.findOne({transactionId:tx.id});assert.equal(receipt.processingState,'failed');assert.equal((await f.fresh(order._id)).paymentStatus,'pendiente');
  assert.equal(await f.M.Notification.countDocuments({paymentEvent:receipt._id}),1);
  assert.equal((await f.postEvent(tx)).status,200);assert.equal(await f.stockOf(p),4);assert.equal(await f.M.PaymentEvent.countDocuments({transactionId:tx.id}),1);
});
test('R22: consulta actual VOIDED prevalece sobre evento APPROVED firmado antiguo', async () => {
  const {order,p}=await f.newWompi();const tx=f.linkTx(order);
  await f.postEvent(tx,{mutate:()=>f.provider.tx.set(tx.id,{...tx,status:'VOIDED'})});
  const after=await f.fresh(order._id);assert.equal(after.paymentStatus,'rechazado');assert.equal(after.wompi.status,'VOIDED');assert.equal(await f.stockOf(p),5);
  const signed=await f.M.PaymentEvent.findOne({transactionId:tx.id,status:'APPROVED'});assert.equal(signed.providerObservation.status,'VOIDED');assert.equal(signed.associationError,'superseded_by_provider_state');
});
test('R23: moneda no firmada se contrasta con consulta privada y no confirma dinero', async () => {
  const {order}=await f.newWompi();const tx=f.linkTx(order);
  await f.postEvent(tx,{mutate:e=>{e.data.transaction.currency='USD';}});
  assert.equal((await f.fresh(order._id)).paymentStatus,'pendiente');const receipt=await f.M.PaymentEvent.findOne({transactionId:tx.id});assert.equal(receipt.associationError,'provider_binding_mismatch');assert.equal(receipt.providerObservation.currency,'COP');
});
test('R24: anulación consultada de pago adicional libera sólo el pedido respaldado por pago principal', async () => {
  const {order,p}=await f.newWompi();const first=f.linkTx(order),extra=f.linkTx(order);await f.postEvent(first);await f.postEvent(extra);await f.postEvent({...extra,status:'VOIDED'});
  const o=await f.fresh(order._id),i=o.incidents.find(i=>i.code==='additional_payment_voided');
  assert.equal((await resolve(o,i,{decision:'record_void_review',reason:'Anulación externa consultada y correlacionada'})).status,200);
  const after=await f.fresh(order._id);assert.equal(after.requiresReview,false);assert.equal(after.paymentStatus,'pagado');assert.equal(after.wompi.transactionId,first.id);assert.equal((await f.canPrepare(order._id)).status,200);assert.equal(await f.stockOf(p),4);
});
test('R25: rechazo de cancelación electrónica sin ID conserva intención administrativa', async () => {
  const {order}=await f.newWompi();await f.M.Order.updateOne({_id:order._id},{$set:{user:f.users.client._id}});
  const r=await f.api('PATCH',`/api/checkout/orders/${order._id}/cancel`,{cookie:f.cookies.client});assert.equal(r.status,409);
  const o=await f.fresh(order._id);assert.equal(o.orderStatus,'pago_pendiente');assert.ok(o.incidents.some(i=>i.code==='cancellation_verification_pending'));
});
test('R26: PENDING no elimina una retención histórica de revisión sin incidencia', async () => {
  const {order}=await f.newWompi();await f.M.Order.updateOne({_id:order._id},{$set:{requiresReview:true}});
  const tx=f.linkTx(order,{status:'PENDING'});await f.postEvent(tx);assert.equal((await f.fresh(order._id)).requiresReview,true);
  await reconcile(order,tx);assert.equal((await f.fresh(order._id)).requiresReview,true);
});
test('R27: VOIDED auténtico del ID aplicado bloquea aunque falte vínculo no firmado', async () => {
  const {order,p}=await f.newWompi();const tx=f.linkTx(order);await f.postEvent(tx);
  assert.equal((await f.postEvent({...tx,status:'VOIDED',payment_link_id:null})).status,200);
  const after=await f.fresh(order._id);assert.equal(after.paymentStatus,'rechazado');assert.equal(after.requiresReview,true);assert.equal((await f.canPrepare(order._id)).status,409);assert.equal(await f.stockOf(p),4);
});
