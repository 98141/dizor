const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'evidencias');
const changed=['backend/src/services/wompiPaymentService.js','backend/src/services/wompiService.js','backend/src/controllers/orderAdminController.js'];
const newTest='backend/test/phase1-v2.test.js';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']});
(async()=>{
  const {ESLint}=require(path.join(root,'frontend/node_modules/eslint'));
  const lint=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:[{files:['**/*.cjs','**/*.js'],languageOptions:{ecmaVersion:2024,sourceType:'commonjs'},rules:{'no-unused-vars':['error',{args:'none',caughtErrors:'none'}],'no-unreachable':'error','no-dupe-keys':'error'}}]});
  const result={syntax:[],lint:[],preservation:null,head:git(['rev-parse','HEAD']).trim(),branch:git(['branch','--show-current']).trim()};
  for(const file of [...changed,newTest,...fs.readdirSync(__dirname).filter(x=>x.endsWith('.cjs')).map(x=>path.relative(root,path.join(__dirname,x)).replaceAll('\\','/'))]){
    const absolute=path.join(root,file);execFileSync(process.execPath,['--check',absolute],{windowsHide:true});result.syntax.push(file);
    const current=await lint.lintText(fs.readFileSync(absolute,'utf8'),{filePath:absolute});
    const before=changed.includes(file)?await lint.lintText(fs.readFileSync(path.join(__dirname,'antes',path.basename(file)),'utf8'),{filePath:absolute}):[];
    const sig=items=>items.flatMap(r=>r.messages.map(m=>`${m.ruleId}:${m.severity}:${m.message}`));
    result.lint.push({file,new:sig(current).filter(x=>!sig(before).includes(x))});
  }
  const baseline=JSON.parse(fs.readFileSync(path.join(out,'baseline-sha256.json'),'utf8'));
  const differences=baseline.filter(r=>!fs.existsSync(r.path)||hash(r.path)!==r.sha256);
  const rel=file=>path.relative(root,file).replaceAll('\\','/');
  result.preservation={checked:baseline.length,changed:differences.map(x=>rel(x.path)),unexpected:differences.map(x=>rel(x.path)).filter(x=>!changed.includes(x))};
  git(['diff','--check']);result.diffCheck=0;
  fs.writeFileSync(path.join(out,'verificacion-final.json'),JSON.stringify(result,null,2));
  let diff='';for(const file of changed){const old=path.relative(root,path.join(__dirname,'antes',path.basename(file))).replaceAll('\\','/');let patch;
    try{patch=git(['diff','--no-index','--',old,file]);}catch(e){if(e.status!==1)throw e;patch=e.stdout;}
    diff+=patch.replaceAll('a/'+old,'a/'+file);
  }
  try{diff+=git(['diff','--no-index','--','NUL',newTest]);}catch(e){if(e.status!==1)throw e;diff+=e.stdout;}
  fs.writeFileSync(path.join(out,'remediacion-2.diff'),diff);
  fs.writeFileSync(path.join(out,'archivos-codigo.json'),JSON.stringify([...changed,newTest].map(file=>({file,sha256:hash(path.join(root,file))})),null,2));
  fs.writeFileSync(path.join(out,'git-status-despues.txt'),git(['status','--short']));
  console.log(JSON.stringify(result,null,2));
  if(result.preservation.unexpected.length||result.lint.some(x=>x.new.length))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
