const test=require('node:test'),assert=require('node:assert/strict');
const f=require('../auditoria-claude/evidencias/fixture-claude.cjs');
test.before(async()=>f.setup());test.after(async()=>f.close());
const pub=tx=>f.provider.tx.set(tx.id,{...tx});
const rec=(o,tx)=>f.api('POST',`/api/admin/orders/${o._id}/reconcile-wompi`,{cookie:f.cookies.admin,body:{transactionId:tx.id}});
const action=(e,name,body,cookie=f.cookies.admin)=>f.api('POST',`/api/admin/orders/payment-events/${e._id}/${name}`,{cookie,body});
const receipt=tx=>f.M.PaymentEvent.findOne({transactionId:tx.id,status:tx.status,amountInCents:tx.amount_in_cents,currency:tx.currency}).lean();
const inbox=async(view='pending')=>(await f.api('GET',`/api/admin/orders/payment-events?view=${view}`,{cookie:f.cookies.admin})).json.events;
const raw=e=>JSON.stringify(Object.fromEntries(['_id','key','transactionId','status','amountInCents','currency','reference','environment','paymentLinkId','checksum','providerTimestamp','source','createdAt','providerObservation','processingState','associationError','lastError','processedAt','order'].map(k=>[k,e[k]])));
async function contradiction(kind='amount'){
  const x=await f.newWompi(),tx=f.linkTx(x.order);pub(tx);
  const signed=kind==='state'?{...tx,status:'DECLINED'}:{...tx,amount_in_cents:tx.amount_in_cents-100};
  await f.postEvent(signed);const e=await receipt(signed);assert.equal((await rec(x.order,tx)).status,200);
  const proof=await f.M.PaymentEvent.findOne({transactionId:tx.id,source:'provider_query',processingState:'processed'}).lean();
  assert.ok(proof);return {...x,tx,e,proof,body:{reason:'Contradicción investigada en revisión local',evidenceReceiptId:String(proof._id)}};
}
test('Z01 NR01: caída temporal + DECLINED anterior + consultas concurrentes conservan pago principal y permiten preparar',async()=>{
  const {order,p}=await f.newWompi(),tx=f.linkTx(order);pub(tx);await f.postEvent(tx);
  const fail={id:'consulta-inexistente-Z01'};const prev=globalThis.fetch;
  globalThis.fetch=async(u,init)=>new URL(typeof u==='string'?u:u.url).pathname.endsWith(fail.id)?new Response('{}',{status:500}):prev(u,init);
  try{assert.equal((await rec(order,fail)).status,503);}finally{globalThis.fetch=prev;}
  const declined={...tx,id:tx.id+'-anterior',status:'DECLINED'};pub(declined);
  assert.equal((await rec(order,declined)).status,200);
  let current=await f.fresh(order._id);assert.equal(current.requiresReview,false);assert.equal(current.wompi.transactionId,tx.id);
  await Promise.all([rec(order,tx),rec(order,declined),rec(order,tx)]);
  current=await f.fresh(order._id);assert.equal(current.paymentStatus,'pagado');assert.equal(current.requiresReview,false);assert.equal(await f.stockOf(p),4);
  assert.equal((await f.canPrepare(order._id)).status,200);
  const Audit=require('../../../backend/src/models/AuditLog');assert.equal(await Audit.countDocuments({entityId:order._id,action:'wompi_query_failures_resolved'}),1);
});
test('Z02 NR02: misma identidad, primera fecha y evidencia conservadas tras reprocesos repetidos y concurrentes',async()=>{
  const {order,p}=await f.newWompi(),tx=f.linkTx(order);pub(tx);await f.postEvent(tx);const e=await receipt(tx);
  const statuses=await Promise.all([1,2,3].map(()=>action(e,'reprocess')));assert.ok(statuses.every(r=>r.status===200));
  const after=await receipt(tx);assert.equal(+new Date(after.processedAt),+new Date(e.processedAt));assert.equal(after.associationError,e.associationError);assert.equal(after.lastError,'');
  assert.equal(after.providerObservation.status,'APPROVED');assert.equal(after.providerObservation.amountInCents,e.amountInCents);
  assert.equal(await f.stockOf(p),4);assert.equal(await f.M.Notification.countDocuments({order:order._id,event:'payment.approved'}),1);
});
for(const kind of ['amount','state'])test(`Z03-${kind} NR03: archivo explícito, motivo, prueba autenticada, auditoría y seguimiento; no altera evidencia ni pedido`,async()=>{
  const {order,p,e,proof,body}=await contradiction(kind);const before=await f.fresh(order._id);const r=await action(e,'archive',body);assert.equal(r.status,200,JSON.stringify(r.json));
  const after=await f.M.PaymentEvent.findById(e._id).lean();assert.equal(raw(after),raw(e));assert.equal(after.administrativeArchive.active,true);assert.equal(String(after.administrativeArchive.evidenceReceipt),String(proof._id));assert.ok(after.administrativeArchive.actor);assert.ok(after.administrativeArchive.archivedAt);
  assert.ok(!(await inbox()).some(x=>x._id===String(e._id)));assert.ok((await inbox('financial-follow-up')).some(x=>x._id===String(e._id)));
  const alerts=(await f.api('GET','/api/admin/alerts',{cookie:f.cookies.admin})).json.alerts;assert.ok(alerts.financialFollowUp.count>0);assert.ok(alerts.financialFollowUp.items.some(x=>x._id===String(e._id)));
  const current=await f.fresh(order._id);assert.equal(JSON.stringify(current),JSON.stringify(before));assert.equal(await f.stockOf(p),4);
  const Audit=require('../../../backend/src/models/AuditLog');const log=await Audit.findOne({entityId:e._id,action:'payment_event_archived'}).lean();assert.ok(log);assert.equal(log.newData.reason,body.reason);assert.ok(log.userId);
});
test('Z04 NR03: sin permisos / motivo / prueba / prueba ajena / prueba no consultada se rechaza',async()=>{
  const {e,body}=await contradiction();
  for(const cookie of [f.cookies.vendor,f.cookies.client])assert.equal((await action(e,'archive',body,cookie)).status,403);
  assert.equal((await action(e,'archive',{evidenceReceiptId:body.evidenceReceiptId})).status,400);
  assert.equal((await action(e,'archive',{reason:body.reason})).status,400);
  const other=await contradiction();assert.equal((await action(e,'archive',{...body,evidenceReceiptId:String(other.proof._id)})).status,409);
  assert.equal((await action(e,'archive',{...body,evidenceReceiptId:String(e._id)})).status,409);
  assert.equal((await action(e,'archive',{...body,evidenceReceiptId:'no-id'})).status,400);
  assert.equal((await f.M.PaymentEvent.findById(e._id).lean()).processedAt,null);
});
test('Z05 NR03: PENDING/lag recuperable y evento sin asociación confiable no se archivan',async()=>{
  const c=await contradiction();const {order}=await f.newWompi(),tx=f.linkTx(order);pub({...tx,status:'PENDING'});await f.postEvent(tx);const e=await receipt(tx);
  assert.equal((await action(e,'archive',c.body)).status,409);assert.ok((await inbox()).some(x=>x._id===String(e._id)));
  const unknown={...tx,id:tx.id+'-unknown',payment_link_id:null};pub({...unknown,amount_in_cents:unknown.amount_in_cents+100});await f.postEvent(unknown);const u=await receipt(unknown);
  assert.equal((await action(u,'archive',c.body)).status,409);assert.ok((await inbox()).some(x=>x._id===String(u._id)));
});
test('Z06 NR03: archivo concurrente/duplicado es una decisión; reapertura auditada permite gestionar nueva evidencia',async()=>{
  const {e,body}=await contradiction('state');
  body.evidenceReceiptId=body.evidenceReceiptId.toUpperCase();
  const rs=await Promise.all([1,2,3].map(()=>action(e,'archive',body)));assert.ok(rs.every(r=>r.status===200));
  const Audit=require('../../../backend/src/models/AuditLog');assert.equal(await Audit.countDocuments({entityId:e._id,action:'payment_event_archived'}),1);
  assert.equal((await action(e,'archive',{...body,reason:'Otra decisión diferente'})).status,409);
  assert.equal((await action(e,'reopen',{})).status,400);
  assert.equal((await action(e,'reopen',{reason:'Nueva evidencia para investigar'},f.cookies.vendor)).status,403);
  assert.equal((await action(e,'reopen',{reason:'Nueva evidencia para investigar'})).status,200);
  assert.ok((await inbox()).some(x=>x._id===String(e._id)));assert.ok(!(await inbox('financial-follow-up')).some(x=>x._id===String(e._id)));
  assert.equal(await Audit.countDocuments({entityId:e._id,action:'payment_event_reopened'}),1);
  assert.equal(raw(await f.M.PaymentEvent.findById(e._id).lean()),raw(e));
});
test('Z07 NR03: archivo conserva bloqueo de despacho e incidencia real',async()=>{
  const {order,e,body}=await contradiction();await f.M.Order.updateOne({_id:order._id},{$set:{requiresReview:true},$push:{incidents:{code:'payment_amount_or_currency_mismatch',detail:'Evidencia financiera independiente'}}});
  assert.equal((await f.canPrepare(order._id)).status,409);assert.equal((await action(e,'archive',body)).status,200);assert.equal((await f.canPrepare(order._id)).status,409);
  assert.equal((await f.fresh(order._id)).requiresReview,true);
});
test('Z08 NR03: fallo real de Mongo revierte archivo y AuditLog; reintento registra una decisión',async()=>{
  const {e,body}=await contradiction();await f.failpoint({times:1},{failCommands:['insert'],errorCode:2});let r;try{r=await action(e,'archive',body);}finally{await f.failpoint('off');}
  assert.ok(r.status>=500);const mid=await f.M.PaymentEvent.findById(e._id).lean();assert.ok(!mid.administrativeArchive?.active);
  const Audit=require('../../../backend/src/models/AuditLog');assert.equal(await Audit.countDocuments({entityId:e._id,action:'payment_event_archived'}),0);
  assert.equal((await action(e,'archive',body)).status,200);assert.equal(await Audit.countDocuments({entityId:e._id,action:'payment_event_archived'}),1);
});
test('Z09 NR03: recibo originado en webhook pero contrastado por GET privado sirve de evidencia; sin contraste se rechaza',async()=>{
  const {order}=await f.newWompi(),tx=f.linkTx(order);pub(tx);await f.postEvent(tx);const proof=await receipt(tx);
  assert.equal(proof.source,'webhook');assert.ok(proof.providerObservation.checkedAt);
  const declined={...tx,status:'DECLINED'};await f.postEvent(declined);const e=await receipt(declined);const body={reason:'Misma transacción ya contrastada en GET privado',evidenceReceiptId:String(proof._id)};
  const candidates=(await f.api('GET',`/api/admin/orders/payment-events?view=verified&transactionId=${tx.id}`,{cookie:f.cookies.admin})).json.events;assert.ok(candidates.some(x=>x._id===String(proof._id)));
  await f.M.PaymentEvent.updateOne({_id:proof._id},{$unset:{providerObservation:1}});
  assert.equal((await action(e,'archive',body)).status,409);
  await f.M.PaymentEvent.updateOne({_id:proof._id},{$set:{providerObservation:proof.providerObservation}});
  assert.equal((await action(e,'archive',body)).status,200);
});
test('Z10 NR03: original asociado, superadmin, reapertura idempotente y nueva evidencia permiten reproceso',async()=>{
  const {order,tx,e,body}=await contradiction('state');await f.M.PaymentEvent.updateOne({_id:e._id},{$set:{order:order._id}});
  await f.M.User.create({name:'Super cierre',email:'super-cierre@example.test',password:'AuditoriaPrueba123!',role:'superadmin'});
  const cookie=await f.login('super-cierre@example.test','AuditoriaPrueba123!');assert.equal((await action(e,'archive',body,cookie)).status,200);
  assert.equal((await action(e,'reprocess')).status,409);
  const reason={reason:'Nueva respuesta autenticada del proveedor'};assert.ok((await Promise.all([action(e,'reopen',reason),action(e,'reopen',reason)])).every(x=>x.status===200));
  pub({...tx,status:'DECLINED'});assert.equal((await action(e,'reprocess')).status,200);
  const after=await f.M.PaymentEvent.findById(e._id).lean();assert.ok(after.processedAt);assert.equal(after.administrativeArchive.active,false);assert.equal(after.associationError,'');
  assert.equal((await f.fresh(order._id)).paymentStatus,'pagado');
  const Audit=require('../../../backend/src/models/AuditLog');assert.equal(await Audit.countDocuments({entityId:e._id,action:'payment_event_reopened'}),1);
});
test('Z11 NR03: petición sin cuerpo y evidencia de otro ambiente no producen archivo ni cierre falso',async()=>{
  const {e,proof,body}=await contradiction();assert.equal((await action(e,'archive')).status,400);assert.equal((await action(e,'reopen')).status,400);
  await f.M.PaymentEvent.updateOne({_id:proof._id},{$set:{environment:'prod'}});assert.equal((await action(e,'archive',body)).status,409);
  const after=await f.M.PaymentEvent.findById(e._id).lean();assert.ok(!after.administrativeArchive?.active);assert.equal(after.processedAt,null);
});
