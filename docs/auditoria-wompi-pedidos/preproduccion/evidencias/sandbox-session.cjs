// Prueba real autorizada de Sandbox. Nunca carga server.js ni conecta el MONGO_URI del proyecto.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),backend=path.join(root,'backend'),nativeFetch=globalThis.fetch;
if(!process.argv.includes('--authorized-sandbox'))throw Error('Requiere autorización explícita de Sandbox');
const config=require(path.join(backend,'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend,'.env')));
if(config.WOMPI_ENV!=='sandbox'||!config.WOMPI_PRIVATE_KEY?.startsWith('prv_test_')||!config.WOMPI_EVENTS_SECRET?.startsWith('test_events_'))throw Error('Solo se admiten llaves Sandbox');
const token=v=>typeof v==='string'&&v?'sha256:'+crypto.createHash('sha256').update(v).digest('hex').slice(0,16):v??null;
const result={startedAt:new Date().toISOString(),environment:'sandbox',authorization:'Usuario aprobó las llamadas y transacciones Sandbox en este chat',database:'Replica set efímero loopback; .env MONGO_URI no utilizado',webhook:{publicHttpsConfigured:false,authenticReceived:0},requests:[]};
const write=()=>safeWrite();
let fixture,callback,ready=false,closing=false,timeout;
async function close(){if(closing)return;closing=true;clearTimeout(timeout);if(callback)await new Promise(r=>callback.close(r));if(ready)await fixture.close();result.finishedAt=new Date().toISOString();write();}
const capture=async id=>{
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(id))throw Error('ID inválido');
  const tx=await require(path.join(backend,'src/services/wompiService')).getTransaction(id);
  const details={queriedAt:new Date().toISOString(),transactionId:token(tx.id),paymentLinkId:token(tx.payment_link_id),paymentLinkFieldPresent:Object.hasOwn(tx,'payment_link_id'),reference:token(tx.reference),amountInCents:tx.amount_in_cents,currency:tx.currency,status:tx.status,environment:'sandbox',matchesCreatedLink:tx.payment_link_id===result.runtimeLinkId};
  const response=await fixture.api('POST',`/api/admin/orders/${result.runtimeOrderId}/reconcile-wompi`,{cookie:fixture.cookies.admin,body:{transactionId:id}});
  const order=await fixture.fresh(result.runtimeOrderId);details.dizor={http:response.status,paymentStatus:order.paymentStatus,requiresReview:order.requiresReview,stockDeducted:order.stockDeducted};
  result.transaction=details;result.E01=details.matchesCreatedLink?'PARCIAL_GET_VERIFICADO_FALTA_WEBHOOK_AUTENTICO':'FALLO_CONTRATO_GET_NO_APORTA_VINCULO';write();return details;
};
// Los dos IDs sin redactar permanecen solo en memoria; write omite esas propiedades.
const serialize=JSON.stringify;function safeWrite(){const{runtimeLinkId,runtimeOrderId,...safe}=result;fs.writeFileSync(path.join(__dirname,'sandbox-real.json'),serialize(safe,null,2));}
(async()=>{try{
  const original=path.join(root,'docs/auditoria-wompi-pedidos/evidencias/auditoria-wompi.cjs'),mod=new Module(original,module);mod.filename=original;mod.paths=Module._nodeModulePaths(path.dirname(original));
  mod._compile(fs.readFileSync(original,'utf8').split('main().catch(')[0]+`\nmodule.exports={setup,api,newWompi,fresh,stockOf,get cookies(){return cookies;},get M(){return M;},async close(){if(server)await new Promise(r=>server.close(r));await mongoose.disconnect();if(mongod)await mongod.stop();}};`,original);fixture=mod.exports;await fixture.setup();ready=true;
  globalThis.fetch=async(input,init={})=>{const u=new URL(typeof input==='string'?input:input.url);if(['127.0.0.1','localhost'].includes(u.hostname))return nativeFetch(input,init);
    if(u.origin!=='https://sandbox.wompi.co'||!/^\/v1\/(payment_links|transactions)(\/|$)/.test(u.pathname))throw Error('Red externa fuera de Sandbox bloqueada');
    result.requests.push({method:init.method||'GET',resource:u.pathname.startsWith('/v1/payment_links')?'payment_links':'transactions',at:new Date().toISOString()});
    const response = await nativeFetch(input,{...init,redirect:'error'});
    const check = result.requests[result.requests.length - 1]; check.http = response.status;
    if (!response.ok) { try { const detail = await response.clone().json(); check.errorType = detail.error?.type || null; check.validationFields = detail.error?.messages ? Object.keys(detail.error.messages) : []; } catch {} }
    return response;
  };
  callback=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/safe/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ready:true,checkout:result.checkout,environment:'sandbox',webhookPublicHttps:false}));}
    if(req.method==='GET'&&url.pathname==='/pedido/confirmacion'){
      result.redirect={receivedAt:new Date().toISOString(),origin:'loopback_temporal',path:url.pathname,queryNames:[...new Set(url.searchParams.keys())],transactionId:token(url.searchParams.get('id')),note:'Los parámetros no son prueba del pago'};safeWrite();res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<h1>Retorno Sandbox capturado</h1><p>La URL no confirma el pago. Falta verificar evidencia autenticada.</p>');
    }
    if(req.method==='POST'&&url.pathname==='/safe/observe'){let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error('Petición demasiado grande');}const data=await capture(JSON.parse(body).transactionId);safeWrite();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(data));}
    if(req.method==='POST'&&url.pathname==='/safe/stop'){res.end('Deteniendo sesión temporal');setImmediate(()=>close());return;}
    res.writeHead(404);res.end();
  }catch{res.writeHead(503);res.end('Verificación no completada; revisar evidencia redactada');}});
  await new Promise(r=>callback.listen(0,'127.0.0.1',r));const callbackOrigin=`http://localhost:${callback.address().port}`;
  Object.assign(process.env,{WOMPI_ENV:'sandbox',WOMPI_PRIVATE_KEY:config.WOMPI_PRIVATE_KEY,WOMPI_EVENTS_SECRET:config.WOMPI_EVENTS_SECRET,CLIENT_URL:callbackOrigin});
  const {order}=await fixture.newWompi();result.runtimeOrderId=String(order._id);result.runtimeLinkId=order.wompi.paymentLinkId;
  const service=require(path.join(backend,'src/services/wompiService')),link=await service.getPaymentLink(order.wompi.paymentLinkId);
  if(!link.merchant_public_key?.startsWith('pub_test_')||!order.wompi.paymentLinkId.startsWith('test_'))throw Error('Checkout no acreditado como Sandbox');
  result.checkout={url:order.wompi.paymentLinkUrl,linkId:token(link.id),publicKeyEnvironment:'sandbox',singleUse:link.single_use,amountInCents:link.amount_in_cents,currency:link.currency,expiresAt:link.expires_at??null};
  result.order={reference:order.orderNumber,paymentStatus:order.paymentStatus,total:order.total};
  fs.writeFileSync(path.join(__dirname,'sandbox-runtime.json'),JSON.stringify({callbackOrigin,checkoutUrl:order.wompi.paymentLinkUrl,environment:'sandbox'},null,2));safeWrite();console.log('SANDBOX_LISTO '+JSON.stringify({callbackOrigin,checkoutUrl:order.wompi.paymentLinkUrl}));timeout=setTimeout(()=>close(),25*60*1000);
}catch{result.error='Sesión Sandbox no completada. No se exponen errores del proveedor ni secretos.';safeWrite();await close();process.exitCode=1;}})();
process.on('SIGINT',()=>close());process.on('SIGTERM',()=>close());
