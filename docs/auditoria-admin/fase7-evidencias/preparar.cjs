"use strict";
// Preparing a new evidence destination never overwrites prior audit evidence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),audit=path.join(root,'docs/auditoria-admin');
const old=path.join(audit,'cierre-fase6/correccion-f6-i01-evidencias');
let preload=fs.readFileSync(path.join(old,'preservar-salidas.cjs'),'utf8').replace("path.resolve(__dirname,'../..')","path.resolve(__dirname,'..')");
fs.writeFileSync(path.join(__dirname,'preservar-salidas.cjs'),preload);
let runner=fs.readFileSync(path.join(old,'regresion-navegador.cjs'),'utf8').replace("path.resolve(__dirname,'../../../..')","path.resolve(__dirname,'../../..')");
runner=runner.replace("['fase6','frontend/test/admin-polish-next-browser.cjs',59]","['fase6','frontend/test/admin-polish-next-browser.cjs',59],['taxonomia','frontend/test/taxonomy-responsive-next-browser.cjs',33]");
fs.writeFileSync(path.join(__dirname,'regresion-navegador.cjs'),runner);
const hashes={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next','.git','.env','fase7-evidencias'].includes(e.name)||e.name.startsWith('.env'))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile())hashes[path.relative(root,p).replaceAll('\\','/')]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
walk(root);fs.writeFileSync(path.join(__dirname,'baseline-sha256.json'),JSON.stringify(hashes,null,2));
console.log(Object.keys(hashes).length+' protected files');
