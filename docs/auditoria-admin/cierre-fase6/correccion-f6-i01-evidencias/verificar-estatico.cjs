"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),front=path.join(root,'frontend'),{ESLint}=require(path.join(front,'node_modules/eslint'));
(async()=>{
 const files=['frontend/test/taxonomy-responsive-next-browser.cjs','frontend/test/helpers/taxonomyResponsiveFlow.cjs','frontend/test/helpers/taxonomyActionVisibility.cjs',...fs.readdirSync(__dirname).filter(f=>f.endsWith('.cjs')).map(f=>path.relative(root,path.join(__dirname,f)))];
 const result={syntax:[],css:null,lintNode:null,lintTaxonomy:null,previousDiagnostics:null,diffCheck:null};
 for(const file of files){execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe',windowsHide:true});result.syntax.push({file,passed:true});}
 const css=path.join(front,'src/styles/layouts/admin-polish.css');require(path.join(front,'node_modules/postcss')).parse(fs.readFileSync(css,'utf8'),{from:css});result.css={file:path.relative(root,css),passed:true};
 const swc=require(path.join(front,'node_modules/@next/swc-win32-x64-msvc'));const component=path.join(front,'src/components/admin/TaxonomyManager.jsx');swc.transformSync(fs.readFileSync(component,'utf8'),false,Buffer.from(JSON.stringify({filename:component,jsc:{parser:{syntax:'ecmascript',jsx:true}},module:{type:'commonjs'}})));result.syntax.push({file:path.relative(root,component),passed:true});
 process.chdir(front);const lint=await new ESLint({cwd:front}).lintFiles(['src/components/admin/TaxonomyManager.jsx','src/components/admin/AdminConfirmModal.jsx']);result.lintTaxonomy={errors:lint.reduce((s,r)=>s+r.errorCount,0),warnings:lint.reduce((s,r)=>s+r.warningCount,0)};
 // Same 23 files as Phase 6: distinguish the known 7 errors and 3 warnings.
 const prior=JSON.parse(fs.readFileSync(path.join(root,'docs/auditoria-admin/fase6-evidencias/lint-modificados.json'),'utf8'));const current=await new ESLint({cwd:front}).lintFiles(prior.map(r=>r.filePath));
 const signature=r=>r.messages.map(m=>m.ruleId+':'+m.severity+':'+m.message.split('\n\n')[0]).sort();assert.deepEqual(current.map(r=>({file:r.filePath,messages:signature(r)})),prior.map(r=>({file:r.filePath,messages:signature(r)})));
 result.previousDiagnostics={errors:current.reduce((s,r)=>s+r.errorCount,0),warnings:current.reduce((s,r)=>s+r.warningCount,0),new:0};
 process.chdir(root);const node=await new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:[{files:['**/*.cjs'],languageOptions:{ecmaVersion:2024,sourceType:'commonjs'},rules:{'no-unused-vars':['error',{args:'none',caughtErrors:'none'}],'no-unreachable':'error','no-dupe-keys':'error'}}]}).lintFiles(files.map(f=>path.join(root,f)));result.lintNode={errors:node.reduce((s,r)=>s+r.errorCount,0),warnings:node.reduce((s,r)=>s+r.warningCount,0)};fs.writeFileSync(path.join(__dirname,'lint-node.json'),JSON.stringify(node,null,2));
 execFileSync('git',['diff','--check'],{cwd:root,stdio:'pipe',windowsHide:true});result.diffCheck=0;
 fs.writeFileSync(path.join(__dirname,'estatico.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(result.lintNode.errors,0);assert.equal(result.lintTaxonomy.errors,0);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
