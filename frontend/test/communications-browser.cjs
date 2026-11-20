"use strict";
// Isolated real React + browser check; no running app, .env, or external API.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/fase2-evidencias");
const toolsDir = process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core";
const puppeteer = require(toolsDir);
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const tempRoot = fs.realpathSync(os.tmpdir()), stage = fs.mkdtempSync(path.join(tempRoot, "dizor-phase2-ui-"));
const css = fs.readFileSync(path.join(frontend, "src/components/admin/OrderCommunications.module.css"), "utf8");
let browser, server;
const result = { checks: [], externalRequests: [], pageErrors: [] };
(async () => {
 try {
  const loader = path.join(stage, "jsx.cjs"), cssLoader = path.join(stage, "css.cjs"), api = path.join(stage, "api.js"), entry = path.join(stage, "entry.js");
  fs.writeFileSync(loader, `const swc=require(${JSON.stringify(path.join(frontend,"node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  fs.writeFileSync(cssLoader, 'module.exports=function(){return \'module.exports={panel:"panel",hint:"hint",item:"item",actions:"actions",confirm:"confirm"};\';};');
  fs.writeFileSync(api, `async function request(url, data){const r=await fetch(url,data?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}:{});const body=await r.json();if(!r.ok){const e=new Error("simulated");e.response={status:r.status,data:body};throw e;}return body;}export const getOrderCommunications=(id)=>request('/api/'+id);export const retryOrderCommunication=(id,n)=>request('/api/'+id+'/'+n+'/retry',{});export const resendOrderCommunication=(id,n,data)=>request('/api/'+id+'/'+n+'/resend',data);`);
  fs.writeFileSync(entry, `const React=require('react');const {createRoot}=require('react-dom/client');const C=require(${JSON.stringify(path.join(frontend,"src/components/admin/OrderCommunications.jsx"))}).default;createRoot(document.getElementById('app')).render(React.createElement(C,{orderId:new URLSearchParams(location.search).get('role')||'admin'}));`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" },
    resolve: { modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "@/services/orderAdminService": api } },
    module: { rules: [{ test: /\.jsx$/, use: loader }, { test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); if(err || stats.hasErrors()) reject(err || new Error(stats.toString({all:false,errors:true}))); else resolve(); }));
  const bundle = fs.readFileSync(path.join(stage,"bundle.js"));
  const notifications = [
    {id:"accepted",event:"Acuse de recepción",status:"sent",recipient:"c***@e***.test",createdAt:new Date().toISOString(),acceptedAt:new Date().toISOString(),attempts:1,canResend:true},
    {id:"failed",event:"Datos del despacho",status:"failed",recipient:"c***@e***.test",attempts:2,error:"Fallo temporal del proveedor",retryable:true,canResend:true},
    {id:"pending",event:"Confirmación de pago",status:"pending",recipient:"c***@e***.test",attempts:0},
    {id:"skipped",event:"Aviso administrativo",status:"skipped",recipient:"Sin destinatario válido",attempts:0,error:"Servicio de correo no configurado",canResend:true},
  ];
  const resendKeys = [], copies = new Map(); let retryCalls = 0, failNextGet = false, loseNextResend = false;
  server = http.createServer(async (req,res) => {
    if(req.url === '/bundle.js'){res.setHeader('Content-Type','application/javascript');return res.end(bundle);}
    if(req.url.startsWith('/api/')) {
      res.setHeader('Content-Type','application/json');
      if(req.method === 'GET') {
        if(failNextGet){failNextGet=false;res.statusCode=503;return res.end(JSON.stringify({message:'Fallo simulado'}));}
        const vendor=req.url.startsWith('/api/vendor');const replaced=new Set([...copies.values()].map(n=>n.parentId));
        return res.end(JSON.stringify({deliveryEnabled:false,notifications:[...notifications,...copies.values()].map(n=>({...n,superseded:replaced.has(n.id),retryable:vendor||replaced.has(n.id)?false:n.retryable,canResend:vendor||replaced.has(n.id)?false:n.canResend})),page:1,pages:1}));
      }
      let raw='';for await(const data of req)raw+=data;const body=JSON.parse(raw||'{}');
      if(req.url.endsWith('/retry')){retryCalls++;await new Promise(r=>setTimeout(r,250));res.statusCode=202;return res.end('{}');}
      resendKeys.push(body.requestKey);
      if(!copies.has(body.requestKey))copies.set(body.requestKey,{parentId:req.url.split('/')[3],id:body.requestKey,event:'Acuse de recepción',status:'pending',recipient:'c***@e***.test',attempts:0,resend:true});
      await new Promise(r=>setTimeout(r,250));
      if(loseNextResend){loseNextResend=false;res.statusCode=503;return res.end('{}');}
      res.statusCode=202;return res.end(JSON.stringify({id:body.requestKey}));
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--color-text-muted:#5c5c5c;--color-border:#e6e6e6;--color-accent-text:#8a5503}body{margin:0;background:#f7f7f7;color:#1a1a1a;font:15px Verdana,sans-serif}.order-detail-card{background:white;border:1px solid #e6e6e6;padding:20px}#app{max-width:600px;margin:16px auto;padding:12px}.admin-btn{padding:10px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer}.admin-btn--primary{background:#1a1a1a;color:white}input{padding:10px;font:inherit}button:disabled{opacity:.55;cursor:wait}h2{font-family:Georgia,serif}${css}</style><div id="app"></div><script src="/bundle.js"></script></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await puppeteer.launch({headless:true,executablePath:process.env.DIZOR_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',userDataDir:path.join(stage,'profile'),args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
  const page=await browser.newPage();
  page.on('pageerror',e=>result.pageErrors.push(e.message));await page.setRequestInterception(true);
  page.on('request',request=>{const u=request.url();if(u.startsWith(origin)||u.startsWith('data:'))request.continue();else{result.externalRequests.push(u);request.abort();}});
  const waitText=(value)=>page.waitForFunction(s=>document.body.innerText.includes(s),{},value);
  const button=async(text)=> (await page.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(t)),text)).asElement();
  await page.setViewport({width:1024,height:900});await page.goto(origin);await waitText('Aceptado por el proveedor');
  assert.ok(await page.$eval('[aria-labelledby="order-communications-title"]',e=>e.textContent.includes('No confirma entrega al buzón')));
  await page.screenshot({path:path.join(out,'comunicaciones-escritorio.png'),fullPage:true});result.checks.push('desktop and accurate statuses');
  const open=await button('Solicitar reenvío');await open.focus();await page.keyboard.press('Enter');await page.waitForSelector('fieldset input');
  assert.ok(await page.$eval('fieldset input',e=>e===document.activeElement));await page.keyboard.type('Comprador solicita una copia');await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>document.activeElement.textContent.includes('Confirmar reenvío')));
  await page.keyboard.press('Enter');await page.evaluate(()=>[...document.querySelectorAll('fieldset button')].find(b=>b.textContent.includes('Confirmar')).click());
  await page.waitForFunction(()=>[...document.querySelectorAll('fieldset button')].every(b=>b.disabled));
  await waitText('Reenvío registrado.');await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.disabled));assert.equal(resendKeys.length,1);result.checks.push('keyboard focus, confirmation, double click, processing, success');
  await page.setViewport({width:360,height:800});await page.screenshot({path:path.join(out,'comunicaciones-movil.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));result.checks.push('360px without horizontal overflow');
  await (await button('Reintentar pendiente')).click();await waitText('Reintento registrado');await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.disabled));assert.equal(retryCalls,1);result.checks.push('pending recovery');
  const requestAgain=(await page.evaluateHandle(()=>[...document.querySelectorAll('article')].find(a=>a.textContent.includes('Aviso administrativo')).querySelector('button'))).asElement();await requestAgain.click();await page.waitForSelector('fieldset input');await page.type('fieldset input','Reintento de respuesta perdida');loseNextResend=true;
  await (await button('Confirmar reenvío')).click();await waitText('No se pudo confirmar');
  assert.ok(await page.$eval('fieldset input',e=>e.disabled));await (await button('Confirmar reenvío')).click();await waitText('Reenvío registrado.');
  assert.equal(resendKeys.at(-1),resendKeys.at(-2));assert.equal(copies.size,2);result.checks.push('ambiguous retry keeps request key and payload');
  await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.disabled));
  failNextGet=true;await page.goto(origin);await waitText('No se pudo cargar');await (await button('Actualizar historial')).click();await waitText('Aceptado por el proveedor');result.checks.push('load failure and recovery');
  await page.goto(origin+'/?role=vendor');await waitText('Aceptado por el proveedor');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/Solicitar reenvío|Reintentar pendiente/.test(b.textContent)).length),0);result.checks.push('vendor read only');
  const {buildMessage,snapshotOrder}=require(path.join(root,'backend/src/services/notificationTemplates'));
  const snapshot=snapshotOrder({orderNumber:'DIZ-PRUEBA-1001',buyer:{name:'Cliente ficticio'},paymentMethod:'contra_entrega',paymentStatus:'pendiente',total:80000,subtotal:80000,shippingIncluded:true,shippingAddress:{address:'Calle Ficticia 1',city:'Pasto',department:'Nariño'},carrier:'servientrega',trackingNumber:'TEST-501',items:[{productName:'Sombrero tejido en iraca',quantity:1,lineTotal:80000}]});
  for(const [event,width,name] of [['order.received',1024,'correo-recepcion-escritorio.png'],['order.shipped',360,'correo-despacho-movil.png']]) {
    const m=buildMessage(event,snapshot);fs.writeFileSync(path.join(out,name.replace('.png','.html')),m.html);fs.writeFileSync(path.join(out,name.replace('.png','.txt')),m.text);
    await page.setViewport({width,height:900});await page.setContent(m.html);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,name),fullPage:true});
  }
  result.checks.push('desktop and mobile email previews');assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.externalRequests,[]);result.passed=true;
 } finally {
  fs.writeFileSync(path.join(out,'navegador.json'),JSON.stringify(result,null,2));
  if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
  const target=fs.realpathSync(stage);if(path.dirname(target)!==tempRoot||!path.basename(target).startsWith('dizor-phase2-ui-'))throw new Error('Unexpected cleanup target');
  fs.rmSync(target,{recursive:true,force:true});
 }
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
})().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1;});
