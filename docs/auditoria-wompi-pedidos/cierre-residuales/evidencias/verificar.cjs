const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'linea-base-sha256.json'))),changes=[];
for(const [p,h]of Object.entries(before)){const abs=path.join(root,p);if(!fs.existsSync(abs))changes.push({file:p,deleted:true});else{const now=hash(abs);if(now!==h)changes.push({file:p,before:h,after:now});}}
fs.writeFileSync(path.join(__dirname,'preservacion.json'),JSON.stringify({checked:Object.keys(before).length,changes},null,2));
const results=[];for(const name of fs.readdirSync(__dirname).filter(p=>/^(antes|final|despues-inicial)-.+\.txt$/.test(p))){const s=fs.readFileSync(path.join(__dirname,name),'utf8');const counts={};for(const k of ['tests','pass','fail','cancelled','skipped']){const m=s.match(new RegExp('(?:#|ℹ) '+k+' (\\d+)'));if(m)counts[k]=+m[1];}const matrix=s.match(/Resumen: (.+)/);results.push({file:name,...counts,...(matrix?{matrix:matrix[1]}:{}),failures:[...s.matchAll(/^(?:✖ |not ok \d+ - )(.+)/gm)].map(x=>x[1]).filter((x,i,a)=>a.indexOf(x)===i)});}
fs.writeFileSync(path.join(__dirname,'resultados-comparados.json'),JSON.stringify(results,null,2));
const scope=['backend/src/controllers/orderAdminController.js','backend/src/services/wompiPaymentService.js','backend/src/models/paymentEvent.js','backend/src/controllers/adminAlertController.js','backend/src/routes/adminOrderRoutes.js','frontend/src/components/admin/PaymentEventAlerts.jsx','frontend/src/services/orderAdminService.js','frontend/src/app/admin/alertas/page.js'];
let diff='';for(const p of scope){const a=path.join(__dirname,'originales',p);const r=cp.spawnSync('git',['diff','--no-index','--',a,path.join(root,p)],{encoding:'utf8'});diff+=r.stdout||'';}
const created='backend/src/services/paymentEventArchive.js';diff+=cp.spawnSync('git',['diff','--no-index','--','NUL',path.join(root,created)],{encoding:'utf8'}).stdout||'';
fs.writeFileSync(path.join(__dirname,'cierre-residuales.diff'),diff);
fs.writeFileSync(path.join(__dirname,'codigo-final-sha256.json'),JSON.stringify(Object.fromEntries([...scope,created].map(p=>[p,hash(path.join(root,p))])),null,2));
fs.writeFileSync(path.join(__dirname,'git-status-final.txt'),cp.execFileSync('git',['status','--short'],{cwd:root}));
console.log(JSON.stringify({checked:Object.keys(before).length,changed:changes.map(c=>c.file),results:results.map(({file,tests,pass,fail,matrix})=>({file,tests,pass,fail,matrix}))},null,2));
