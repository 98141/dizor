const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..');
test('B01: no escuchar HTTP mientras la conexión/validación de base está pendiente',()=>{
 let listening=false;const fakeLogger={error(){},info(){}};const fakeProcess={env:{NODE_ENV:'production',WOMPI_ENV:'production',MONGO_URI:'mongodb://127.0.0.1:1/test',JWT_SECRET:'x'.repeat(40),JWT_REFRESH_SECRET:'y'.repeat(40)},on(){},exit(){throw Error('exit inesperado');}};
 const requireStub=name=>{if(name==='dotenv')return{config(){}};if(name==='mongoose')return{set(){},disconnect:async()=>{}};if(name==='./app')return{listen(){listening=true;return{on(){},close(){}};}};if(name==='./config/db')return()=>new Promise(()=>{});if(name==='./lib/logger')return fakeLogger;if(name==='./services/wompiService')return{validateConfiguration(){}};throw Error('Import inesperado '+name);};
 vm.runInNewContext(fs.readFileSync(path.join(root,'backend/src/server.js'),'utf8'),{require:requireStub,process:fakeProcess,console});assert.equal(listening,false);
});
