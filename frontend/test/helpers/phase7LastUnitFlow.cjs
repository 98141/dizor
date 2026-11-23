"use strict";
const assert=require('node:assert/strict');
module.exports=async({page,fixture,ctx,origin,product,check,result,handleRequest})=>{
 const p=await product(1),sessions=[];
 const wait=(tab,t)=>tab.waitForFunction(t=>document.body.innerText.includes(t),{timeout:20000},t);
 const click=async(tab,label)=>{const f=new Function('return [...document.querySelectorAll("button,a")].find(e=>e.getClientRects().length&&e.textContent.trim()==='+JSON.stringify(label)+')');await tab.waitForFunction(f);await tab.locator(f).click();};
 try{
  for(let i=0;i<2;i++){
   const context=await page.browser().createBrowserContext(),tab=await context.newPage();sessions.push({context,tab});tab.on('pageerror',e=>result.pageErrors.push(e.message));tab.on('console',m=>{if(/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text()))result.hydrationErrors.push(m.text());});await tab.setViewport({width:1440,height:1000});await tab.setRequestInterception(true);tab.on('request',handleRequest);
   await tab.goto(origin+'/producto/'+p.product.slug);await wait(tab,p.product.name);if(await tab.$eval('body',e=>[...e.querySelectorAll('button')].some(b=>b.textContent.trim()==='Rechazar')))await click(tab,'Rechazar');await click(tab,'Agregar al carrito');await wait(tab,'Producto agregado al carrito');await click(tab,'Ver carrito');await wait(tab,'Ir a checkout');await click(tab,'Ir a checkout');await wait(tab,'Datos de contacto');
   for(const [name,value] of Object.entries({name:'Cliente simultáneo '+i,email:`qa7-cliente-${i}@example.test`,phone:'3000000099'}))await tab.type('input[name="'+name+'"]',value);
   await tab.type('input[name="address"]','Calle QA7 ficticia 10');await tab.type('#municipality','pasto');await tab.keyboard.press('ArrowDown');await tab.keyboard.press('Enter');await tab.click('input[name="payment"][value="contra_entrega"]');for(const box of await tab.$$('input[type="checkbox"]'))await box.click();await tab.waitForFunction(()=>document.querySelector('.checkout-layout button[type="submit"]')&&!document.querySelector('.checkout-layout button[type="submit"]').disabled);
  }
  await Promise.all(sessions.map(({tab})=>tab.evaluate(()=>document.querySelector('.checkout-layout button[type="submit"]').click())));
  const responses=await Promise.all(sessions.map(async({tab})=>{await tab.waitForFunction(()=>location.pathname.includes('confirmacion')||!!document.querySelector('[role=alert]'),{timeout:20000});return {url:tab.url(),text:await tab.$eval('body',e=>e.innerText)};}));
  const orders=await ctx.Order.find({'items.product':p.product._id});assert.equal(orders.filter(o=>o.stockDeducted).length,1);assert.equal(await fixture.stockOf(p.product,p.variantId),0);assert.equal(await ctx.ProductHistory.countDocuments({productId:p.product._id,eventType:'sale'}),1);assert.equal(responses.filter(r=>r.url.includes('confirmacion')).length,1);result.lastUnitSessions=responses;check('BUY dos navegadores independientes compiten por última unidad: una compra, una negativa, stock cero y un movimiento');
 }finally{for(const {context} of sessions)await context.close();}
};
