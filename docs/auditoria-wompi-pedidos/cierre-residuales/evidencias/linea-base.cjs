const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),out=__dirname;
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(p.startsWith(path.dirname(out)))continue;if(e.isDirectory())walk(p);else files.push(p);}}
for(const dir of ['backend/src','backend/test','frontend/src','frontend/test','docs'])walk(path.join(root,dir));
const hashes=Object.fromEntries(files.map(p=>[path.relative(root,p).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
fs.writeFileSync(path.join(out,'linea-base-sha256.json'),JSON.stringify(hashes,null,2));
for(const args of [['status','--short'],['show','--format=fuller','--stat','23ce3a6'],['log','--oneline','23ce3a6..HEAD']])fs.writeFileSync(path.join(out,`git-${args[0]}.txt`),cp.execFileSync('git',args,{cwd:root}));
for(const p of ['backend/src/controllers/orderAdminController.js','backend/src/services/wompiPaymentService.js','backend/src/models/paymentEvent.js','backend/src/controllers/adminAlertController.js','backend/src/routes/adminOrderRoutes.js','frontend/src/components/admin/PaymentEventAlerts.jsx','frontend/src/services/orderAdminService.js','frontend/src/app/admin/alertas/page.js']){const dest=path.join(out,'originales',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
console.log(`Línea base guardada: ${files.length} archivos; originales de los 8 archivos previstos.`);
