"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline-archivos.json'),'utf8'));
const allowed='frontend/src/styles/layouts/admin-polish.css',changed=baseline.filter(r=>!fs.existsSync(path.join(root,r.file))||hash(path.join(root,r.file))!==r.sha256);
assert.deepEqual(changed.map(r=>r.file),[allowed]);
const known=new Set(baseline.map(r=>r.file)),added=[];
for(const directory of ['frontend/src','frontend/test','backend/src','backend/test','docs/auditoria-admin']){
 const walk=directory=>{for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){const file=(directory+'/'+entry.name).replaceAll('\\','/');if(file.startsWith('docs/auditoria-admin/cierre-fase6/correccion-f6-i01-evidencias'))continue;if(entry.isDirectory())walk(file);else if(!known.has(file))added.push(file);}};walk(directory);
}
assert.deepEqual(added.sort(),['docs/auditoria-admin/cierre-fase6/INFORME_CORRECCION_F6-I01.md','frontend/test/helpers/taxonomyActionVisibility.cjs','frontend/test/helpers/taxonomyResponsiveFlow.cjs','frontend/test/taxonomy-responsive-next-browser.cjs'].sort());
const diff=spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--no-ext-diff','--text',path.join(__dirname,'admin-polish-antes.css'),path.join(root,allowed)],{encoding:'utf8',windowsHide:true});assert.equal(diff.status,1);fs.writeFileSync(path.join(__dirname,'cambio-css.diff'),diff.stdout);
const result={baselineFiles:baseline.length,unchanged:baseline.length-changed.length,applicationChanges:changed.map(r=>({file:r.file,before:r.sha256,after:hash(path.join(root,r.file))})),newFilesOutsideEvidence:added,unexpectedChanges:[]};fs.writeFileSync(path.join(__dirname,'preservacion.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
