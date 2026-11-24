"use strict";
// Same nine browser suites as fase7-evidencias/regresion-navegador.cjs (195 + 33 checks), unmodified.
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const repo = path.resolve(__dirname, "../../../.."), preload = path.join(__dirname, "preservar-salidas.cjs");
const all = [["comunicaciones", "frontend/test/communications-browser.cjs", 8], ["pedidos", "frontend/test/orders-workspace-browser.cjs", 20], ["catalogo", "frontend/test/catalog-workspace-browser.cjs", 20], ["navegacion", "frontend/test/navigation-next-browser.cjs", 35], ["independiente-f5", "docs/auditoria-admin/cierre-fase5/navegador-independiente.cjs", 10], ["marketing", "frontend/test/content-settings-next-browser.cjs", 25], ["revalidacion-f5", "docs/auditoria-admin/cierre-fase5/revalidacion-evidencias/navegador-revalidacion.cjs", 18], ["fase6", "frontend/test/admin-polish-next-browser.cjs", 59], ["taxonomia", "frontend/test/taxonomy-responsive-next-browser.cjs", 33]];
const only = process.argv.slice(2), suites = only.length ? all.filter(([n]) => only.includes(n)) : all, results = [];
const out = path.join(__dirname, only.length ? `regresion-navegador-${only.join("-")}.json` : "regresion-navegador.json");
(async () => { for (const [name, file, checks] of suites) { const start = Date.now(), log = fs.openSync(path.join(__dirname, `regresion-${name}.txt`), "w");
  const exitCode = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", "--require", preload, file], { cwd: repo, env: { ...process.env, DIZOR_PHASE6_MODE: "despues" }, windowsHide: true, stdio: ["ignore", log, log] }); child.once("error", reject); child.once("exit", resolve); });
  fs.closeSync(log); results.push({ name, file, checks, exitCode, ms: Date.now() - start }); fs.writeFileSync(out, JSON.stringify(results, null, 2)); console.log(`${name}: ${exitCode === 0 ? "PASS" : "FAIL"} (${checks})`); }
  if (results.some((r) => r.exitCode !== 0)) process.exitCode = 1; })().catch((e) => { console.error(e); process.exitCode = 1; });
