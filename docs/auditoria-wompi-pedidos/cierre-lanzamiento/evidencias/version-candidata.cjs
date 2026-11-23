const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');const root=path.resolve(__dirname,'../../../..'),files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.env')||['node_modules','.next','logs','.git'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p);}}
for(const p of['backend/src','frontend/src','frontend/public'])if(fs.existsSync(path.join(root,p)))walk(path.join(root,p));
for(const p of['.gitattributes','backend/package.json','backend/package-lock.json','frontend/package.json','frontend/package-lock.json','frontend/next.config.mjs'])if(fs.existsSync(path.join(root,p)))files.push(path.join(root,p));
const entries=files.map(p=>({path:path.relative(root,p).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')})).sort((a,b)=>a.path.localeCompare(b.path));
const fingerprint=crypto.createHash('sha256').update(entries.map(x=>x.path+'\0'+x.sha256).join('\n')).digest('hex');
fs.writeFileSync(path.join(__dirname,'version-candidata.json'),JSON.stringify({baseCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceFingerprint:fingerprint,committed:false,files:entries},null,2));
const mongoose=require(path.join(root,'backend/node_modules/mongoose'));mongoose.set('autoIndex',false);mongoose.set('autoCreate',false);require(path.join(root,'backend/src/services/databaseReadiness')).loadModels();
const indexes=Object.values(mongoose.models).flatMap(m=>m.schema.indexes().filter(([,o])=>o.unique).map(([key,options])=>({model:m.modelName,collection:m.collection.name,key,options})));
fs.writeFileSync(path.join(__dirname,'indices-requeridos.json'),JSON.stringify({notice:'Plan de metadatos; no ejecuta migraciones. Inventariar y ensayar en copia restaurada antes de crear índices.',indexes},null,2));
console.log(JSON.stringify({sourceFiles:entries.length,sourceFingerprint:fingerprint,requiredUniqueIndexes:indexes.length,committed:false}));process.exit(0);
