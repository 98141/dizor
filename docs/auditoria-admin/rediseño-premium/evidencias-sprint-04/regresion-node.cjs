"use strict";
// Same 16 files as fase7-evidencias/regresion-node.cjs (295 tests), run from the repo root.
// --preserve-symlinks keeps the temporary dizor/docs junction path so docs tests resolve ../../../backend.
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const repo = path.resolve(__dirname, "../../../..");
const files = ["phase1.test.js", "phase2.test.js", "phase2-compatibility.test.js", "phase3.test.js", "phase4.test.js", "phase5.test.js", "phase5-corrections.test.js", "phase6.test.js"].map((f) => "backend/test/" + f)
  .concat(["cierre-fase2/independiente.test.js", "cierre-fase3/independiente.test.js", "cierre-fase4/independiente.test.js", "cierre-fase5/independiente.test.js", "cierre-fase5/revalidacion-evidencias/revalidacion.test.js", "cierre-fase6/independiente.test.js"].map((f) => "docs/auditoria-admin/" + f), ["frontend/test/stock-adjustment.test.cjs", "frontend/test/admin-fields.test.cjs"]);
const extra = process.argv.includes("--fase7") ? ["backend/test/phase7.test.js"] : [];
const label = (process.argv.find((a) => a.startsWith("--etiqueta=")) || "").slice(11);
const name = (extra.length ? "regresion-node-fase7" : "regresion-node") + (label ? `-${label}` : "");
const log = fs.openSync(path.join(__dirname, `${name}.txt`), "w"), start = Date.now();
const child = spawn(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", "--require", path.join(__dirname, "preservar-salidas.cjs"), "--test", "--test-concurrency=1", ...(extra.length ? extra : files)], { cwd: repo, env: process.env, windowsHide: true, stdio: ["ignore", log, log] });
child.on("exit", (code) => { fs.closeSync(log); fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify({ exitCode: code, expectedTests: extra.length ? 19 : 295, files: extra.length ? extra : files, ms: Date.now() - start }, null, 2)); console.log(`${name} exit ${code}`); process.exitCode = code; });
