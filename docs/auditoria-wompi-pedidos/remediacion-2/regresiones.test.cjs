const test=require('node:test'),assert=require('node:assert/strict');
const f=require('../auditoria-claude/evidencias/fixture-claude.cjs');
test.before(async()=>{await f.setup();});test.after(async()=>{await f.close();});
const pub=tx=>f.provider.tx.set(tx.id,{...tx});
const reconcile=(order,id,cookie=f.cookies.admin)=>f.api('POST',`/api/admin/orders/${order._id}/reconcile-wompi`,{cookie,body:{transactionId:id}});
const repro=receipt=>f.api('POST',`/api/admin/orders/payment-events/${receipt._id}/reprocess`,{cookie:f.cookies.admin});
const receipt=tx=>f.M.PaymentEvent.findOne({transactionId:tx.id,status:tx.status}).lean();
const active=o=>o.incidents.filter(i=>!i.resolvedAt);
const immutable=r=>Object.fromEntries(['key','transactionId','status','amountInCents','currency','reference','environment','paymentLinkId','checksum','providerTimestamp','source','createdAt'].map(k=>[k,JSON.stringify(r[k])]));
async function providerFailure(id,kind,work){
  const fetch=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
    const u=new URL(typeof input==='string'?input:input.url);
    if(u.pathname===`/v1/transactions/${encodeURIComponent(id)}`){
      if(kind==='timeout')throw Object.assign(new Error('Timeout ficticio'),{name:'TimeoutError'});
      if(kind==='network')throw new TypeError('Conexión ficticia interrumpida');
      return new Response('{}',{status:kind});
    }
    return fetch(input,init);
  };
  try{return await work();}finally{globalThis.fetch=fetch;}
}

