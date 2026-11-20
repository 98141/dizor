// Run the closing regressions unchanged, redirecting only their generated
// result file into this phase's evidence directory. No migration probes run.
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "../..");
const oldOutput = path.join(root, "docs/auditoria-admin/cierre-fase1/correcciones-independientes-resultados.json");
const newOutput = path.join(root, "docs/auditoria-admin/fase2-evidencias/cierre-independiente-resultados.json");
const write = fs.writeFileSync;
fs.writeFileSync = function (file, ...args) {
  return write.call(this, typeof file === "string" && path.resolve(file) === oldOutput ? newOutput : file, ...args);
};
require(path.join(root, "docs/auditoria-admin/cierre-fase1/correcciones-integracion.test.js"));
test.after(() => { fs.writeFileSync = write; });
