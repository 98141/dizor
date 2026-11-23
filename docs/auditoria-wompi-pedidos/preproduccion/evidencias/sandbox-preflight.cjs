// Solo lectura: no crea pedidos, links, transacciones ni conecta a Mongo.
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../../../..');
const env=require(path.join(root,'backend/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'backend/.env')));
if(env.WOMPI_ENV!=='sandbox'||!env.WOMPI_PRIVATE_KEY?.startsWith('prv_test_')||!env.WOMPI_EVENTS_SECRET?.startsWith('test_events_'))throw Error('Configuración no Sandbox');
(async()=>{const result={at:new Date().toISOString(),environment:'sandbox',readOnly:true,checks:[]};
for(const [resource,url,auth]of[['existing_test_link','https://sandbox.wompi.co/v1/payment_links/test_vYy0Qr',false],['private_query_nonexistent_id','https://sandbox.wompi.co/v1/transactions/dizor-preprod-readonly-no-transaction',true]]){
 const check={resource};try{const res=await fetch(url,{headers:auth?{Authorization:'Bearer '+env.WOMPI_PRIVATE_KEY}:{},signal:AbortSignal.timeout(15000),redirect:'error'});check.http=res.status;let json;try{json=await res.json();}catch{}check.errorType=typeof json?.error?.type==='string'?json.error.type:null;
 if(resource==='existing_test_link'&&res.ok){check.linkFound=true;check.publicKeyEnvironment=json.data?.merchant_public_key?.startsWith('pub_test_')?'sandbox':'unknown';check.active=json.data?.active;check.expiresAt=json.data?.expires_at??null;}
 }catch(e){check.transportError={name:e.name,code:e.code||e.cause?.code||null};}result.checks.push(check);
}fs.writeFileSync(path.join(__dirname,'sandbox-preflight.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));})();
