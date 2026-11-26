"use strict";
// Sprint 09 · Node regression: the 16 files of fase7/sprint01 (295 tests) plus F7, Sprint 01,
// Sprint 07 and the remaining backend suites (checkout, Wompi, reviews, municipalities).
// Usage from dizor/: node docs/auditoria-admin/rediseño-premium/evidencias-sprint-09/regresion-node.cjs [--etiqueta=x]
// Needs MMS_DIR and MONGOMS_SYSTEM_BINARY. Earlier evidence folders are protected by preservar-salidas.cjs.
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const repo = path.resolve(__dirname, "../../../..");
const files = [
  ...["phase1.test.js", "phase2.test.js", "phase2-compatibility.test.js", "phase3.test.js", "phase4.test.js", "phase5.test.js", "phase5-corrections.test.js", "phase6.test.js"].map((f) => "backend/test/" + f),
  ...["cierre-fase2/independiente.test.js", "cierre-fase3/independiente.test.js", "cierre-fase4/independiente.test.js", "cierre-fase5/independiente.test.js", "cierre-fase5/revalidacion-evidencias/revalidacion.test.js", "cierre-fase6/independiente.test.js"].map((f) => "docs/auditoria-admin/" + f),
  "frontend/test/stock-adjustment.test.cjs", "frontend/test/admin-fields.test.cjs",
  "backend/test/phase7.test.js", "backend/test/sprint01.test.js", "backend/test/sprint07-finance-integrity.test.js", "backend/test/sprint08-config-users-audit.test.js",
  ...["checkout.test.js", "phase1-v2.test.js", "municipality-catalog.test.js", "review-list-query.test.js", "wompi-recovery.test.js", "wompi-return-limit.test.js", "wompi-sandbox-relay.test.js", "wompi-verification-diagnostics.test.js", "wompi-worker.test.js"].map((f) => "backend/test/" + f),
  "frontend/test/municipalities.test.cjs", "frontend/test/wompi-confirmation.test.cjs",
].filter((f) => fs.existsSync(path.join(repo, f)));
const label = (process.argv.find((a) => a.startsWith("--etiqueta=")) || "").slice(11);
const name = "regresion-node" + (label ? `-${label}` : "");
const log = fs.openSync(path.join(__dirname, `${name}.txt`), "w"), start = Date.now();
const child = spawn(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", "--require", path.join(__dirname, "preservar-salidas.cjs"), "--test", "--test-concurrency=1", "--test-reporter=spec", ...files], { cwd: repo, env: process.env, windowsHide: true, stdio: ["ignore", log, log] });
child.on("exit", (code) => {
  fs.closeSync(log);
  const text = fs.readFileSync(path.join(__dirname, `${name}.txt`), "utf8");
  const count = (k) => Number((text.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1] || 0);
  const failed = [...text.matchAll(/^\s*✖ (.+?)(?: \(\d+(?:\.\d+)?ms\))?$/gm)].map((m) => m[1]).filter((t, i, a) => a.indexOf(t) === i);
  fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify({ exitCode: code, tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped"), failed, files, ms: Date.now() - start }, null, 2));
  console.log(`${name} exit ${code} · tests ${count("tests")} · pass ${count("pass")} · fail ${count("fail")}`);
  process.exitCode = code;
});
