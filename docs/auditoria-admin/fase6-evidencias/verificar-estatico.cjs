"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),front=path.join(root,'frontend');
const {ESLint}=require(path.join(front,'node_modules/eslint'));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const changed=[...new Set([...git(['diff','--name-only']),...git(['ls-files','--others','--exclude-standard'])])].filter(f=>/\.(?:jsx?|cjs|mjs|css)$/.test(f));
(async()=>{
 const result={syntax:[],css:[],frontend:{},node:{},diffCheck:null};
 const swc=require(path.join(front,'node_modules/@next/swc-win32-x64-msvc')),postcss=require(path.join(front,'node_modules/postcss'));
 for(const f of changed){const file=path.join(root,f);try{if(f.endsWith('.css')){postcss.parse(fs.readFileSync(file,'utf8'),{from:file});result.css.push({file:f,passed:true});}else if(f.startsWith('frontend/src/')){swc.transformSync(fs.readFileSync(file,'utf8'),false,Buffer.from(JSON.stringify({filename:file,jsc:{parser:{syntax:'ecmascript',jsx:true}},module:{type:'commonjs'}})));result.syntax.push({file:f,passed:true});}else{execFileSync(process.execPath,['--check',file],{windowsHide:true,stdio:'pipe'});result.syntax.push({file:f,passed:true});}}catch(error){result.syntax.push({file:f,passed:false,error:String(error)});}}
 const frontendFiles=changed.filter(f=>f.startsWith('frontend/src/')&&/\.(?:jsx?|mjs)$/.test(f));
 process.chdir(front);
 const lint=await new ESLint({cwd:front}).lintFiles(frontendFiles.map(f=>path.join(root,f)));
 fs.writeFileSync(path.join(__dirname,'lint-modificados.json'),JSON.stringify(lint,null,2));
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'lint-antes.json'),'utf8'));
 const signature=m=>`${m.ruleId}:${m.severity}:${m.message.split('\n\n')[0]}`;
 const added=[];
 for(const file of lint){const before=baseline.find(b=>b.filePath===file.filePath);const counts=new Map();for(const m of before?.messages||[])counts.set(signature(m),(counts.get(signature(m))||0)+1);for(const m of file.messages){const key=signature(m);if(counts.get(key)>0)counts.set(key,counts.get(key)-1);else added.push({file:path.relative(root,file.filePath),rule:m.ruleId,message:m.message});}}
 result.frontend={files:lint.length,errors:lint.reduce((s,x)=>s+x.errorCount,0),warnings:lint.reduce((s,x)=>s+x.warningCount,0),newDiagnostics:added,cms:lint.find(f=>f.filePath.endsWith('ContentWorkspace.jsx'))?.messages};
 process.chdir(root);
 const nodeFiles=changed.filter(f=>!f.startsWith('frontend/src/')&&/\.(js|cjs)$/.test(f));
 const nodeLint=await new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:[{files:['**/*.js','**/*.cjs'],languageOptions:{ecmaVersion:2024,sourceType:'commonjs'},rules:{'no-unused-vars':['error',{args:'none',caughtErrors:'none'}],'no-unreachable':'error','no-dupe-keys':'error','no-constant-condition':'error'}}]}).lintFiles(nodeFiles);
 fs.writeFileSync(path.join(__dirname,'lint-node.json'),JSON.stringify(nodeLint,null,2));result.node={files:nodeLint.length,errors:nodeLint.reduce((s,x)=>s+x.errorCount,0),warnings:nodeLint.reduce((s,x)=>s+x.warningCount,0)};
 try{execFileSync('git',['diff','--check'],{cwd:root,windowsHide:true,stdio:'pipe'});result.diffCheck=0;}catch(error){result.diffCheck=error.status;}
 fs.writeFileSync(path.join(__dirname,'estatico.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));assert(result.syntax.every(s=>s.passed));assert.equal(added.length,0);assert.equal(result.node.errors,0);assert.equal(result.diffCheck,0);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
