"use strict";
// SHA-256 of every file under both audit roots (repo dizor/docs and real Dizor/docs), excluding
// this sprint folder and temporary junctions. `base` writes the baseline; `check` compares.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const roots = { repo: path.resolve(__dirname, "../.."), real: path.resolve(__dirname, "../../../../../docs/auditoria-admin") }, out = {};
for (const [name, root] of Object.entries(roots)) (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name), rel = path.relative(root, p);
  if (rel.startsWith(path.join("rediseño-premium", "evidencias-sprint-04"))) continue; if (name === "repo" && fs.lstatSync(p).isSymbolicLink()) continue;
  if (e.isDirectory() || (fs.lstatSync(p).isSymbolicLink() && fs.statSync(p).isDirectory())) { if (name === "repo" && /^cierre-fase\d$/.test(rel)) continue; walk(p); } else out[`${name}:${rel.split(path.sep).join("/")}`] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); } })(root);
const file = path.join(__dirname, "baseline-docs-sha256.json");
if (process.argv[2] === "base") { fs.writeFileSync(file, JSON.stringify(out)); console.log(`${Object.keys(out).length} archivos en línea base`); }
else { const base = JSON.parse(fs.readFileSync(file, "utf8")); const changed = Object.keys(base).filter((k) => base[k] !== out[k]), added = Object.keys(out).filter((k) => !(k in base));
  fs.writeFileSync(path.join(__dirname, "preservacion-docs.json"), JSON.stringify({ compared: Object.keys(base).length, changed, added }, null, 2)); console.log(JSON.stringify({ compared: Object.keys(base).length, changed: changed.length, added: added.length })); }