for(const state of ['PENDING','DECLINED'])test(`N01-${state}: APPROVED firmado frente a GET ${state}: failed durable, 503, alerta única y recuperación`,async()=>{
  const {order,p}=await f.newWompi();const tx=f.linkTx(order);pub({...tx,status:state});
  const st=await Promise.all(Array.from({length:4},()=>f.postEvent(tx)));assert.ok(st.every(r=>r.status===503));
  const r=await receipt(tx);assert.equal(r.processingState,'failed');assert.equal(r.processedAt,null);assert.equal(r.providerObservation.status,state);assert.ok(r.lastError);
  assert.equal(await f.M.Notification.countDocuments({paymentEvent:r._id}),1);assert.equal((await f.fresh(order._id)).paymentStatus,'pendiente');assert.equal(await f.stockOf(p),5);
  pub(tx);assert.equal((await f.postEvent(tx)).status,200);assert.equal((await receipt(tx)).processingState,'processed');assert.equal((await f.fresh(order._id)).paymentStatus,'pagado');assert.equal(await f.stockOf(p),4);
});
test('N02: fallo Mongo de alerta no confirma ni oculta discrepancia; reintento conserva failed',async()=>{
  const {order}=await f.newWompi();const tx=f.linkTx(order);pub({...tx,status:'PENDING'});
  await f.failpoint({skip:1},{failCommands:['findAndModify'],errorCode:2});let failed;
  try{failed=await f.postEvent(tx);}finally{await f.failpoint('off');}
  assert.ok(failed.status>=500);const r=await receipt(tx);assert.ok(r);assert.equal(r.processedAt,null);assert.equal((await f.fresh(order._id)).paymentStatus,'pendiente');
  assert.equal((await f.postEvent(tx)).status,503);const after=await receipt(tx);assert.equal(after.processingState,'failed');assert.equal(await f.M.Notification.countDocuments({paymentEvent:after._id}),1);
});
for(const state of ['APPROVED','DECLINED','ERROR'])test(`N03-${state}: PENDING firmado progresa a ${state} consultado y cierra la observación anterior`,async()=>{
  const {order}=await f.newWompi();const tx=f.linkTx(order,{status:'PENDING'});pub({...tx,status:state});assert.equal((await f.postEvent(tx)).status,200);
  const original=await receipt(tx);assert.ok(original.processedAt);assert.equal(original.processingState,'processed');
  assert.equal((await f.fresh(order._id)).paymentStatus,state==='APPROVED'?'pagado':'rechazado');
});
test('N04: VOIDED conserva precedencia frente a APPROVED antiguo',async()=>{
  const {order,p}=await f.newWompi();const tx=f.linkTx(order);pub(tx);await f.postEvent(tx);pub({...tx,status:'VOIDED'});await f.postEvent({...tx,status:'VOIDED'});
  pub(tx);await f.postEvent(tx);await reconcile(order,tx.id);assert.equal((await f.fresh(order._id)).paymentStatus,'rechazado');assert.equal((await f.canPrepare(order._id)).status,409);assert.equal(await f.stockOf(p),4);
});
test('N05: formato inválido y 404 son 409 sin incidencia ni mutación del pedido',async()=>{
  const {order}=await f.newWompi();const before=await f.fresh(order._id);
  for(const id of ['../invalido','',{},'id-inexistente'])assert.equal((await reconcile(order,id)).status,409);
  const after=await f.fresh(order._id);assert.equal(after.requiresReview,false);assert.deepEqual(after.incidents,before.incidents);assert.equal(after.paymentStatus,'pendiente');
});
test('N06: 5xx, 429 y otros 4xx no se convierten en 404; timeout mantiene trazabilidad',async()=>{
  for(const kind of [500,429,403,'timeout','network']){
    const {order}=await f.newWompi();const id='consulta-ficticia-'+String(kind);
    const r=await providerFailure(id,kind,()=>reconcile(order,id));assert.equal(r.status,503);assert.ok(active(await f.fresh(order._id)).some(i=>i.code==='reconciliation_query_failed'));
  }
});
test('N07: recuperación con ID diferente cierra sólo fallos de consulta del mismo pedido y audita una vez',async()=>{
  const {order,p}=await f.newWompi();const tx=f.linkTx(order);pub(tx);
  await providerFailure('fallo-500',500,()=>reconcile(order,'fallo-500'));await providerFailure('fallo-timeout','timeout',()=>reconcile(order,'fallo-timeout'));
  const other=await f.newWompi();await providerFailure('otro-fallo',500,()=>reconcile(other.order,'otro-fallo'));
  const before=await f.fresh(order._id);assert.equal(active(before).length,2);
  const st=await Promise.all(Array.from({length:4},()=>reconcile(order,tx.id)));assert.ok(st.every(r=>r.status===200));
  const after=await f.fresh(order._id);assert.equal(after.requiresReview,false);assert.equal(after.incidents.length,2);assert.ok(after.incidents.every(i=>i.resolvedAt&&String(i.resolution.actor)===String(f.users.admin._id)));
  assert.deepEqual(after.incidents.map(i=>i.detail),before.incidents.map(i=>i.detail));assert.ok(after.statusHistory.some(h=>/consulta/.test(h.note)));
  assert.equal(active(await f.fresh(other.order._id)).length,1);assert.equal(await f.stockOf(p),4);assert.equal((await f.canPrepare(order._id)).status,200);
  const Audit=require('../../../backend/src/models/AuditLog');assert.equal(await Audit.countDocuments({entityId:order._id,action:'wompi_query_failures_resolved'}),1);
});
test('N08: conciliación no resuelve incidencias financieras independientes ni acepta ID ajeno',async()=>{
  const a=await f.newWompi(),b=await f.newWompi();const ta=f.linkTx(a.order),tb=f.linkTx(b.order);pub(ta);pub(tb);
  assert.equal((await reconcile(a.order,tb.id)).status,409);assert.equal((await f.fresh(a.order._id)).paymentStatus,'pendiente');
  await providerFailure('temporal',500,()=>reconcile(a.order,'temporal'));
  await f.M.Order.updateOne({_id:a.order._id},{$push:{incidents:{code:'payment_amount_or_currency_mismatch',detail:'histórico independiente'}},$set:{requiresReview:true}});
  assert.equal((await reconcile(a.order,ta.id)).status,200);const o=await f.fresh(a.order._id);assert.deepEqual(active(o).map(i=>i.code),['payment_amount_or_currency_mismatch']);assert.equal((await f.canPrepare(a.order._id)).status,409);
});
test('N09: fallo AuditLog revierte cierre de fallos de consulta; pago auténtico queda bloqueado y recuperable',async()=>{
  const {order}=await f.newWompi();const tx=f.linkTx(order);pub(tx);await providerFailure('consulta-caida',500,()=>reconcile(order,'consulta-caida'));
  const Audit=require('../../../backend/src/models/AuditLog'),create=Audit.create;Audit.create=async()=>{throw new Error('Fallo de almacenamiento AuditLog ficticio');};
  try{assert.equal((await reconcile(order,tx.id)).status,500);}finally{Audit.create=create;}
  assert.equal(active(await f.fresh(order._id)).filter(i=>i.code==='reconciliation_query_failed').length,1);assert.equal((await f.canPrepare(order._id)).status,409);
  assert.equal((await reconcile(order,tx.id)).status,200);assert.equal((await f.canPrepare(order._id)).status,200);
});
test('N10: vendedor y cliente no concilian ni cierran consultas',async()=>{
  const {order}=await f.newWompi();const tx=f.linkTx(order);pub(tx);
  for(const cookie of [f.cookies.vendor,f.cookies.client])assert.equal((await reconcile(order,tx.id,cookie)).status,403);
  assert.equal((await f.fresh(order._id)).paymentStatus,'pendiente');
});
test('N11: reprocesos concurrentes cierran original de otro estado y preservan sus campos inmutables',async()=>{
  const {order,p}=await f.newWompi();const tx=f.linkTx(order,{status:'PENDING',payment_link_id:null});await f.postEvent(tx);const original=await receipt(tx),snapshot=immutable(original);
  pub({...tx,status:'APPROVED',payment_link_id:order.wompi.paymentLinkId});const st=await Promise.all(Array.from({length:5},()=>repro(original)));assert.ok(st.every(r=>r.status===200));
  const after=await f.M.PaymentEvent.findById(original._id).lean();assert.ok(after.processedAt);assert.equal(after.processingState,'processed');assert.deepEqual(immutable(after),snapshot);assert.match(after.lastError,/recibo/);
  assert.equal(await f.stockOf(p),4);assert.equal(await f.M.Notification.countDocuments({order:order._id,event:'payment.approved'}),1);
  assert.equal((await f.api('GET','/api/admin/orders/payment-events',{cookie:f.cookies.admin})).json.events.some(e=>e._id===String(original._id)),false);
});
test('N12: moneda alterada se conserva como evidencia, con provider_binding_mismatch tras cierre',async()=>{
  const {order}=await f.newWompi();const tx=f.linkTx(order);pub(tx);await f.postEvent(tx,{mutate:e=>{e.data.transaction.currency='USD';}});
  const original=await f.M.PaymentEvent.findOne({transactionId:tx.id,currency:'USD'}).lean(),snapshot=immutable(original);assert.equal((await repro(original)).status,200);
  const after=await f.M.PaymentEvent.findById(original._id).lean();assert.ok(after.processedAt);assert.equal(after.associationError,'provider_binding_mismatch');assert.deepEqual(immutable(after),snapshot);
});
test('N13: reproceso sin asociación, con otro ID o estado rezagado no cierra el recibo',async()=>{
  const {order}=await f.newWompi();const tx=f.linkTx(order,{payment_link_id:null});await f.postEvent(tx);const original=await receipt(tx);
  pub(tx);assert.equal((await repro(original)).status,409);assert.equal((await f.M.PaymentEvent.findById(original._id)).processedAt,null);
  f.provider.tx.set(tx.id,{...tx,id:'otro-id',payment_link_id:order.wompi.paymentLinkId});assert.ok((await repro(original)).status>=400);assert.equal((await f.M.PaymentEvent.findById(original._id)).processedAt,null);
  pub({...tx,status:'PENDING',payment_link_id:order.wompi.paymentLinkId});assert.equal((await repro(original)).status,503);assert.equal((await f.M.PaymentEvent.findById(original._id)).processedAt,null);
});
test('N14: fallo Mongo al aplicar no cierra original y reintento no duplica stock',async()=>{
  const {order,p}=await f.newWompi();const tx=f.linkTx(order,{status:'PENDING',payment_link_id:null});await f.postEvent(tx);const original=await receipt(tx);pub({...tx,status:'APPROVED',payment_link_id:order.wompi.paymentLinkId});
  await f.failpoint({skip:1},{failCommands:['findAndModify'],errorCode:2});let r;try{r=await repro(original);}finally{await f.failpoint('off');}
  assert.ok(r.status>=500);assert.equal((await f.M.PaymentEvent.findById(original._id)).processedAt,null);assert.equal(await f.stockOf(p),5);
  assert.equal((await repro(original)).status,200);assert.equal(await f.stockOf(p),4);assert.ok((await f.M.PaymentEvent.findById(original._id)).processedAt);
});
test('N15: fallo Mongo al cerrar original conserva pago aplicado y permite cierre idempotente posterior',async()=>{
  const {order,p}=await f.newWompi();const tx=f.linkTx(order,{status:'PENDING',payment_link_id:null});await f.postEvent(tx);const original=await receipt(tx);pub({...tx,status:'APPROVED',payment_link_id:order.wompi.paymentLinkId});
  const save=f.M.PaymentEvent.prototype.save;f.M.PaymentEvent.prototype.save=function(...args){if(String(this._id)===String(original._id)&&this.processedAt)throw new Error('Fallo Mongo simulado al cerrar recibo original');return save.apply(this,args);};
  try{assert.equal((await repro(original)).status,500);}finally{f.M.PaymentEvent.prototype.save=save;}
  assert.equal((await f.M.PaymentEvent.findById(original._id)).processedAt,null);assert.equal((await f.fresh(order._id)).paymentStatus,'pagado');assert.equal(await f.stockOf(p),4);
  assert.equal((await repro(original)).status,200);assert.ok((await f.M.PaymentEvent.findById(original._id)).processedAt);assert.equal(await f.stockOf(p),4);
});
