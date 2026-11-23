const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),base=path.dirname(__dirname),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const planned=['backend/src/services/paymentEventArchive.js','backend/src/models/paymentEvent.js','backend/src/controllers/orderAdminController.js','backend/src/routes/adminOrderRoutes.js','frontend/src/components/admin/PaymentEventAlerts.jsx','frontend/src/services/orderAdminService.js'];
function walk(dir,out){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(p.startsWith(base))continue;if(e.isDirectory())walk(p,out);else out.push(p);}}
const files=[];for(const dir of ['backend/src','backend/test','frontend/src','frontend/test','docs'])walk(path.join(root,dir),files);
const current=Object.fromEntries(files.map(p=>[path.relative(root,p).replaceAll('\\','/'),sha(p)]));
if(process.argv[2]==='before'){
  if(fs.existsSync(path.join(__dirname,'sha-antes.json')))throw Error('Línea base ya existe');
  fs.writeFileSync(path.join(__dirname,'sha-antes.json'),JSON.stringify(current,null,2));
  for(const p of planned){const target=path.join(__dirname,'antes',p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,p),target);}
  for(const [name,args]of [['estado',['status','--short']],['head',['rev-parse','HEAD']],['commit23ce3a6',['show','--format=fuller','--stat','23ce3a6']]])fs.writeFileSync(path.join(__dirname,`git-${name}-antes.txt`),cp.execFileSync('git',args,{cwd:root}));
  console.log(`Línea base: ${files.length} archivos; seis fuentes previstas copiadas.`);
}else{
  const before=JSON.parse(fs.readFileSync(path.join(__dirname,'sha-antes.json'))),changes=Object.keys(before).filter(p=>before[p]!==current[p]);
  fs.writeFileSync(path.join(__dirname,'preservacion.json'),JSON.stringify({checked:Object.keys(before).length,changes,newFiles:Object.keys(current).filter(p=>!before[p]),unexpected:changes.filter(p=>!planned.includes(p))},null,2));
  let diff='';for(const p of planned)diff+=cp.spawnSync('git',['diff','--no-index','--',path.join(__dirname,'antes',p),path.join(root,p)],{encoding:'utf8'}).stdout||'';
  fs.writeFileSync(path.join(__dirname,'rc01.diff'),diff);fs.writeFileSync(path.join(__dirname,'codigo-final-sha256.json'),JSON.stringify(Object.fromEntries(planned.map(p=>[p,current[p]])),null,2));
  console.log(JSON.stringify({checked:Object.keys(before).length,changes,unexpected:changes.filter(p=>!planned.includes(p))}));
}
