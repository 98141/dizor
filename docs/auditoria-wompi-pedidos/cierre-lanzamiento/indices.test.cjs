const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');const root=path.resolve(__dirname,'../../..');
const f=require('../auditoria-claude/evidencias/fixture-claude.cjs'),readiness=require(path.join(root,'backend/src/services/databaseReadiness'));
test.before(async()=>{await f.setup();readiness.loadModels();await Promise.allSettled(Object.values(f.mongoose.models).map(m=>m.init()));});test.after(async()=>f.close());
test('I01 replica efímera e índices únicos completos: lista de solo lectura válida',async()=>{const r=await readiness.assertReady();assert.equal(r.ready,true);assert.ok(r.indexes.some(i=>i.model==='Order'&&i.key.idempotencyKey===1));assert.ok(r.indexes.some(i=>i.model==='PaymentEvent'&&i.valid));});
test('I02 índice de recibos ausente: rechazo explícito y nunca reparación automática',async()=>{
 const c=f.M.PaymentEvent.collection;await c.dropIndex('key_1');try{await assert.rejects(readiness.assertReady(),e=>e.code==='DATABASE_NOT_READY'&&e.issues.some(i=>i.model==='PaymentEvent'));assert.ok(!(await c.indexes()).some(i=>i.key.key));}finally{await c.createIndex({key:1},{unique:true});}
});
test('I03 índice con las mismas claves pero no único: se rechaza',async()=>{
 const c=f.M.PaymentEvent.collection;await c.dropIndex('key_1');await c.createIndex({key:1});try{await assert.rejects(readiness.assertReady(),{code:'DATABASE_NOT_READY'});}finally{await c.dropIndex('key_1');await c.createIndex({key:1},{unique:true});}
});
test('I04 filtro parcial de idempotencia incompatible: se rechaza sin modificarlo',async()=>{
 const c=f.M.Order.collection;await c.dropIndex('idempotencyKey_1');await c.createIndex({idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$exists:true}}});
 try{await assert.rejects(readiness.assertReady(),{code:'DATABASE_NOT_READY'});assert.deepEqual((await c.indexes()).find(i=>i.name==='idempotencyKey_1').partialFilterExpression,{idempotencyKey:{$exists:true}});}finally{await c.dropIndex('idempotencyKey_1');await c.createIndex({idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$type:'string'}}});}
});
test('I05 sparse distinto al contrato: se rechaza',async()=>{
 const c=f.M.PaymentEvent.collection;await c.dropIndex('key_1');await c.createIndex({key:1},{unique:true,sparse:true});try{await assert.rejects(readiness.assertReady(),{code:'DATABASE_NOT_READY'});}finally{await c.dropIndex('key_1');await c.createIndex({key:1},{unique:true});}
});
test('I06 duplicados impiden crear índice; la protección no se declara lista',async()=>{
 const c=f.M.PaymentEvent.collection,key='duplicado-ensayo-arranque';await c.dropIndex('key_1');await c.insertMany([{key,transactionId:'test-a',status:'PENDING'},{key,transactionId:'test-b',status:'PENDING'}]);
 try{await assert.rejects(c.createIndex({key:1},{unique:true}),e=>e.code===11000);await assert.rejects(readiness.assertReady(),{code:'DATABASE_NOT_READY'});}finally{await c.deleteMany({key});await c.createIndex({key:1},{unique:true});}
});
test('I07 colección ausente: rechazo; no creación implícita desde inspección',async()=>{
 const mongoose=f.mongoose;const schema=new mongoose.Schema({guard:{type:String,unique:true}},{autoIndex:false,autoCreate:false});const m=mongoose.model('UnprovisionedReadiness',schema);
 try{await assert.rejects(readiness.assertReady(mongoose.connection,{UnprovisionedReadiness:m}),e=>e.issues.some(i=>i.code==='COLLECTION_MISSING'));assert.equal((await mongoose.connection.db.listCollections({name:m.collection.name}).toArray()).length,0);}finally{mongoose.deleteModel('UnprovisionedReadiness');}
});
test('I08 topología sin transacciones: rechazo',async()=>{
 const {MongoMemoryServer}=require(path.join(process.env.MMS_DIR,'node_modules/mongodb-memory-server'));const db=await MongoMemoryServer.create();let conn;
 try{conn=await f.mongoose.createConnection(db.getUri(),{autoIndex:false,autoCreate:false}).asPromise();await assert.rejects(readiness.assertReady(conn,{}),e=>e.issues.some(i=>i.code==='TRANSACTIONS_UNAVAILABLE'));}finally{if(conn)await conn.close();await db.stop();}
});
async function boot(databaseName=f.mongoose.connection.name){
 const net=require('node:net'),{spawn}=require('node:child_process'),hello=await f.mongoose.connection.db.admin().command({hello:1});
 const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});});
 const env={};for(const key of['SystemRoot','WINDIR','COMSPEC','PATH','PATHEXT','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];Object.assign(env,{NODE_ENV:'production',PORT:String(port),MONGO_URI:`mongodb://127.0.0.1:${f.mongoose.connection.port}/${databaseName}?replicaSet=${hello.setName}`,JWT_SECRET:'fictitious-jwt-'.repeat(4),JWT_REFRESH_SECRET:'fictitious-refresh-'.repeat(4),WOMPI_ENV:'production',WOMPI_PRIVATE_KEY:'',WOMPI_EVENTS_SECRET:'',CLIENT_URL:'http://localhost:39999',TRANSACTIONAL_NOTIFICATIONS_ENABLED:'false'});
 const child=spawn(process.execPath,['--require',path.join(__dirname,'evidencias/boot-preload.cjs'),path.join(root,'backend/src/server.js')],{cwd:root,env,windowsHide:true});let output='',timer;
 try{return await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Arranque no terminó: '+output.slice(-1000))),20000);for(const stream of[child.stdout,child.stderr])stream.on('data',data=>{output+=data;if(output.includes('Servidor iniciado'))resolve({listening:true,output,port});});child.once('error',reject);child.once('exit',code=>resolve({listening:false,output,code,port}));});}
 finally{clearTimeout(timer);if(child.exitCode===null){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,1000);});}}
}
test('I09 servidor real: índice ausente impide escuchar HTTP y devuelve exit=1',async()=>{
 const c=f.M.PaymentEvent.collection;await c.dropIndex('key_1');try{const r=await boot();assert.equal(r.listening,false,r.output);assert.equal(r.code,1,r.output);assert.ok(r.output.includes('DATABASE_NOT_READY'));assert.ok(!(await c.indexes()).some(i=>i.key.key));}finally{await c.createIndex({key:1},{unique:true});}
});
test('I10 servidor real: base sin preparar no se autoprovisiona',async()=>{
 const name='startup_unprovisioned',r=await boot(name);assert.equal(r.listening,false,r.output);assert.equal(r.code,1);assert.equal((await f.mongoose.connection.getClient().db(name).listCollections().toArray()).length,0);
});
test('I11 servidor real: topología e índices válidos permiten iniciar',async()=>{const r=await boot();assert.equal(r.listening,true,r.output);});
