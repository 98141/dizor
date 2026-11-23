const fs=require('node:fs'),path=require('node:path');const f=require('../../auditoria-claude/evidencias/fixture-claude.cjs');
(async()=>{try{const env=await f.setup();const root=path.resolve(__dirname,'../../../..'),mongoose=require(path.join(root,'backend/node_modules/mongoose'));const hello=await mongoose.connection.db.admin().command({hello:1});
 const collections={};for(const name of['Order','PaymentEvent','Notification'])collections[name]=(await f.M[name].collection.indexes()).map(x=>({name:x.name,key:x.key,unique:!!x.unique,partialFilterExpression:x.partialFilterExpression||null}));
 const result={at:new Date().toISOString(),classification:'VALIDADO SOLO EN LOCAL',environment:env,mongo:{hostLoopback:mongoose.connection.host==='127.0.0.1',replicaSet:!!hello.setName,writablePrimary:hello.isWritablePrimary},collections,backupRestore:'NO_EJECUTADO',productionAccess:false};
 fs.writeFileSync(path.join(__dirname,'infra-local.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await f.close();}})().catch(()=>{console.error('Verificación local incompleta');process.exitCode=1;});
