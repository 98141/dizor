const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
process.env.NODE_ENV='test';process.env.WOMPI_EVENTS_SECRET='test_events_ficticio_limites';process.env.CLIENT_URL='http://127.0.0.1:3000';
const original=Module._load;
Module._load=function(name,parent){if(name==='winston-daily-rotate-file'){const Transport=original('winston-transport',parent);return class extends Transport{log(_i,cb){cb();}};}return original.apply(this,arguments);};
const app=require(path.resolve(__dirname,'../../../backend/src/app'));let server,base;
test.before(async()=>{await new Promise(r=>{server=app.listen(0,'127.0.0.1',r);});base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(r=>server.close(r));});
test('L01: webhook conserva 100/min y tras 301 POST no consume el global',async()=>{
  for(let i=0;i<301;i++){
    const res=await fetch(base+'/api/webhooks/wompi',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if(i<100)assert.equal(res.status,401);else {assert.equal(res.status,429);assert.equal((await res.json()).message,'Demasiadas solicitudes al webhook.');}
  }
  assert.equal((await fetch(base+'/api/remediation-probe-not-found')).status,404);
});
test('L02: resto de API conserva límite global e IP no se acepta de un header en test',async()=>{
  // One probe already consumed; allow only the remaining 299 before global 429.
  for(let i=0;i<299;i++)assert.equal((await fetch(base+'/api/remediation-probe-not-found')).status,404);
  const res=await fetch(base+'/api/remediation-probe-not-found',{headers:{'X-Forwarded-For':'203.0.113.7'}});
  assert.equal(res.status,429);assert.match((await res.json()).message,/esta IP/);
});
