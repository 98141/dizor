// Solo desvía escrituras de resultados antiguos, sin cambiar código/aserciones.
const fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(path.resolve(__dirname,'../../../..')),docs=path.join(root,'docs'),destRoot=process.env.LAUNCH_VALIDATION_OUT?path.resolve(process.env.LAUNCH_VALIDATION_OUT):path.dirname(__dirname);
function redirect(p){if(typeof p!=='string'&&!Buffer.isBuffer(p))return p;const abs=path.resolve(String(p));let actual=abs;try{actual=path.join(fs.realpathSync(path.dirname(abs)),path.basename(abs));}catch{}
if(actual.toLowerCase().startsWith((docs+path.sep).toLowerCase())&&!actual.toLowerCase().startsWith((destRoot+path.sep).toLowerCase())){const target=path.join(process.env.LAUNCH_VALIDATION_OUT||__dirname,process.env.PREPROD_RUN||'salidas',path.relative(docs,actual));fs.mkdirSync(path.dirname(target),{recursive:true});return target;}return p;}
for(const name of ['writeFileSync','appendFileSync']){const original=fs[name];fs[name]=function(p,...args){return original.call(this,redirect(p),...args);};}
