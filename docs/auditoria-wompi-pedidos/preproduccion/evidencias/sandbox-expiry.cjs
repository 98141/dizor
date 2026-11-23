// Ensayo E05 independiente, autorizado: crea SOLO un link Sandbox con TTL; sin pedido ni pago.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'../../../..');
if(!process.argv.includes('--authorized-sandbox'))throw Error('Requiere autorización');
const env=require(path.join(root,'backend/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'backend/.env')));
if(env.WOMPI_ENV!=='sandbox'||!env.WOMPI_PRIVATE_KEY?.startsWith('prv_test_'))throw Error('Solo Sandbox');
const hash=v=>'sha256:'+crypto.createHash('sha256').update(v).digest('hex').slice(0,16);
(async()=>{const start=new Date(),expiry=new Date(+start+24*60*60*1000).toISOString(),result={at:start.toISOString(),environment:'sandbox',purpose:'E05 TTL independiente; sin pedido ni transacción',requestedExpiry:expiry,ttlHours:24};
try{
 const response=await fetch('https://sandbox.wompi.co/v1/payment_links',{method:'POST',headers:{Authorization:'Bearer '+env.WOMPI_PRIVATE_KEY,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify({name:'Prueba técnica E05 Sandbox',description:'Verificación de vigencia, sin compra real',single_use:true,collect_shipping:false,currency:'COP',amount_in_cents:15000000,sku:'DIZ-E05-'+crypto.randomBytes(6).toString('hex'),redirect_url:'http://localhost:3000/pedido/confirmacion?test=E05',expires_at:expiry})});
 result.http=response.status;const json=await response.json();
 if(response.ok&&json.data?.id?.startsWith('test_')){result.linkId=hash(json.data.id);result.providerExpiry=json.data.expires_at;result.sameInstant=+new Date(json.data.expires_at)===+new Date(expiry);result.singleUse=json.data.single_use;result.E05='PARCIAL_FORMATO_24H_ACEPTADO; PENDING/vencimiento/reintento no ejecutados';}
 else{result.errorType=json.error?.type||null;result.validationFields=json.error?.messages?Object.keys(json.error.messages):[];result.E05='NO_VALIDADO';}
}catch(e){result.transportError={name:e.name,code:e.code||e.cause?.code||null};result.E05='RESULTADO_DESCONOCIDO_NO_REINTENTAR_AUTOMATICAMENTE';}
fs.writeFileSync(path.join(__dirname,'sandbox-expiracion-real.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));})();
