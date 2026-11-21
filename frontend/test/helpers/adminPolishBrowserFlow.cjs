"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function({page,fixture,ctx,origin,out,result,cookie,goto,text,check,sleep}){
 const mode=result.mode,folder=path.join(out,mode);fs.mkdirSync(folder,{recursive:true});
 const {product}=await fixture.makeProduct(12);product.name='Sombrero de iraca · taller';product.mainImage='/favicon-dizor.png';product.images=[{url:'/favicon-dizor.png',alt:'Fixture local'}];product.variants[0].sku='F6-IRACA';await product.save();
 const Size=require('../../../backend/src/models/size');const size=await Size.create({name:'L'});product.variants.push({size:size._id,color:product.variants[0].color,sku:'F6-AGOTADO',stock:0});await product.save();
 const order=(await fixture.api('POST','/api/checkout/orders',{body:fixture.orderBody(product,product.variants[0]._id)})).json.order;
 const SpecialRequest=require('../../../backend/src/models/specialRequest');const request=await SpecialRequest.create({requestNumber:'F6-001',type:'wholesale',status:'pendiente',contact:{name:'Taller de prueba',email:'taller@example.test',phone:'3001234567'},estimatedQuantity:20});
 const network={handle:null};
 page.on('request',async r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&!['data:','blob:'].includes(u.protocol)){result.externalRequests.push(u.origin+u.pathname);r.abort();}else if(network.handle && await network.handle(r))return;else r.continue();});
 const routes=[['inicio','/admin','Resumen de pedidos'],['pedidos','/admin/pedidos','Todos'],['pedido',`/admin/pedidos/${order.id}`,'Comenzar preparación'],['comunicaciones','/admin/pedidos?tray=communications','Comunicaciones'],['productos','/admin/productos','Sombrero de iraca'],['existencias',`/admin/productos?view=stock&productId=${product.id}&variantId=${product.variants[0].id}`,'F6-IRACA'],['movimientos','/admin/productos?view=movements','Movimientos e historial'],['producto-nuevo','/admin/productos/nuevo','Información general'],['producto-editar',`/admin/productos/${product.id}/editar`,'Información general'],['taxonomias','/admin/catalogo','Nuevo'],['solicitudes','/admin/solicitudes','F6-001'],['solicitud',`/admin/solicitudes/${request.id}`,'Taller de prueba'],['pqr','/admin/pqr','PQR'],...['home','imagenes','banners','pages','resenas','appearance'].map(t=>['tienda-'+t,'/admin/contenido?tab='+t,'Tienda online']),...['popup','newsletter','carritos'].map(t=>['marketing-'+t,'/admin/marketing?tab='+t,'Marketing']),['exportaciones','/admin/marketing?tab=exports','Exportaciones'],['cupones','/admin/cupones','Cupones'],['finanzas','/admin/finanzas','Finanzas'],['usuarios','/admin/usuarios','Usuarios'],['configuracion','/admin/configuracion','Envío incluido'],['auditoria','/admin/auditoria','Auditoría'],['alertas','/admin/alertas','Alertas']];
 result.screens=[]; result.accessibility=[]; result.axe=[];
 await cookie('superadmin');
 for(const [name,url,ready] of routes){
  await page.setViewport({width:1440,height:900});await goto(url,ready);await sleep(350);
  for(const width of [1440,1024,820,390,360]){
   await page.setViewport({width,height:900});await sleep(60);await page.evaluate(()=>scrollTo(0,0));
   const audit=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,h1:[...document.querySelectorAll('main h1')].map(e=>({text:e.textContent,font:getComputedStyle(e).fontSize})),unlabelled:[...document.querySelectorAll('main input:not([type=hidden]),main select,main textarea')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>({tag:e.tagName,name:e.name,placeholder:e.placeholder})),overflow:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);}).slice(0,8).map(e=>({tag:e.tagName,class:String(e.className).slice(0,120)}))}));
   result.screens.push({name,url,...audit});
   if(mode!=='antes' && [1440,360].includes(width)){const contrast=await page.evaluate(require('./adminAccessibilityAudit.cjs'));const ax=await (await page.createCDPSession()).send('Accessibility.getFullAXTree');
    if(!await page.evaluate(()=>!!globalThis.axe))await page.addScriptTag({content:fs.readFileSync(require.resolve('../../node_modules/axe-core/axe.min.js'),'utf8')});
    const axe=await page.evaluate(async()=>{const r=await globalThis.axe.run(document.querySelector('.admin-shell'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length,incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))};});result.axe.push({name,width,...axe});fs.writeFileSync(path.join(folder,'axe.json'),JSON.stringify(result.axe,null,2));result.accessibility.push({name,width,contrast,unnamedButtons:ax.nodes.filter(n=>!n.ignored&&n.role?.value==='button'&&!n.name?.value).length});}
   // Every route at every requested width; viewport images facilitate side-by-side review.
   await page.screenshot({path:path.join(folder,`${name}-${width}.png`),fullPage:false});
  }
  check(`${name}: cinco anchos inspeccionados`);
 }
 await cookie('vendedor');for(const [name,url,ready] of [['vendedor','/vendedor','Panel vendedor'],['vendedor-pedidos','/vendedor/pedidos','Todos'],['vendedor-pedido',`/vendedor/pedidos/${order.id}`,'Comenzar preparación'],['vendedor-solicitudes','/admin/solicitudes','F6-001']]){
  await goto(url,ready);for(const width of [1440,1024,820,390,360]){await page.setViewport({width,height:900});await sleep(60);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(folder,`${name}-${width}.png`),fullPage:false});result.screens.push({name,width,document:await page.evaluate(()=>document.documentElement.scrollWidth)});}check(`${name}: cinco anchos`);
 }
 fs.writeFileSync(path.join(folder,'accesibilidad.json'),JSON.stringify(result.accessibility,null,2));
 fs.writeFileSync(path.join(folder,'pantallas.json'),JSON.stringify(result.screens,null,2));
 if(mode!=='antes') await require('./adminPolishInteractions.cjs')({page,fixture,ctx,origin,out:folder,result,cookie,goto,text,check,sleep,product,order,request,network});
 assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.hydrationErrors,[]);assert.deepEqual(result.externalRequests,[]);
 result.passed=true;
};

