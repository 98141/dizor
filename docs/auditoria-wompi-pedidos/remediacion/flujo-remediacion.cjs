const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({page,fixture,ctx,origin,out,result,cookie,text,goto,click,check}) => {
  result.passed=false;
  const fill=async(selector,value)=>{await page.waitForSelector(selector);await page.click(selector);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.type(selector,String(value));};
  const create=async()=>{
    const p=await fixture.makeProduct(4,80000);
    const r=await fixture.api('POST','/api/checkout/orders',{body:fixture.orderBody(p.product,p.variantId,{paymentMethod:'wompi'})});
    assert.equal(r.status,201,r.text);return {p,r,order:await ctx.Order.findById(r.json.order.id)};
  };
  await cookie('admin');
  const recovery=await create(), tx=fixture.txFor(recovery.order);ctx.providerTx.set(tx.id,tx);
  await goto('/admin/pedidos/'+recovery.order._id,'Consultar y conciliar con Wompi');
  await fill('input[name="transactionId"]',tx.id);await click('Consultar y conciliar con Wompi');await click('Consultar evidencia de Wompi');await text('Comenzar preparación');
  assert.equal((await ctx.Order.findById(recovery.order._id)).paymentStatus,'pagado');assert.equal(await fixture.stockOf(recovery.p.product,recovery.p.variantId),3);
  check('REM-UI01 recuperación por ID introducido en formulario y consulta autenticada; sin webhook');

  const extra=fixture.txFor(recovery.order);assert.equal((await fixture.postEvent(extra)).status,200);
  await cookie('superadmin');await goto('/admin/pedidos/'+recovery.order._id,'Atender incidencias');
  await page.locator(()=>[...document.querySelectorAll('summary')].find(e=>e.textContent.includes('additional_approved_payment'))).click();
  await fill('textarea[name="reason"]','Comprobante externo ficticio revisado en prueba aislada');
  // Two transactionId fields are legitimate: reconciliation and refund evidence.
  await fill('details input[name="transactionId"]',extra.id);await fill('input[name="reference"]','DEV-UI-FICTICIA-001');
  await fill('input[name="url"]','https://example.test/comprobante-ficticio');await fill('input[name="amountInCents"]',extra.amount_in_cents);
  await page.$eval('input[name="recordedAt"]',e=>{e.value='2026-11-20T12:30';});await click('Registrar resolución con auditoría');await text('Comenzar preparación');
  const resolved=await ctx.Order.findById(recovery.order._id);assert.equal(resolved.requiresReview,false);assert.equal(resolved.wompi.transactionId,tx.id);
  assert.equal(await require('../../../backend/src/models/AuditLog').countDocuments({entityId:resolved._id,action:'payment_incident_resolved'}),1);
  check('REM-UI02 superadmin documenta devolución manual ficticia con evidencia; no API de devolución');

  const unmatched=await create(),unTx=fixture.txFor(unmatched.order);await fixture.postEvent({...unTx,payment_link_id:null});ctx.providerTx.set(unTx.id,unTx);
  await cookie('admin');await goto('/admin/alertas','Conciliación Wompi');await click('Consultar eventos de pago pendientes');await text(unTx.id);
  await click('Consultar y reprocesar con Wompi');await text('Estado consultado con Wompi');assert.equal((await ctx.Order.findById(unmatched.order._id)).paymentStatus,'pagado');
  check('REM-UI03 evento no asociado visible y reprocesable desde alertas, sin pedido ficticio');

  await fixture.postEvent({...tx,status:'VOIDED'});await goto('/admin/pedidos/'+recovery.order._id,'Cobro anulado');
  assert.equal(await page.$eval('body',e=>e.innerText.includes('Comenzar preparación')),false);
  assert.equal(await fixture.stockOf(recovery.p.product,recovery.p.variantId),3);
  check('REM-UI04 anulación bloquea preparación en interfaz y conserva inventario');
  await cookie('vendedor');await goto('/vendedor/pedidos/'+recovery.order._id,'SIGUIENTE ACCIÓN');
  assert.equal(await page.$('textarea[name="reason"]'),null);assert.equal(await page.$('input[name="transactionId"]'),null);
  check('REM-UI05 vendedor sin resolución financiera ni conciliación');

  const pending=await create();await page.goto(origin+'/pedido/confirmacion?order='+pending.order.orderNumber,{waitUntil:'domcontentloaded'});
  await page.evaluate(({orderNumber,token})=>sessionStorage.setItem('dizor_order_access',JSON.stringify({orderNumber,token})),{orderNumber:pending.order.orderNumber,token:pending.r.json.accessToken});
  await page.reload({waitUntil:'domcontentloaded'});await text('Pedido registrado; pago pendiente');
  const pendingTx=fixture.txFor(pending.order);await fixture.postEvent(pendingTx);
  await page.waitForFunction(()=>document.body.innerText.includes('Aprobado'),{timeout:25000});
  check('REM-UI06 invitado: copia pendiente neutra y sondeo actualiza aprobación sin tomar URL como prueba');
  await page.setViewport({width:390,height:1000});await page.screenshot({path:path.join(out,'remediacion-confirmacion-390.png'),fullPage:true});
  assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.hydrationErrors,[]);result.passed=true;
  fs.writeFileSync(path.join(out,'remediacion-ui.json'),JSON.stringify(result,null,2));
};
