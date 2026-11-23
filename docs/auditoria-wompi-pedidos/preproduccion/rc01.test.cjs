const test=require('node:test'),assert=require('node:assert/strict');const f=require('../auditoria-claude/evidencias/fixture-claude.cjs');
test.before(async()=>f.setup());test.after(async()=>f.close());const pub=tx=>f.provider.tx.set(tx.id,{...tx});
const action=(r,name,body,cookie=f.cookies.admin)=>f.api('POST',`/api/admin/orders/payment-events/${r._id}/${name}`,{cookie,body});
const conclude=(r,body={reason:'Dinero aplicado y discrepancia investigada'},cookie)=>action(r,'conclude-follow-up',body,cookie);
const get=async r=>f.M.PaymentEvent.findById(r._id).lean();const view=async name=>(await f.api('GET',`/api/admin/orders/payment-events?view=${name}`,{cookie:f.cookies.admin})).json;
const alerts=async()=>(await f.api('GET','/api/admin/alerts',{cookie:f.cookies.admin})).json;
const raw=r=>JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k])=>!['administrativeArchive','updatedAt','__v'].includes(k))));
async function scenario(){const {order,p}=await f.newWompi(),tx=f.linkTx(order);pub(tx);await f.postEvent({...tx,status:'DECLINED'});
  const r=await f.M.PaymentEvent.findOne({transactionId:tx.id,status:'DECLINED'}).lean();
  assert.equal((await f.api('POST',`/api/admin/orders/${order._id}/reconcile-wompi`,{cookie:f.cookies.admin,body:{transactionId:tx.id}})).status,200);
  const proof=await f.M.PaymentEvent.findOne({transactionId:tx.id,status:'APPROVED'}).lean();assert.equal((await action(r,'archive',{reason:'Contradicción investigada',evidenceReceiptId:String(proof._id)})).status,200);
  return{order,p,tx,r:await get(r),proof};}
