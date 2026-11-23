const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../../..'),front=path.join(root,'frontend');
process.chdir(front);
(async()=>{const{ESLint}=require(path.join(front,'node_modules/eslint'));const eslint=new ESLint({cwd:front});const records=[];
for(const relative of ['src/components/admin/PaymentEventAlerts.jsx','src/services/orderAdminService.js','src/app/admin/alertas/page.js']){
  const old=fs.readFileSync(path.join(__dirname,'originales/frontend',relative),'utf8'),current=fs.readFileSync(path.join(front,relative),'utf8');
  for(const [phase,text]of [['antes',old],['despues',current]]){const r=(await eslint.lintText(text,{filePath:path.join(front,relative)}))[0];records.push({phase,file:relative,errorCount:r.errorCount,warningCount:r.warningCount,messages:r.messages.map(m=>({ruleId:m.ruleId,line:m.line,message:m.message}))});}
}fs.writeFileSync(path.join(__dirname,'lint-comparado.json'),JSON.stringify(records,null,2));console.log(JSON.stringify(records.map(({phase,file,errorCount,warningCount})=>({phase,file,errorCount,warningCount}))));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
