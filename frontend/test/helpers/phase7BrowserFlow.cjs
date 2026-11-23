"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({page,fixture,ctx,origin,out,result,text,goto,click,check,sleep})=>{
 const Notification=require('../../../backend/src/models/notification');
 const Marketing=require('../../../backend/src/models/marketingSettings');
 await Marketing.findOneAndUpdate({key:'default'},{$set:{'popup.enabled':false}},{upsert:true,setDefaultsOnInsert:true});
 const delivery=require('../../../backend/src/services/notificationDelivery');
 const inbox=new Map(),requests=[];let lost=false,loseNext=false;
 process.env.ADMIN_NOTIFY_EMAIL='notify@example.test';process.env.EMAIL_FROM='sender@example.test';
 delivery.setReceiptTransport(null);delivery.setTransportForTests(async(message,{idempotencyKey})=>{if(inbox.has(idempotencyKey))assert.deepEqual(inbox.get(idempotencyKey).message,message);else inbox.set(idempotencyKey,{message,id:'fake-'+inbox.size});return {data:{id:inbox.get(idempotencyKey).id}};});
 const acceptEvent=async(order,event)=>{const n=await Notification.findOne({order:order._id,event});assert(n,event);await Promise.all([delivery.processOne(n._id),delivery.processOne(n._id)]);for(let i=0;i<30;i++){if((await Notification.findById(n._id)).status==='sent')return;await sleep(50);}assert.equal((await Notification.findById(n._id)).status,'sent',event);};
 const cors={'access-control-allow-origin':origin,'access-control-allow-credentials':'true'};
 const handleRequest=async r=>{try{
  const u=new URL(r.url());
  if(u.hostname==='checkout.wompi.co'){result.externalRequests.push({url:r.url(),simulated:true});return r.respond({status:200,contentType:'text/html',body:'<html><body>Proveedor Wompi simulado. Sin pago real.</body></html>'});}
  if(!['127.0.0.1','localhost'].includes(u.hostname)&&!r.url().startsWith('data:')){result.externalRequests.push({url:r.url(),blocked:true});return r.abort();}
  if(r.method()==='POST'&&u.pathname==='/api/checkout/orders'){
   const body=JSON.parse(r.postData());requests.push(body);
   if(loseNext){loseNext=false;const applied=await fixture.api('POST','/api/checkout/orders',{body,cookie:ctx.clientCookie});assert.equal(applied.status,201,applied.text);lost=true;return r.abort('failed');}
  }
  return r.continue();
 }catch(e){result.requestError=e.stack;if(!r.isInterceptResolutionHandled())await r.respond({status:500,headers:cors,body:'test interception error'});}};page.on('request',handleRequest);
 const fill=async(selector,value)=>{await page.waitForSelector(selector);await page.click(selector);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.type(selector,String(value));};
 const login=async role=>{
  // Setup already made four real logins from loopback. Reset only the test
  // process's memory counter; retain the application policy and real login UI.
  require('../../../backend/src/middlewares/rateLimitMiddleware').loginLimiter.resetKey('127.0.0.1');
  const cookies=await page.cookies();if(cookies.length)await page.deleteCookie(...cookies);
  await goto('/login','Iniciar sesión');
  if(await page.$eval('body',e=>[...e.querySelectorAll('button')].some(b=>b.textContent.trim()==='Rechazar')))await click('Rechazar','button');
  await fill('input[name="email"]',({client:'cliente',admin:'admin',superadmin:'super',vendor:'vend'})[role]+'-cierre@example.test');await fill('input[name="password"]','CierrePrueba123');await click('Entrar','button');
  await page.waitForFunction(()=>!location.pathname.startsWith('/login'),{timeout:20000});
  await text(role==='client'?'Cliente Cierre':role==='vendor'?'Inicio':'Inicio');check('AUTH '+role+': formulario y sesión HTTP reales');
 };
 const product=async stock=>{const p=await fixture.makeProduct(stock,80000);await ctx.Product.updateOne({_id:p.product._id},{$set:{mainImage:'/favicon-dizor.png',images:[{url:'/favicon-dizor.png'}]}});return p;};
 const checkout=async(p,method,{lose=false}={})=>{
  await goto('/producto/'+p.product.slug,p.product.name);await click('Agregar al carrito','button');await text('Producto agregado al carrito');await click('Ver carrito','a');await text('Ir a checkout');await click('Ir a checkout','a,button');await text('Datos de contacto');
  await fill('input[name="phone"]','3000000099');await fill('input[name="address"]','Calle Ficticia 10');await fill('#municipality','pasto');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await page.click('input[name="payment"][value="'+method+'"]');
  const action=method==='wompi'?'Ir a pagar con Wompi':'Confirmar pedido contraentrega';
  assert.equal(await page.$('input[name="carrier"]'),null);
  for(const id of ['consent-order_processing','consent-terms']){await page.waitForSelector('#'+id);await page.focus('#'+id);await page.keyboard.press('Space');assert(await page.$eval('#'+id,e=>e.checked));}
  await page.waitForFunction(()=>document.querySelector('.checkout-layout button[type="submit"]')&&!document.querySelector('.checkout-layout button[type="submit"]').disabled);
  const before=requests.length;loseNext=lose;
  // Both calls happen in one JavaScript task, before React can render disabled.
  await page.evaluate(()=>{const b=document.querySelector('.checkout-layout button[type="submit"]');b.click();b.click();});
  if(lose){await text('No se pudo crear el pedido');assert(lost);assert.equal(requests.length,before+1);await click(action);}
  if(method==='wompi')await page.waitForFunction(()=>location.hostname==='checkout.wompi.co',{timeout:20000});else await page.waitForFunction(()=>location.pathname.includes('confirmacion'),{timeout:20000});
  const rows=await ctx.Order.find({'items.product':p.product._id});assert.equal(rows.length,1);const order=rows[0];
  assert.equal(requests.length,before+(lose?2:1));assert.equal(Object.hasOwn(requests.at(-1),'carrier'),false);assert.equal(order.carrier,'');if(lose)assert.equal(requests.at(-1).idempotencyKey,requests.at(-2).idempotencyKey);
  assert.equal(await fixture.stockOf(p.product,p.variantId),method==='wompi'?p.product.variants[0].stock:p.product.variants[0].stock-1);
  assert.equal(await Notification.countDocuments({order:order._id,event:'order.received'}),1);
  await acceptEvent(order,'order.received');
  check('BUY '+method+(lose?' respuesta perdida + reintento misma clave':' doble clic una petición')+': PDP, carrito, checkout, stock y outbox');return order;
 };
 const getOrder=o=>ctx.Order.findById(o._id);
 const operate=async(o,collect)=>{
  await acceptEvent(o,'admin.ready');
  await goto('/admin/pedidos?tray=prepare',o.orderNumber);await page.click('a[href*="/pedidos/'+o._id+'"]');await text('Comenzar preparación');await click('Comenzar preparación');await text('Registrar envío y despachar');
  await page.select('select[name="carrier"]','servientrega');await fill('input[name="trackingNumber"]','GUIA-QA7-'+String(o._id).slice(-6));await click('Registrar envío y despachar');await click('Confirmar despacho');await text('Registrar entrega');
  await acceptEvent(o,'order.shipped');let current=await getOrder(o);assert.equal(current.orderStatus,'enviado');assert.equal(current.paymentStatus,collect?'pendiente':'pagado');
  await click('Corregir guía');await fill('input[name="trackingNumber"]','GUIA-CORREGIDA-'+String(o._id).slice(-6));await click('Guardar corrección de guía');await click('Confirmar corrección de guía');await text('Operación registrada');await page.waitForFunction(()=>!document.querySelector('fieldset'));await acceptEvent(o,'shipping.corrected');
  await click('Registrar entrega');await click('Confirmar entrega');await page.waitForFunction(()=>!document.querySelector('fieldset'));await text('Entrega registrada');current=await getOrder(o);assert.equal(current.orderStatus,'entregado');assert.equal(current.paymentStatus,collect?'pendiente':'pagado');await acceptEvent(o,'order.delivered');
  if(collect){await text('Registrar recaudo');await fill('input[name="reference"]','GIRO-FICTICIO-QA7');await page.$eval('input[name="receivedAt"]',e=>{e.value='2026-11-20T12:30';});await click('Registrar recaudo');await click('Confirmar recaudo');await text('Recaudo verificado en el registro');}
  current=await getOrder(o);assert.equal(current.paymentStatus,'pagado');assert.equal(current.orderStatus,'entregado');assert.deepEqual(current.statusHistory.map(h=>h.status).filter((s,i,a)=>i===0||s!==a[i-1]).slice(-3),['en_preparacion','enviado','entregado']);assert(current.statusHistory.length>=4);
  for(const event of ['order.shipped','shipping.corrected','order.delivered'])assert.equal(await Notification.countDocuments({order:o._id,event}),1,event);
  check('OPS '+(collect?'COD entrega pendiente + cobro con evidencia':'Wompi verificado')+': bandeja, preparación, despacho, corrección, entrega e historial');
 };
 await login('client');const codP=await product(4),cod=await checkout(codP,'contra_entrega',{lose:true});
 await login('admin');await operate(cod,true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'e2e-cod-entregado-cobrado.png'),fullPage:true});
 await login('client');const wompiP=await product(4),wompi=await checkout(wompiP,'wompi');assert.equal(wompi.stockDeducted,false);const tx={...fixture.txFor(wompi),payment_link_id:wompi.wompi.paymentLinkId};fixture.setProviderTransaction(tx);const approved=await Promise.all([fixture.postEvent(tx),fixture.postEvent(tx),fixture.postEvent(tx)]);assert(approved.every(r=>r.status===200));assert.equal(await fixture.stockOf(wompiP.product,wompiP.variantId),3);assert.equal((await getOrder(wompi)).paymentStatus,'pagado');assert.equal(await Notification.countDocuments({order:wompi._id,event:'payment.approved'}),1);check('PAY webhook aprobado simultáneo: un descuento y una notificación');
 await login('admin');await operate(wompi,false);
 await login('client');const declinedP=await product(2),declined=await checkout(declinedP,'wompi');const rejectedTx={...fixture.txFor(declined,{status:'DECLINED'}),payment_link_id:declined.wompi.paymentLinkId};fixture.setProviderTransaction(rejectedTx);await fixture.postEvent(rejectedTx);assert.equal(await fixture.stockOf(declinedP.product,declinedP.variantId),2);let d=await getOrder(declined);assert.equal(d.paymentStatus,'rechazado');assert.notEqual(d.orderStatus,'cancelado');
 await login('admin');await goto('/admin/pedidos/'+declined._id,'SIGUIENTE ACCIÓN');assert.equal(await page.$eval('body',e=>e.innerText.includes('Comenzar preparación')),false);assert.equal(await page.$('input[name="trackingNumber"]'),null);check('PAY rechazado: no cancela, no descuenta, no permite preparar/despachar');
 await require('./phase7LastUnitFlow.cjs')({page,fixture,ctx,origin,product,check,result,handleRequest});
 await login('vendor');await goto('/vendedor/pedidos?tray=all',cod.orderNumber);await page.click('a[href*="/pedidos/'+cod._id+'"]');await text('SIGUIENTE ACCIÓN');assert.equal(await page.$eval('body',e=>e.innerText.includes('Registrar recaudo')),false);await goto('/admin/solicitudes','Solicitudes');assert.equal(await page.$eval('.admin-shell',e=>e.innerText.includes('Finanzas')),false);check('ROLE vendedor: login real, pedidos y alias solicitudes sin finanzas');
 for(const endpoint of ['/api/admin/finance/history','/api/admin/inventory/history'])assert.equal((await fixture.api('GET',endpoint,{cookie:ctx.vendorCookie})).status,403,endpoint);
 check('ROLE denegación backend de finanzas e historial inventario');
 // Transport is fake, but atomic claims and persisted acceptance are real.
 const pending=await Notification.find({order:{$in:[cod._id,wompi._id,declined._id]},status:'pending'});
 for(const n of pending)await Promise.all([delivery.processOne(n._id),delivery.processOne(n._id)]);
 result.simulatedInbox=[...inbox.entries()].map(([key,v])=>({key,id:v.id,subject:v.message.subject}));
 check('MAIL outbox real: transporte simulado e idempotencia por clave; no acredita recepción real');
 const stress=cod.toObject();stress._id=new ctx.mongoose.Types.ObjectId();stress.orderNumber='DIZ-QA7-IMPORTE-EXTREMO';stress.idempotencyKey=require('node:crypto').randomUUID();stress.paymentStatus='pagado';stress.orderStatus='entregado';stress.total=999999999999;stress.subtotal=999999999999;stress.items=stress.items.map(i=>({...i,unitPrice:999999999999,lineTotal:999999999999}));await ctx.Order.collection.insertOne(stress);result.syntheticFinancialStress={orderNumber:stress.orderNumber,total:stress.total,purpose:'Only a new fictitious display fixture, separate from the real UI purchases'};
 await login('superadmin');const history=await fixture.api('GET','/api/admin/finance/history',{cookie:ctx.superCookie});assert.equal(history.status,200,history.text);result.finance=history.json;
 await goto('/admin/finanzas','Finanzas');for(const width of [1440,1024,820,390,360]){await page.setViewport({width,height:1000});await sleep(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'finance overflow '+width);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'finanzas-'+width+'.png'),fullPage:true});}
 check('FIN finanzas después de compra real + responsive 5 anchos');
 result.checkoutRequests=requests.map(b=>({key:b.idempotencyKey,method:b.paymentMethod}));
 assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.hydrationErrors,[]);assert.equal(result.requestError,undefined);result.passed=true;
 fs.writeFileSync(path.join(out,'integracion-compras.json'),JSON.stringify(result,null,2));
};
