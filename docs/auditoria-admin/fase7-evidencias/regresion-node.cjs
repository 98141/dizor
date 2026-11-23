"use strict";
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const files=['phase1.test.js','phase2.test.js','phase2-compatibility.test.js','phase3.test.js','phase4.test.js','phase5.test.js','phase5-corrections.test.js','phase6.test.js'].map(f=>'backend/test/'+f).concat(['cierre-fase2/independiente.test.js','cierre-fase3/independiente.test.js','cierre-fase4/independiente.test.js','cierre-fase5/independiente.test.js','cierre-fase5/revalidacion-evidencias/revalidacion.test.js','cierre-fase6/independiente.test.js'].map(f=>'docs/auditoria-admin/'+f),['frontend/test/stock-adjustment.test.cjs','frontend/test/admin-fields.test.cjs']);
const log=fs.openSync(path.join(__dirname,'regresion-node.txt'),'w'),start=Date.now();
const child=spawn(process.execPath,['--require',path.join(__dirname,'preservar-salidas.cjs'),'--test','--test-concurrency=1',...files],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',log,log]});
child.on('exit',code=>{fs.closeSync(log);fs.writeFileSync(path.join(__dirname,'regresion-node.json'),JSON.stringify({exitCode:code,expectedTests:295,files,ms:Date.now()-start},null,2));console.log('Node regression exit '+code);process.exitCode=code;});
