"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const measure=require('./taxonomyActionVisibility.cjs');
module.exports=async({page,fixture,ctx,origin,out,result,cookie,goto,text,click,check,sleep})=>{
 const before=result.mode==='antes',dir=path.join(out,before?'antes':'despues');fs.mkdirSync(dir,{recursive:true});
 const types=['categories','colors','sizes','weave-types','styles'];
 const widths=[360,390,699,700,701,820,899,900,901,1024,1099,1100,1101,1199,1200,1201,1279,1280,1281,1439,1440,1441];
 result.measurements=[];result.writes=[];
 page.on('request',r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&!['data:','blob:'].includes(u.protocol)){result.externalRequests.push(u.origin+u.pathname);r.abort();}else{if(['POST','PATCH','DELETE'].includes(r.method()))result.writes.push({method:r.method(),path:u.pathname});r.continue();}});
 for(const type of types)for(const name of [`QA ${type}`,('Nombre artesanal extenso para probar '+type).slice(0,type==='sizes'?30:45)]){
  const created=await fixture.api('POST','/api/admin/catalog/'+type,{cookie:ctx.superCookie,body:{name,description:'Registro temporal de QA',hexCode:'#b87305',label:'Talla de prueba',sortOrder:0,isActive:true}});assert.equal(created.status,201,created.text);
 }
 await cookie('superadmin');
 const assertComplete=data=>{assert.equal(data.document,data.width,'Documento sin desbordamiento');assert(data.actions.length>=4,'Debe haber registros y dos acciones por fila');assert(data.actions.every(a=>a.complete),JSON.stringify(data));assert(data.actions.filter(a=>a.hasViewportHitPoints).every(a=>a.hittable),'Acciones visibles sin superposición');assert(data.headings.every(h=>h.complete),JSON.stringify(data));assert(data.wrap.scroll<=data.wrap.client+1,'Sin desplazamiento horizontal interno');};
 for(const type of types){
  await page.setViewport({width:1440,height:1000});await goto('/admin/catalogo?tab='+type,'Nuevo');await text('QA '+type);const url=page.url();
  // Resize the same document through each boundary; no reload between widths.
  for(const width of widths){
   await page.setViewport({width,height:1000});await sleep(80);
   await page.evaluate(()=>{for(const w of document.querySelectorAll('.admin-table-wrap'))w.scrollLeft=0;const row=document.querySelector('.taxonomy-list-card tbody tr');scrollTo(0,Math.max(0,row.getBoundingClientRect().top+scrollY-150));});
   const data=await page.evaluate(measure);data.type=type;data.urlStable=page.url()===url;
   result.measurements.push(data);assert(data.urlStable);fs.writeFileSync(path.join(dir,'mediciones.json'),JSON.stringify(result.measurements,null,2));
   if(!before)assertComplete(data);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(dir,`${type}-${width}.png`),fullPage:true});
  }
  check(`${type}: ${widths.length} anchos sin recargar`);
 }
 if(before){const sample=result.measurements.find(m=>m.type==='categories'&&m.width===1024);assert.equal(sample.document,1024);assert(sample.actions.some(a=>!a.complete),'La línea base debe reproducir F6-I01');result.reproduced=true;result.passed=true;return;}
 const fill=async(selector,value)=>{await page.click(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.type(selector,value);};
 const rowButton=(name,label)=>new Function('return [...document.querySelectorAll(".taxonomy-list-card tbody tr")].find(r=>r.textContent.includes('+JSON.stringify(name)+'))?.querySelector('+JSON.stringify(label==='Editar'?'button:not(.admin-btn--danger)':'button.admin-btn--danger')+')');
 for(let index=0;index<types.length;index++){
  const type=types[index],name='Operación UI '+type,changed=name+' editada';
  await page.setViewport({width:[1024,1100,900,390,1440][index],height:1000});await goto('/admin/catalogo?tab='+type,'Nuevo');await text('QA '+type);
  await fill('#tax-name',name);if(type==='colors')await fill('#tax-hexCode','#123456');await click('Crear');await page.waitForFunction(n=>[...document.querySelectorAll('tbody tr')].some(r=>r.textContent.includes(n)),{},name);check(type+': creación real con mouse');
  await page.locator(rowButton(name,'Editar')).click();await page.waitForSelector('.taxonomy-form-card button[type="submit"]');await text('Actualizar');await fill('#tax-name',changed);const patches=result.writes.filter(w=>w.method==='PATCH').length;await click('Cancelar');assert.equal(result.writes.filter(w=>w.method==='PATCH').length,patches);assert(await page.evaluate(n=>[...document.querySelectorAll('tbody tr')].some(r=>r.textContent.includes(n)),name));check(type+': cancelar conserva el registro sin PATCH');
  const edit=await page.waitForFunction(rowButton(name,'Editar'));await edit.asElement().focus();await page.keyboard.press('Enter');await text('Actualizar');await fill('#tax-name',changed);await page.focus('button[type="submit"]');await page.keyboard.press('Enter');await page.waitForFunction(n=>[...document.querySelectorAll('tbody tr')].some(r=>r.textContent.includes(n)),{},changed);check(type+': editar y guardar mediante teclado');
  await page.locator(rowButton(changed,'Eliminar')).click();await page.waitForSelector('.admin-confirm');const modal=await page.$eval('.admin-confirm',e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};});assert(modal.left>=0&&modal.right<=modal.width&&modal.top>=0&&modal.bottom<=modal.height);assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Cancelar');await page.keyboard.press('Escape');assert.equal(await page.$('.admin-confirm'),null);check(type+': diálogo y cancelación con Escape');
  const del=await page.waitForFunction(rowButton(changed,'Eliminar'));await del.asElement().focus();await page.keyboard.press('Enter');await page.waitForSelector('.admin-confirm');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Eliminar');await page.keyboard.press('Enter');await page.waitForFunction(n=>![...document.querySelectorAll('tbody tr')].some(r=>r.textContent.includes(n)),{},changed);check(type+': eliminación real por teclado');
  const listing=await fixture.api('GET','/api/admin/catalog/'+type,{cookie:ctx.superCookie});assert(!listing.json.items.some(x=>[name,changed].includes(x.name)));
 }
 await page.setViewport({width:1024,height:1000});await goto('/admin/catalogo?tab=categories','QA categories');await page.evaluate(()=>{const b=document.querySelector('.taxonomy-list-card td button');scrollTo(0,Math.max(0,b.getBoundingClientRect().top+scrollY-150));b.focus();});await page.keyboard.press('Tab');assert(await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return e.textContent.trim()==='Eliminar'&&parseFloat(s.outlineWidth)>=2&&s.outlineStyle!=='none';}));await page.screenshot({path:path.join(dir,'foco-1024.png'),fullPage:false});check('Foco de teclado visible en acción destructiva a 1024 px');
 const mutation=await page.addStyleTag({content:'@media(min-width:900px) and (max-width:1100px){.admin-shell .taxonomy-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}.admin-shell .taxonomy-grid .admin-table{min-width:640px}}'});await sleep(100);await page.evaluate(()=>document.querySelector('.admin-table-wrap').scrollLeft=0);const broken=await page.evaluate(measure);assert.throws(()=>assertComplete(broken));assert.equal(broken.document,1024);await mutation.evaluate(e=>e.remove());assertComplete(await page.evaluate(measure));result.mutation={detected:true,documentOverflow:broken.document-broken.width,clipped:broken.actions.filter(a=>!a.complete).map(a=>a.label)};check('La prueba falla con el CSS anterior aunque el documento no desborde');
 await page.setViewport({width:820,height:1000});await page.click('button[aria-label="Menú"]');await page.waitForSelector('[aria-label="Cerrar menú"]');assert.equal(await page.$eval('.admin-main',e=>e.inert),true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Menú');await page.setViewport({width:900,height:1000});assert.equal(await page.$('.admin-mobile-nav--open'),null);check('Menú móvil, Escape y regreso al lateral sin recarga');
 assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.hydrationErrors,[]);assert.deepEqual(result.externalRequests,[]);result.passed=true;
};
