const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),front=path.join(root,'frontend');
const {ESLint}=require(path.join(front,'node_modules/eslint'));
const changed=execFileSync('git',['diff','--name-only','--','backend/src','frontend/src'],{cwd:root,encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
const files=[...changed,'backend/src/services/paymentIncidentResolution.js','frontend/src/components/admin/PaymentIncidentActions.jsx','frontend/src/components/admin/PaymentEventAlerts.jsx'];
(async()=>{
  const result={syntax:[],lint:[],preservation:null,diffCheck:null};
  const common=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:[{files:['**/*.cjs','**/*.js'],languageOptions:{ecmaVersion:2024,sourceType:'commonjs'},rules:{'no-unused-vars':['error',{args:'none',caughtErrors:'none'}],'no-unreachable':'error','no-dupe-keys':'error'}}]});
  const next=new ESLint({cwd:front});
  for(const file of [...files,...fs.readdirSync(__dirname).filter(f=>f.endsWith('.cjs')).map(f=>path.relative(root,path.join(__dirname,f)).replaceAll('\\','/'))]){
    const absolute=path.join(root,file),source=fs.readFileSync(absolute,'utf8');
    const backend=!file.startsWith('frontend/');
    if(backend){execFileSync(process.execPath,['--check',absolute],{windowsHide:true});result.syntax.push(file);}
    const engine=backend?common:next;
    process.chdir(backend?root:front); // next/babel resolves its preset from process cwd.
    const current=await engine.lintText(source,{filePath:absolute});let prior=[];
    try{prior=await engine.lintText(execFileSync('git',['show','HEAD:'+file],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true}),{filePath:absolute});}catch{}
    const sig=rows=>rows.flatMap(r=>r.messages.map(m=>m.ruleId+':'+m.severity+':'+m.message.split('\n\n')[0]));
    const before=sig(prior),after=sig(current);
    result.lint.push({file,previous:before,current:after,new:after.filter(m=>!before.includes(m))});
  }
  execFileSync('git',['diff','--check'],{cwd:root,windowsHide:true});result.diffCheck=0;
  const historical=JSON.parse(fs.readFileSync(path.join(__dirname,'evidencias/historicos-sha256.json'),'utf8'));
  const damaged=historical.filter(f=>!fs.existsSync(f.path)||crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex').toUpperCase()!==f.sha256);
  result.preservation={checked:historical.length,changed:damaged.map(f=>f.path)};
  fs.writeFileSync(path.join(__dirname,'evidencias/estatico-cierre.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({syntax:result.syntax.length,newDiagnostics:result.lint.filter(r=>r.new.length),preservation:result.preservation,diffCheck:0},null,2));
  if(damaged.length||result.lint.some(r=>r.new.length))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
