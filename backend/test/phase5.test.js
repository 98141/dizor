"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
let nav;
test.before(async()=>{nav=await import(pathToFileURL(path.resolve(__dirname,'../../frontend/src/lib/adminNavigation.mjs')).href);});
for(const [role,expected] of [['superadmin',['home','orders','products','attention','store','marketing','finance','settings']],['admin',['home','orders','products','attention','store','marketing','settings']],['vendedor',['home','orders','attention']],['cliente',[]],[undefined,[]]])test(`N01 menú y privilegios visuales: ${role}`,()=>{
 const rows=nav.getNavigation(role);assert.deepEqual(rows.map(m=>m.id),expected);if(role!=='superadmin')assert(!rows.flatMap(m=>[m,...m.children]).some(m=>/finanzas|usuarios/.test(m.href)));
});
for(const [url,moduleId,childId] of [
 ['/admin','home'],['/admin/pedidos?tray=prepare&page=2','orders'],['/admin/pedidos/abc?returnTo=x','orders'],
 ['/admin/productos','products','product-list'],['/admin/productos?view=stock&variantId=abc','products','stock'],['/admin/productos?view=movements','products','movements'],['/admin/productos/abc/editar','products','product-list'],['/admin/inventario?productId=abc','products','movements'],['/admin/catalogo?tab=weave-types','products','taxonomy'],
 ['/admin/solicitudes/abc','attention','requests'],['/admin/pqr','attention','pqr'],['/admin/contenido?tab=resenas','store','resenas'],['/admin/marketing?tab=newsletter','marketing','newsletter'],['/admin/contenido?tab=popup','marketing','popup'],['/admin/cupones','marketing','coupons'],['/admin/finanzas','finance'],['/admin/usuarios','settings','users'],['/admin/auditoria','settings','audit'],['/admin/alertas','home','alerts'],['/admin/contenido?tab=exports&scope=orders','orders','order-exports'],['/admin/resenas','store','resenas'],['/admin/home-imagenes','store','imagenes']
])test(`N02 selección contextual ${url}`,()=>{const u=new URL(url,'http://local.test'),s=nav.locateNavigation(u.pathname,u.search,'superadmin');assert.equal(s.module?.id,moduleId);assert.equal(s.child?.id,childId);});
test('N03 vendedor mantiene Inicio y Pedidos desde la ruta histórica de Solicitudes',()=>{const modules=nav.getNavigation('vendedor','admin');assert.equal(modules[0].href,'/vendedor');assert.equal(modules[1].href,'/vendedor/pedidos');assert.equal(nav.locateNavigation('/admin/solicitudes','', 'vendedor').module.id,'attention');assert.equal(nav.locateNavigation('/admin/finanzas','', 'vendedor').module,undefined);});
test('N04 pestañas históricas y parámetros conservados sin fuentes alternativas',()=>{for(const tab of ['home','imagenes','resenas','banners','pages','popup','newsletter','carritos','exports','appearance']){const href=nav.contentHref(tab,'page=2&term=ejemplo&scope=orders');const u=new URL(href,'http://local.test');assert.equal(u.searchParams.get('tab'),tab);assert.equal(u.searchParams.get('term'),'ejemplo');assert.equal(u.searchParams.get('page'),'2');}assert.equal(nav.contentTab('inexistente').id,'home');});
test('N05 regreso de Solicitudes solo admite la lista interna y su consulta',()=>{assert.equal(nav.returnToRequests('/admin/solicitudes?page=2&type=wholesale'),'/admin/solicitudes?page=2&type=wholesale');for(const url of ['https://outside.test','//outside.test','/admin/solicitudes-mal','/admin/usuarios',null])assert.equal(nav.returnToRequests(url),'/admin/solicitudes');});
const fixture=require('./helpers/phase2Fixture.cjs');
test('N06 backend conserva permisos de navegación, exportación y escritura',async()=>{
 await fixture.setup();
 try {
  const ctx=fixture.context, api=fixture.api;
  for(const url of ['/api/admin/finance/overview','/api/admin/users','/api/admin/pqr','/api/admin/audit','/api/admin/settings','/api/admin/marketing/newsletter/export','/api/admin/marketing/orders/export','/api/admin/marketing/abandoned-carts/export']){
   const response=await api('GET',url,{cookie:ctx.vendorCookie});assert.equal(response.status,403,url);
  }
  for(const url of ['/api/admin/users','/api/admin/finance/overview'])assert.equal((await api('GET',url,{cookie:ctx.adminCookie})).status,403,url);
  for(const url of ['/api/admin/finance/overview','/api/admin/users','/api/admin/pqr','/api/admin/audit','/api/admin/settings','/api/admin/marketing/newsletter/export','/api/admin/marketing/orders/export','/api/admin/marketing/abandoned-carts/export'])assert.equal((await api('GET',url,{cookie:ctx.superCookie})).status,200,url);
  assert.equal((await api('GET','/api/admin/special-requests',{cookie:ctx.vendorCookie})).status,200);
  assert.equal((await api('GET','/api/admin/pqr')).status,401);
  const {product,variantId}=await fixture.makeProduct(9);const before=await ctx.Product.findById(product._id).lean();
  assert.equal((await api('PATCH',`/api/admin/catalog/products/${product._id}`,{cookie:ctx.vendorCookie,body:{salePrice:1}})).status,403);
  assert.equal((await api('POST',`/api/admin/catalog/products/${product._id}/stock`,{cookie:ctx.vendorCookie,body:{variantId:String(variantId),delta:1}})).status,403);
  assert.deepEqual(await ctx.Product.findById(product._id).lean(),before);
  assert.equal(process.env.MARKETING_CART_REMINDERS_ENABLED,'false');assert.deepEqual(ctx.blocked,[]);
 } finally {await fixture.close();}
});
