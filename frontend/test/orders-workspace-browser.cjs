"use strict";
// Actual React components + AdminShell, isolated router adapter and HTTP fixture.
// No Next dev server, .env, MongoDB, Wompi, email or external requests.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/fase3-evidencias");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const { operationalActions } = require(path.join(root, "backend/src/services/orderWorkspace"));
const tempRoot = fs.realpathSync(os.tmpdir()), stage = fs.mkdtempSync(path.join(tempRoot, "dizor-phase3-ui-"));
const result = { checks: [], externalRequests: [], pageErrors: [], mutations: [] };
let browser, server;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
 try {
  const loader = path.join(stage,"jsx.cjs"), cssLoader = path.join(stage,"css.cjs"), api = path.join(stage,"api.js"), navigation = path.join(stage,"navigation.js"), link = path.join(stage,"link.jsx"), auth = path.join(stage,"auth.js"), site = path.join(stage,"site.js"), entry = path.join(stage,"entry.jsx");
  fs.writeFileSync(loader, `const swc=require(${JSON.stringify(path.join(frontend,"node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  // CSS modules preserve class names so screenshots use the exact source CSS.
  fs.writeFileSync(cssLoader, `module.exports=function(source){const names=[...source.matchAll(/\\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(m=>m[1]);return 'module.exports='+JSON.stringify(Object.fromEntries(names.map(n=>[n,(this.resourcePath.includes('OrderCommunications')?'oc_':'ow_')+n])));};`);
  fs.writeFileSync(navigation, `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));export const navigate=(url)=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:navigate});`);
  fs.writeFileSync(link, `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
  fs.writeFileSync(auth, `export const useAuth=()=>({user:{name:'Operador ficticio',role:location.pathname.startsWith('/vendedor')?'vendedor':'admin'},logout:async()=>{}});`);
  fs.writeFileSync(site, `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  fs.writeFileSync(api, `async function request(url,data,method='GET'){const r=await fetch('/mock'+url+(url.includes('?')?'&':'?')+'role='+(location.pathname.startsWith('/vendedor')?'vendedor':'admin'),{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}export const getAdminOrders=(p)=>request('/orders?'+new URLSearchParams(p));export const getAdminOrder=(id)=>request('/orders/'+id);export const getAdminDashboard=()=>request('/dashboard');export const getOrderStats=()=>request('/stats');export const getAlerts=()=>request('/alerts');export const updateOrderStatus=(id,b)=>request('/orders/'+id+'/status',b,'PATCH');export const updateOrderShipping=(id,b)=>request('/orders/'+id+'/shipping',b,'PATCH');export const confirmPayment=(id,b)=>request('/orders/'+id+'/payment',b,'PATCH');export const reconcileWompi=(id)=>request('/orders/'+id+'/reconcile',{},'POST');export const getOrderCommunications=(id)=>request('/orders/'+id+'/communications');export const retryOrderCommunication=(id,n)=>request('/orders/'+id+'/communications/'+n+'/retry',{},'POST');export const resendOrderCommunication=(id,n,b)=>request('/orders/'+id+'/communications/'+n+'/resend',b,'POST');export const exportOrdersPdf=async()=>{};`);
  fs.writeFileSync(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from './navigation';import Shell from ${JSON.stringify(path.join(frontend,"src/components/admin/AdminShell.jsx"))};import Dashboard from ${JSON.stringify(path.join(frontend,"src/components/admin/AdminDashboard.jsx"))};import Orders from ${JSON.stringify(path.join(frontend,"src/components/admin/OrdersList.jsx"))};import Detail from ${JSON.stringify(path.join(frontend,"src/components/admin/OrderDetail.jsx"))};function App(){const p=usePathname(),vendor=p.startsWith('/vendedor'),base=vendor?'/vendedor/pedidos':'/admin/pedidos',id=p.startsWith(base+'/')?p.slice(base.length+1):null;return <Shell variant={vendor?'vendedor':'admin'}>{id?<Detail orderId={id} backHref={base}/>:p===base?<div className="admin-page"><h1>Pedidos</h1><Orders basePath={base}/></div>:<Dashboard vendor={vendor}/>}</Shell>}createRoot(document.getElementById('app')).render(<App/>);`);
  const compiler = webpack({mode:"production",optimization:{minimize:false},context:frontend,entry,output:{path:stage,filename:"bundle.js"},
    resolve:{extensions:[".js",".jsx",".json"],modules:[path.join(frontend,"node_modules"),"node_modules"],alias:{"next/link":link,"next/navigation":navigation,"@/services/orderAdminService":api,"@/services/adminDashboardService":api,"@/services/adminAlertService":api,"@/context/AuthContext":auth,"@/context/SiteConfigContext":site,"@":path.join(frontend,"src")}},
    module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:loader},{test:/\.css$/,use:cssLoader}]}});
  await new Promise((resolve,reject)=>compiler.run((err,stats)=>{compiler.close(()=>{});err||stats.hasErrors()?reject(err||new Error(stats.toString({all:false,errors:true}))):resolve();}));
  const bundle=fs.readFileSync(path.join(stage,"bundle.js"));
  const sheets=["styles/base/variables.css","styles/base/globals.css","styles/layouts/admin-layout.css","styles/pages/admin-products.css","styles/pages/admin-orders.css","styles/pages/admin-dashboard.css","styles/pages/admin-alertas.css","components/admin/OrderWorkspace.module.css","components/admin/OrderCommunications.module.css"];
  const css=sheets.map(file=>fs.readFileSync(path.join(frontend,"src",file),"utf8").replace(/\.([A-Za-z_][A-Za-z0-9_-]*)/g,(match,name)=>file.endsWith(".module.css")?"."+(file.includes("OrderCommunications")?"oc_":"ow_")+name:match)).join("\n");
  const make=(id,state="pendiente",method="contra_entrega",payment="pendiente")=>({_id:id,id,orderNumber:`DIZ-PRUEBA-${id.toUpperCase()}`,buyer:{name:"Cliente de prueba "+id,email:"comprador@example.test",phone:"3001234567"},total:80000,subtotal:80000,paymentMethod:method,paymentStatus:payment,orderStatus:state,stockDeducted:method==="contra_entrega"||payment==="pagado",checkoutState:"ready",requiresReview:false,incidents:[],createdAt:"2026-11-20T14:00:00Z",shippingIncluded:true,carrier:state==="enviado"?"servientrega":"",trackingNumber:state==="enviado"?"FICTICIA-501":"",shippingAddress:{address:"Calle ficticia 10",city:"Pasto",department:"Nariño"},items:[{_id:"item",productName:"Sombrero tejido en iraca",quantity:1,unitPrice:80000,lineTotal:80000,sizeName:"M",colorName:"Natural",sku:"IRACA-M"}],statusHistory:[],wompi:{}});
  const records=[...Array.from({length:18},(_,i)=>make("nuevo"+i)),make("preparacion","en_preparacion"),make("camino","enviado"),make("recaudo","entregado"),make("wompi","pago_pendiente","wompi"),make("revision","en_preparacion"),make("cerrado","cancelado")];
  records.find(o=>o.id==="revision").requiresReview=true;records.find(o=>o.id==="revision").incidents=[{code:"approved_without_stock",detail:"Pago con revisión de inventario"}];
  const dto=(o,role)=>({...o,operation:operationalActions(o,role)});
  const inTray=(o,t)=>t==="all"||!t||t==="prepare"&&o.orderStatus==="pendiente"&&!o.requiresReview||t==="dispatch"&&o.orderStatus==="en_preparacion"&&!o.requiresReview||t==="transit"&&o.orderStatus==="enviado"||t==="collection"&&o.orderStatus==="entregado"&&o.paymentStatus==="pendiente"||t==="review"&&o.requiresReview;
  const count=(rows,role)=>Object.fromEntries(["prepare","dispatch","transit","collection","review","all",...(role==="admin"?["communications"]:[])].map(t=>[t,rows.filter(o=>inTray(o,t)).length]));
  let failNextList=false,failNextDetail=false,failNextAction=false,slowList=false,failNextDashboard=false,loseAfterApply=false;
  server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,"http://localhost");
    if(url.pathname==="/bundle.js"){res.setHeader("Content-Type","application/javascript");return res.end(bundle);}
    if(url.pathname.startsWith("/mock")){
      res.setHeader("Content-Type","application/json");const role=url.searchParams.get("role");
      const send=(body,status=200)=>{res.statusCode=status;res.end(JSON.stringify(body));};
      if(url.pathname==="/mock/alerts")return send({alerts:{},totalCount:0});
      if(url.pathname==="/mock/dashboard" && failNextDashboard){failNextDashboard=false;return send({message:"Fallo de prueba"},503);}
      if(url.pathname==="/mock/dashboard")return send({dashboard:{attention:count(records,role),orders:{ordersToday:records.length,revenueMonth:80000,shippedToday:1},deliveredToday:1,operationalOrders:records.slice(0,5).map(o=>dto(o,role))}});
      if(url.pathname==="/mock/stats")return send({counts:count(records,role)});
      if(url.pathname==="/mock/orders"){
        if(slowList)await delay(500);
        if(failNextList){failNextList=false;return send({message:"Fallo de prueba"},503);}
        const q=(url.searchParams.get("q")||"").toLowerCase();const method=url.searchParams.get("paymentMethod");
        const base=records.filter(o=>(!q||`${o.orderNumber} ${o.buyer.name}`.toLowerCase().includes(q))&&(!method||method===o.paymentMethod));
        const rows=base.filter(o=>inTray(o,url.searchParams.get("tray")));const page=Number(url.searchParams.get("page"))||1,limit=Number(url.searchParams.get("limit"))||15;
        return send({total:rows.length,page,totalPages:Math.max(1,Math.ceil(rows.length/limit)),counts:count(base,role),orders:rows.slice((page-1)*limit,page*limit).map(o=>dto(o,role))});
      }
      const parts=url.pathname.split('/');const order=records.find(o=>o.id===parts[3]);
      if(!order)return send({message:"No encontrado"},404);
      if(req.method==="GET"){
        if(parts[4]==="communications")return send({deliveryEnabled:false,page:1,pages:1,notifications:[{id:"n-"+order.id,event:"Recepción del pedido",recipient:"c***@e***.test",status:"sent",attempts:1,acceptedAt:"2026-11-20T14:00:00Z"}]});
        if(failNextDetail){failNextDetail=false;return send({message:"Fallo de prueba"},503);}
        return send({order:dto(order,role)});
      }
      let body="";for await(const chunk of req)body+=chunk;const data=JSON.parse(body||'{}');
      result.mutations.push({id:order.id,action:parts[4],body:data});await delay(250);
      if(failNextAction){failNextAction=false;return send({message:"No se pudo completar la operación ficticia"},409);}
      if(parts[4]==="status")order.orderStatus=data.orderStatus;
      if(parts[4]==="shipping"){order.carrier=data.carrier;order.trackingNumber=data.trackingNumber;order.orderStatus="enviado";}
      if(parts[4]==="payment"){order.paymentStatus="pagado";order.collection=data;}
      if(loseAfterApply){loseAfterApply=false;return send({message:"Respuesta perdida después de registrar"},503);}
      return send({status:"success"});
    }
    res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR · prueba aislada</title><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await puppeteer.launch({headless:true,executablePath:process.env.DIZOR_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",userDataDir:path.join(stage,"profile"),args:["--disable-background-networking","--disable-component-update","--disable-sync","--no-first-run","--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"]});
  const page=await browser.newPage();page.on("pageerror",e=>result.pageErrors.push(e.stack || e.message));
  await page.evaluateOnNewDocument(()=>{window.__opened=0;window.open=()=>{window.__opened++;return null;};});
  await page.setRequestInterception(true);page.on("request",r=>{if(r.url().startsWith(origin)||r.url().startsWith("data:"))r.continue();else{result.externalRequests.push(r.url());r.abort();}});
  const text=async(s)=>{try { await page.waitForFunction(s=>document.body.innerText.toLowerCase().includes(s.toLowerCase()),{},s); }
    catch(error){result.failure={waiting:s,url:page.url(),body:await page.$eval('body',e=>e.innerText)};await page.screenshot({path:path.join(out,'fallo-navegador.png'),fullPage:true});throw error;}};
  const button=async(label)=>(await page.evaluateHandle(s=>[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===s),label)).asElement();
  const click=async(label)=>{const b=await button(label);assert.ok(b,`button ${label}`);await b.click();};
  const goto=async(p,wait)=>{await page.goto(origin+p);if(wait)await text(wait);};
  const noOverflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  await page.setViewport({width:1440,height:1000});await goto("/admin","Listos para preparar");
  assert.equal(await page.$eval('a[href="/admin/pedidos?tray=prepare"] strong',e=>e.textContent),"18");
  await page.screenshot({path:path.join(out,"dashboard-escritorio.png"),fullPage:true});result.checks.push("B01 dashboard real, cinco tareas y enlace con bandeja");
  await page.click('a[href="/admin/pedidos?tray=prepare"]');await text("DIZ-PRUEBA-NUEVO0");assert.ok(page.url().includes("tray=prepare"));
  await page.type('input[name="q"]',"Cliente de prueba nuevo1");await click("Aplicar filtros");await page.waitForFunction(()=>location.search.includes("q=Cliente"));await text("DIZ-PRUEBA-NUEVO1");
  assert.equal(await page.$eval('input[name="q"]',e=>e.value),"Cliente de prueba nuevo1");result.checks.push("B02 filtros aplicados y conservados en URL");
  const context="/admin/pedidos?tray=all&limit=2&paymentMethod=contra_entrega&page=2";
  await goto(context,"Página 2 de");await page.screenshot({path:path.join(out,"pedidos-escritorio.png"),fullPage:true});
  await page.click('table tbody tr a');await text("Siguiente acción");await page.click('a[href="'+context.replaceAll('&','&')+'"]');await text("Página 2 de");
  assert.equal(new URL(page.url()).search,"?tray=all&limit=2&paymentMethod=contra_entrega&page=2");result.checks.push("B03 paginación y regreso exacto desde detalle");
  await goto("/admin/pedidos/nuevo0","Comenzar preparación");await page.screenshot({path:path.join(out,"detalle-escritorio.png"),fullPage:true});
  await page.click('section[aria-labelledby="next-action-title"] summary');await page.type('textarea[name="operationNote"]','Nota ficticia de preparación');
  const before=result.mutations.length;await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Comenzar preparación');b.click();b.click();});
  await text("Procesando operación");await text("Registrar envío y despachar");assert.equal(result.mutations.length,before+1);assert.equal(result.mutations.at(-1).body.note,'Nota ficticia de preparación');assert.equal(await page.evaluate(()=>window.__opened),0);result.checks.push("B04 doble clic: una petición, nota interna, procesamiento y siguiente acción");
  await page.select('select[name="carrier"]',"servientrega");await page.type('input[name="trackingNumber"]',"GUIA-UX-100");await click("Registrar envío y despachar");await page.waitForSelector("fieldset button");
  assert.ok(await page.$eval('fieldset button',e=>document.activeElement===e));await page.keyboard.press("Enter");await text("Registrar entrega");
  assert.equal(result.mutations.at(-1).action,"shipping");assert.equal(records[0].trackingNumber,"GUIA-UX-100");assert.equal(records[0].paymentStatus,"pendiente");result.checks.push("B05 guía y despacho juntos, confirmación y teclado");
  await click("Registrar entrega");await click("Confirmar entrega");await text("Registrar recaudo");assert.equal(records[0].paymentStatus,"pendiente");result.checks.push("B06 entrega separada del recaudo");
  await page.type('input[name="reference"]',"GIRO-UX-100");await page.$eval('input[name="receivedAt"]',e=>{e.value='2026-11-19T12:30';});await click("Registrar recaudo");await click("Confirmar recaudo");await text("Recaudo verificado en el registro");
  assert.equal(result.mutations.at(-1).body.receivedAt,"2026-11-19T17:30:00.000Z");assert.equal(records[0].orderStatus,"entregado");assert.equal(await page.evaluate(()=>window.__opened),0);result.checks.push("B07 recaudo confirmado usa hora Colombia; WhatsApp nunca automático");
  await text("Aceptado por el proveedor");assert.ok(await page.$eval('a[href^="https://wa.me/"]',e=>e.textContent.includes("Abrir conversación")));result.checks.push("B08 comunicaciones conservadas y WhatsApp voluntario");
  await goto("/vendedor/pedidos/recaudo","Pendiente de recaudo");assert.equal(await button("Registrar recaudo"),null);assert.equal(await button("Consultar y conciliar con Wompi"),null);assert.equal(await button("Cancelar pedido"),null);result.checks.push("B09 vendedor sin acciones financieras ni cancelación");
  await goto("/admin/pedidos/revision","Requiere revisión");assert.equal(await button("Registrar envío y despachar"),null);assert.equal(await button("Comenzar preparación"),null);result.checks.push("B10 incidencia bloquea acciones de preparación y despacho");
  failNextAction=true;await goto("/admin/pedidos/nuevo2","Comenzar preparación");await click("Comenzar preparación");await text("No se pudo completar la operación ficticia");await click("Comenzar preparación");await text("Registrar envío y despachar");result.checks.push("B11 error de operación y reintento explícito");
  failNextList=true;slowList=true;await goto("/admin/pedidos?tray=all","Cargando pedidos");await text("No se pudieron cargar los pedidos");assert.equal(await page.evaluate(()=>document.body.innerText.includes("Todavía no hay pedidos")),false);slowList=false;await click("Reintentar carga");await text("DIZ-PRUEBA-NUEVO0");result.checks.push("B12 carga, error API y recuperación sin falso vacío");
  await goto("/admin/pedidos?q=nadie-ficticio","No hay coincidencias");await goto("/admin/pedidos?tray=communications","No hay pedidos pendientes");result.checks.push("B13 vacío real y filtros sin coincidencias");
  failNextDetail=true;await goto("/admin/pedidos/nuevo3","No se pudo cargar el pedido");await click("Reintentar carga");await text("Comenzar preparación");result.checks.push("B14 error del detalle se distingue de inexistencia");
  await page.keyboard.press("Tab");assert.ok(await page.evaluate(()=>!!document.activeElement));
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(e=>!e.closest('label')&&!e.labels?.length).length),0);result.checks.push("B15 campos etiquetados y foco de teclado");
  for(const [width,height,name] of [[820,1180,"tablet"],[390,844,"movil"],[360,800,"movil-360"]]){
    await page.setViewport({width,height});await goto("/admin","Listos para preparar");assert.ok(await noOverflow(),`dashboard ${width}`);await page.screenshot({path:path.join(out,`dashboard-${name}.png`),fullPage:true});
    await goto("/admin/pedidos?tray=all","DIZ-PRUEBA-NUEVO0");assert.ok(await noOverflow(),`list ${width}`);assert.ok(await page.$eval("caption",e=>e.getBoundingClientRect().height<60),"caption legible");await page.screenshot({path:path.join(out,`pedidos-${name}.png`),fullPage:true});
    await goto("/admin/pedidos/nuevo3","Comenzar preparación");await text("Aceptado por el proveedor");assert.ok(await noOverflow(),`detail ${width}`);await page.screenshot({path:path.join(out,`detalle-${name}.png`),fullPage:true});
  }
  result.checks.push("B16 escritorio, tablet, 390 y 360 px sin desbordamiento");
  failNextDashboard=true;await goto("/admin","No se pudo cargar la operación");assert.equal(await page.$('a[href="/admin/pedidos?tray=prepare"]'),null);await click("Reintentar carga");await text("Listos para preparar");result.checks.push("B17 error de dashboard no muestra cero pendientes");
  await goto("/vendedor","Panel vendedor");assert.ok(await page.$('a[href="/vendedor/pedidos?tray=prepare"]'));assert.equal(await page.$('a[href="/vendedor/pedidos?tray=communications"]'),null);result.checks.push("B18 dashboard vendedor conserva bandejas y solicitudes");
  await goto("/admin/pedidos/wompi","Esperando confirmación del pago");assert.equal(await button("Comenzar preparación"),null);result.checks.push("B19 Wompi pendiente no ofrece preparación");
  loseAfterApply=true;await goto("/admin/pedidos/nuevo5","Comenzar preparación");const previous=result.mutations.length;await click("Comenzar preparación");await text("Respuesta perdida después de registrar");assert.ok(await (await button("Comenzar preparación")).evaluate(e=>e.disabled));await click("Actualizar pedido");await text("Registrar envío y despachar");assert.equal(result.mutations.length,previous+1);result.checks.push("B20 respuesta ambigua exige consultar sin repetir operación");
  assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.externalRequests,[]);result.passed=true;
 } finally {
  fs.writeFileSync(path.join(out,"navegador.json"),JSON.stringify(result,null,2)+"\n");
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  const target=fs.realpathSync(stage);if(path.dirname(target)!==tempRoot||!path.basename(target).startsWith("dizor-phase3-ui-"))throw new Error("Unexpected cleanup target");
  fs.rmSync(target,{recursive:true,force:true});
 }
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
})().catch(error=>{process.stderr.write(error.stack+"\n");process.exitCode=1;});
