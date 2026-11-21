const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const outputs = new Map([
  [path.join(root, "docs/auditoria-admin/fase2-evidencias/cierre-independiente-resultados.json"), path.join(__dirname, "cierre-fase1-resultados.json")],
  [path.join(root, "docs/auditoria-admin/cierre-fase2/independiente-resultados.json"), path.join(__dirname, "cierre-fase2-resultados.json")],
  [path.join(root, "docs/auditoria-admin/cierre-fase3/independiente-resultados.json"), path.join(__dirname, "cierre-fase3-resultados.json")],
]);
const write = fs.writeFileSync;
fs.writeFileSync = function (file, ...args) { return write.call(this, typeof file === "string" ? outputs.get(path.resolve(file)) || file : file, ...args); };
