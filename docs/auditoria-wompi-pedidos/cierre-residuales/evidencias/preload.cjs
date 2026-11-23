// Redirige exclusivamente salidas de auditorías; no modifica pruebas ni código cargado.
const fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(path.resolve(__dirname,'../../../..'));
const docs=path.join(root,'docs'),closure=path.join(docs,'auditoria-wompi-pedidos','cierre-residuales');
function redirect(p){
  if(typeof p!=='string'&&!Buffer.isBuffer(p))return p;
  const abs=path.resolve(String(p));let actual=abs;
  try{actual=path.join(fs.realpathSync(path.dirname(abs)),path.basename(abs));}catch{}
  if(actual.toLowerCase().startsWith((docs+path.sep).toLowerCase())&&!actual.toLowerCase().startsWith((closure+path.sep).toLowerCase())){
    const dest=path.join(__dirname,process.env.RESIDUAL_RUN||'salidas',path.relative(docs,actual));fs.mkdirSync(path.dirname(dest),{recursive:true});return dest;
  }return p;
}
for(const name of ['writeFileSync','appendFileSync']){const original=fs[name];fs[name]=function(p,...args){return original.call(this,redirect(p),...args);};}
