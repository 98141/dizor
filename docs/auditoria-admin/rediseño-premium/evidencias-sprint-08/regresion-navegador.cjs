"use strict";
// Sprint 08 · browser regression, unmodified suites. Next.js production build + real Express + ephemeral
// MongoDB where the suite uses them. Writes of earlier phases are redirected by preservar-salidas.cjs.
// Usage from dizor/: node docs/auditoria-admin/rediseño-premium/evidencias-sprint-08/regresion-navegador.cjs [suite …]
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const repo = path.resolve(__dirname, "../../../.."), preload = path.join(__dirname, "preservar-salidas.cjs");
const all = [
  ["navegacion", "frontend/test/navigation-next-browser.cjs"],      // P14 auditoría, P16 configuración, P23 usuarios
  ["fase6", "frontend/test/admin-polish-next-browser.cjs"],         // A05–A07 usuarios, A25 botón, pantallas de las 3 rutas
  ["marketing", "frontend/test/content-settings-next-browser.cjs"], // SettingsLoadState y guardado confirmado
  ["sprint07", "frontend/test/sprint07-finanzas-browser.cjs"],
  ["sprint04", "frontend/test/sprint04-atencion-browser.cjs"],
];
const only = process.argv.slice(2), suites = only.length ? all.filter(([n]) => only.includes(n)) : all, results = [];
const out = path.join(__dirname, only.length ? `regresion-navegador-${only.join("-")}.json` : "regresion-navegador.json");
(async () => {
  for (const [name, file] of suites) {
    const start = Date.now(), logFile = path.join(__dirname, `regresion-${name}.txt`), log = fs.openSync(logFile, "w");
    const exitCode = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", "--require", preload, file], { cwd: repo, env: { ...process.env, DIZOR_PHASE6_MODE: "despues", DIZOR_SPRINT04_OUT: path.join(__dirname, "regresion", "sprint04") }, windowsHide: true, stdio: ["ignore", log, log] }); child.once("error", reject); child.once("exit", resolve); });
    fs.closeSync(log);
    const text = fs.readFileSync(logFile, "utf8"), oks = (text.match(/^ok\b|^✓|^\s*ok - /gm) || []).length;
    results.push({ name, file, exitCode, okLines: oks, ms: Date.now() - start });
    fs.writeFileSync(out, JSON.stringify(results, null, 2));
    console.log(`${name}: ${exitCode === 0 ? "PASS" : "FAIL"} (${oks} ok)`);
  }
  if (results.some((r) => r.exitCode !== 0)) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