const Audit=()=>require('../../../backend/src/models/AuditLog');
test('Q01 RC01: conclusión motivada quita alerta, conserva archivo visible, evidencia y hechos financieros',async()=>{
 const {r,order,p}=await scenario(),before=await alerts(),o=await f.fresh(order._id);assert.equal((await conclude(r)).status,200);
 const after=await alerts(),e=await get(r),o2=await f.fresh(order._id);assert.equal(after.alerts.financialFollowUp.count,before.alerts.financialFollowUp.count-1);assert.equal(after.totalCount,before.totalCount-1);
 assert.ok((await view('closed-follow-up')).events.some(x=>x._id===String(r._id)));assert.ok(!(await view('financial-follow-up')).events.some(x=>x._id===String(r._id)));assert.equal(e.administrativeArchive.financialFollowUp,false);assert.ok(e.administrativeArchive.concludedAt);assert.ok(e.administrativeArchive.concludedBy);assert.equal(raw(e),raw(r));assert.equal(e.processedAt,null);
 for(const key of ['paymentStatus','orderStatus','stockDeducted','couponConsumed','wompi','incidents','paymentConfirmedAt'])assert.equal(JSON.stringify(o2[key]),JSON.stringify(o[key]));assert.equal(await f.stockOf(p),4);
 const log=await Audit().findOne({entityId:r._id,action:'payment_event_follow_up_concluded'}).lean();assert.ok(log?.newData.conclusionReason);assert.equal(log.newData.financialFollowUp,false);
});
test('Q02 RC01: permisos y motivo obligatorio; sin petición válida no hay conclusión',async()=>{
 const {r}=await scenario();for(const cookie of[f.cookies.vendor,f.cookies.client])assert.equal((await conclude(r,{},cookie)).status,403);
 for(const body of[{}, {reason:' '},{reason:{$ne:''}},{reason:'x'.repeat(1001)}])assert.equal((await conclude(r,body)).status,400);
 assert.equal((await action(r,'conclude-follow-up')).status,400);assert.equal((await get(r)).administrativeArchive.financialFollowUp,true);
});
test('Q03 RC01: incidencia financiera activa o bandera de revisión sigue bloqueando la conclusión',async()=>{
 const {r,order}=await scenario();await f.M.Order.updateOne({_id:order._id},{$set:{requiresReview:true}});assert.equal((await conclude(r)).status,409);
 await f.M.Order.updateOne({_id:order._id},{$set:{requiresReview:false},$push:{incidents:{code:'additional_approved_payment',detail:'Otro cobro abierto'}}});assert.equal((await conclude(r)).status,409);assert.equal((await get(r)).administrativeArchive.financialFollowUp,true);
});
test('Q04 RC01: consulta privada discrepante o caída no cierra; evidencia local procesada sola no basta',async()=>{
 const {r,tx}=await scenario();pub({...tx,status:'VOIDED'});assert.equal((await conclude(r)).status,409);pub({...tx,amount_in_cents:tx.amount_in_cents+1});assert.equal((await conclude(r)).status,409);
 const previous=globalThis.fetch;globalThis.fetch=async(u,init)=>new URL(typeof u==='string'?u:u.url).pathname.endsWith(tx.id)?new Response('{}',{status:500}):previous(u,init);
 try{assert.equal((await conclude(r)).status,503);}finally{globalThis.fetch=previous;}
 assert.equal((await get(r)).administrativeArchive.financialFollowUp,true);
});
test('Q05 RC01: conclusión repetida/concurrente conserva fecha y una sola decisión',async()=>{
 const {r}=await scenario(),body={reason:'Una sola decisión auditada'};assert.ok((await Promise.all([1,2,3].map(()=>conclude(r,body)))).every(x=>x.status===200));const e=await get(r);
 assert.equal((await conclude(r,body)).status,200);assert.equal(+new Date((await get(r)).administrativeArchive.concludedAt),+new Date(e.administrativeArchive.concludedAt));assert.equal(await Audit().countDocuments({entityId:r._id,action:'payment_event_follow_up_concluded'}),1);assert.equal((await conclude(r,{reason:'Cambiar decisión cerrada'})).status,409);
});
test('Q06 RC01: fallo de AuditLog revierte conclusión y bloqueo de concurrencia del pedido',async()=>{
 const {r,order}=await scenario(),before=await f.fresh(order._id);await f.failpoint({times:1},{failCommands:['insert'],errorCode:2});let response;try{response=await conclude(r);}finally{await f.failpoint('off');}
 assert.ok(response.status>=500);assert.equal((await get(r)).administrativeArchive.financialFollowUp,true);assert.equal((await f.fresh(order._id)).__v,before.__v);assert.equal(await Audit().countDocuments({entityId:r._id,action:'payment_event_follow_up_concluded'}),0);assert.equal((await conclude(r)).status,200);
});
test('Q07 RC01: reapertura devuelve a bandeja; rearchivo abre un seguimiento nuevo, conserva auditorías anteriores',async()=>{
 const {r,proof}=await scenario();assert.equal((await conclude(r)).status,200);assert.equal((await action(r,'reopen',{reason:'Nueva evidencia a investigar'})).status,200);assert.ok((await view('pending')).events.some(x=>x._id===String(r._id)));
 assert.equal((await action(r,'archive',{reason:'Reevaluación con evidencia',evidenceReceiptId:String(proof._id)})).status,200);assert.equal((await get(r)).administrativeArchive.financialFollowUp,true);assert.equal(await Audit().countDocuments({entityId:r._id,action:'payment_event_follow_up_concluded'}),1);
});
test('Q08 RC01: VOIDED posterior sigue bloqueando y visible aunque se concluyera la contradicción anterior',async()=>{
 const {r,tx,order}=await scenario();assert.equal((await conclude(r)).status,200);const v={...tx,status:'VOIDED'};pub(v);assert.equal((await f.postEvent(v)).status,200);const o=await f.fresh(order._id);assert.equal(o.paymentStatus,'rechazado');assert.equal(o.requiresReview,true);assert.equal((await f.canPrepare(order._id)).status,409);assert.ok((await alerts()).alerts.pendingPayments.items.some(x=>x._id===String(order._id)));
});
test('Q09 RC01: pedido con pago primario diferente, recibo de otro ambiente o no archivado se rechaza',async()=>{
 const {r,order,proof}=await scenario();await f.M.Order.updateOne({_id:order._id},{$set:{'wompi.transactionId':'otro-pago'}});assert.equal((await conclude(r)).status,409);
 await f.M.Order.updateOne({_id:order._id},{$set:{'wompi.transactionId':proof.transactionId}});await f.M.PaymentEvent.updateOne({_id:proof._id},{$set:{environment:'prod'}});assert.equal((await conclude(r)).status,409);assert.equal((await conclude(proof)).status,409);
});
test('Q10 RC01: VOIDED concurrente tras consultar APPROVED impide una conclusión con evidencia obsoleta',async()=>{
 const {r,order,tx}=await scenario(),previous=globalThis.fetch;let signal,release,held=false;const reached=new Promise(resolve=>signal=resolve),resume=new Promise(resolve=>release=resolve);
 globalThis.fetch=async(u,init)=>{const result=await previous(u,init);if(!held&&new URL(typeof u==='string'?u:u.url).pathname.endsWith(tx.id)){held=true;signal();await resume;}return result;};
 try{const pending=conclude(r);await reached;const v={...tx,status:'VOIDED'};pub(v);assert.equal((await f.postEvent(v)).status,200);release();assert.equal((await pending).status,409);}finally{release();globalThis.fetch=previous;}
 assert.equal((await get(r)).administrativeArchive.financialFollowUp,true);assert.equal((await f.fresh(order._id)).requiresReview,true);assert.equal((await f.canPrepare(order._id)).status,409);
});
test('Q11 RC01: superadmin autorizado; sin sesión y listado cerrado como vendedor se rechazan',async()=>{
 const {r}=await scenario();assert.equal((await f.api('POST',`/api/admin/orders/payment-events/${r._id}/conclude-follow-up`,{body:{reason:'Sin sesión'}})).status,401);
 await f.M.User.create({name:'Super preproducción',email:'super-preprod@example.test',password:'AuditoriaPrueba123!',role:'superadmin'});const cookie=await f.login('super-preprod@example.test','AuditoriaPrueba123!');assert.equal((await conclude(r,{reason:'Revisión por superadmin'},cookie)).status,200);
 assert.equal((await f.api('GET','/api/admin/orders/payment-events?view=closed-follow-up',{cookie:f.cookies.vendor})).status,403);
});
