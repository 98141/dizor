"use strict";
// Sprint 08 · runs an unmodified earlier browser suite with ONE in-memory substitution:
// the heading "Movimientos e historial" was removed from the product screen by commit 38fee86
// (Sprints 3–4), so navigation P08 and the F6 route loop stop there before reaching Configuración,
// Usuarios and Auditoría. The files on disk are not changed; each file is compiled at its own path
// (relative requires keep working), exactly as backend/test/helpers/phase2Fixture.cjs does.
// Usage from dizor/: node --require <preservar-salidas.cjs> <this file> navegacion|fase6
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const repo = path.resolve(__dirname, "../../../..");
const MOVES = ["Movimientos e historial", "Historial de ventas, ajustes y cambios"]; // CatalogWorkspace.jsx, title of view=movements
// "fase6-continuar" only: F6 aborts at its global axe assertion (A23) because of Products/Stock/Movements/
// Taxonomy/Finance screens, before A05–A07 (users). The assertion is replaced by a record of the failing
// screens and the check is printed as NOT passed, so nothing is reported as approved that was not.
const AXE = ["assert.deepEqual(result.axe.filter(r=>r.violations.length),[],'axe WCAG A/AA no debe detectar infracciones en las pantallas inspeccionadas');check('A23 axe-core 4.11.4: WCAG 2/2.1/2.2 A y AA, 58 revisiones');",
  "result.sprint08AxeNoSuperada=result.axe.filter(r=>r.violations.length).map(r=>r.name+'@'+r.width);if(result.sprint08AxeNoSuperada.length)process.stdout.write('A23 NO SUPERADA (registrada por Sprint 08): '+result.sprint08AxeNoSuperada.join(', ')+'\\n');else check('A23 axe-core 4.11.4: WCAG 2/2.1/2.2 A y AA, 58 revisiones');"];
const A19 = ["assert.deepEqual(result.accessibility.filter(a=>a.contrast.text.length||a.contrast.controls.length||a.unnamedButtons),[]);check('A19 contraste básico calculado y árbol accesible de Chrome sin botones sin nombre en 58 revisiones');",
  "result.sprint08A19NoSuperada=result.accessibility.filter(a=>a.contrast.text.length||a.contrast.controls.length||a.unnamedButtons).map(a=>a.name+'@'+a.width);if(result.sprint08A19NoSuperada.length)process.stdout.write('A19 NO SUPERADA (registrada por Sprint 08): '+result.sprint08A19NoSuperada.join(', ')+'\\n');else check('A19 contraste básico calculado y árbol accesible de Chrome sin botones sin nombre en 58 revisiones');"];
const A25 = ["assert.equal(await page.$eval('button.auth-submit',e=>getComputedStyle(e).backgroundColor),'rgb(26, 26, 26)');check('A25 acción principal diferenciada: color de marca, texto legible y tamaño táctil');",
  "result.sprint08A25Color=await page.$eval('button.auth-submit',e=>getComputedStyle(e).backgroundColor);if(result.sprint08A25Color!=='rgb(26, 26, 26)')process.stdout.write('A25 NO SUPERADA (registrada por Sprint 08): color '+result.sprint08A25Color+'\\n');else check('A25 acción principal diferenciada: color de marca, texto legible y tamaño táctil');"];
const flow = "frontend/test/helpers/adminPolishBrowserFlow.cjs", interactions = "frontend/test/helpers/adminPolishInteractions.cjs";
const suites = {
  navegacion: { entry: "frontend/test/navigation-next-browser.cjs", patched: { "frontend/test/navigation-next-browser.cjs": [[MOVES, 2]] } },
  fase6: { entry: "frontend/test/admin-polish-next-browser.cjs", patched: { [flow]: [[MOVES, 1]] } },
  "fase6-continuar": { entry: "frontend/test/admin-polish-next-browser.cjs", patched: { [flow]: [[MOVES, 1]], [interactions]: [[AXE, 1], [A19, 1], [A25, 1]] } },
};
const suite = suites[process.argv[2]];
if (!suite) throw new Error("Suite: navegacion | fase6 | fase6-continuar");
const expected = new Map(Object.entries(suite.patched).map(([f, list]) => [path.join(repo, f), list]));
const applied = {};
const original = Module._extensions[".js"];
const load = function (module, filename) {
  const list = expected.get(path.resolve(filename));
  if (list === undefined) return original(module, filename);
  let source = fs.readFileSync(filename, "utf8");
  for (const [[from, to], want] of list) {
    const count = source.split(from).length - 1;
    if (count !== want) throw new Error(`${filename}: ${count} apariciones, se esperaban ${want}`);
    applied[`${path.relative(repo, filename)} :: ${from.slice(0, 60)}`] = count;
    source = source.split(from).join(to);
  }
  return module._compile(source, filename);
};
Module._extensions[".js"] = load;
if (Module._extensions[".cjs"]) Module._extensions[".cjs"] = load;
process.on("exit", () => fs.writeFileSync(path.join(__dirname, `derivada-${process.argv[2]}.json`), JSON.stringify({ suite: suite.entry, substitutions: Object.fromEntries(Object.entries(suite.patched).map(([f, l]) => [f, l.map(([[from, to]]) => ({ from, to }))])), applied, exitCode: process.exitCode ?? 0 }, null, 2)));
require(path.join(repo, suite.entry));
