const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const outputs = new Map([
  [path.join(root, "docs/auditoria-admin/fase2-evidencias/cierre-independiente-resultados.json"), path.join(__dirname, "cierre-fase1-resultados.json")],
  [path.join(root, "docs/auditoria-admin/cierre-fase2/independiente-resultados.json"), path.join(__dirname, "cierre-fase2-resultados.json")],
  [path.join(root, "docs/auditoria-admin/cierre-fase3/independiente-resultados.json"), path.join(__dirname, "cierre-fase3-resultados.json")],
]);
outputs.set(path.join(root,"docs/auditoria-admin/cierre-fase4/independiente-resultados.json"), path.join(__dirname,"cierre-fase4-resultados.json"));
function remap(file) {
 if (typeof file !== "string") return file;
 const absolute=path.resolve(file);
 let target=outputs.get(absolute) || file;
 if(target===file)for(const phase of [2,3,4]){
  const prior=path.join(root,`docs/auditoria-admin/fase${phase}-evidencias`),relative=path.relative(prior,absolute);
  if(relative && !relative.startsWith("..") && !path.isAbsolute(relative)){target=path.join(__dirname,`regresion-fase${phase}`,relative);break;}
 }
 if(target!==file)fs.mkdirSync(path.dirname(target),{recursive:true});
 return target;
}
const promiseWrite=fs.promises.writeFile.bind(fs.promises);fs.promises.writeFile=(file,...args)=>promiseWrite(remap(file),...args);
const write = fs.writeFileSync;
fs.writeFileSync = function (file, ...args) { return write.call(this, remap(file), ...args); };
