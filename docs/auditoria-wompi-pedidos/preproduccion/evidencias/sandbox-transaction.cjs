// Solo lectura de la transacción Sandbox generada por el navegador. No Mongo, no POST al proveedor.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const root=path.resolve(__dirname,'../../../..');
const env=require(path.join(root,'backend/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'backend/.env')));
if(env.WOMPI_ENV!=='sandbox'||!env.WOMPI_PRIVATE_KEY?.startsWith('prv_test_'))throw Error('Solo Sandbox');
const id=process.argv[2];if(!/^[A-Za-z0-9_-]{1,150}$/.test(id||''))throw Error('Indica el ID observado en el checkout');
const token=v=>typeof v==='string'&&v?'sha256:'+crypto.createHash('sha256').update(v).digest('hex').slice(0,16):v??null;
(async()=>{const result={at:new Date().toISOString(),environment:'sandbox',readOnly:true,transactionId:token(id)};
try{
 const response=await fetch('https://sandbox.wompi.co/v1/transactions/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+env.WOMPI_PRIVATE_KEY},signal:AbortSignal.timeout(15000),redirect:'error'});result.http=response.status;
 const json=await response.json();if(response.ok&&json.data?.id===id){const tx=json.data;
  result.transaction={id:token(tx.id),paymentLinkFieldPresent:Object.hasOwn(tx,'payment_link_id'),paymentLinkId:token(tx.payment_link_id),reference:token(tx.reference),amountInCents:tx.amount_in_cents,currency:tx.currency,status:tx.status,createdAt:tx.created_at,finalizedAt:tx.finalized_at??null};
  result.association={expectedLink:token('test_vYy0Qr'),matchesExpectedLink:tx.payment_link_id==='test_vYy0Qr',referenceContainsLink:typeof tx.reference==='string'&&tx.reference.startsWith('test_vYy0Qr_')};
  result.E01=result.association.matchesExpectedLink?'PARCIAL_GET_REAL_CON_VINCULO; falta webhook auténtico':'FALLO_GET_SIN_VINCULO; NO-GO actual';
  const linkResponse=await fetch('https://sandbox.wompi.co/v1/payment_links/test_vYy0Qr',{signal:AbortSignal.timeout(15000),redirect:'error'});const link=await linkResponse.json();result.linkAfterPayment={http:linkResponse.status,active:link.data?.active,singleUse:link.data?.single_use,expiresAt:link.data?.expires_at??null,merchantEnvironment:link.data?.merchant_public_key?.startsWith('pub_test_')?'sandbox':'unknown'};
 }else result.error='Consulta no verificada; no se guarda cuerpo del proveedor';
}catch(e){result.transportError={name:e.name,code:e.code||e.cause?.code||null};}
fs.writeFileSync(path.join(__dirname,'sandbox-transaccion-real.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));})();
