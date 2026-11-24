"use strict";
// Redirects writes that earlier test suites make inside docs/auditoria-admin (repo path
// dizor/docs or the real path Dizor/docs) to evidencias-sprint-04/regresion/, so no earlier
// evidence is overwritten. Writes inside this sprint folder are kept.
const fs = require("node:fs"), path = require("node:path");
const own = __dirname, repoAudit = path.resolve(__dirname, "../.."), realAudit = path.resolve(__dirname, "../../../../../docs/auditoria-admin");
const mine = path.join("rediseño-premium", "evidencias-sprint-04");
const inside = (file, dir) => { const r = path.relative(dir, file); return r && !r.startsWith("..") && !path.isAbsolute(r) ? r : null; };
function dest(file) {
  if (typeof file !== "string") return file;
  const absolute = path.resolve(file);
  for (const root of [repoAudit, realAudit]) {
    const rel = inside(absolute, root); if (!rel) continue;
    if (rel === mine || rel.startsWith(mine + path.sep)) return file;
    const target = path.join(own, "regresion", rel); fs.mkdirSync(path.dirname(target), { recursive: true }); return target;
  }
  return file;
}
const write = fs.writeFileSync.bind(fs), asyncWrite = fs.promises.writeFile.bind(fs.promises), open = fs.openSync.bind(fs), unlink = fs.unlinkSync.bind(fs), append = fs.appendFileSync.bind(fs), cp = fs.copyFileSync.bind(fs), stream = fs.createWriteStream.bind(fs);
fs.writeFileSync = (file, ...a) => write(dest(file), ...a);
fs.promises.writeFile = (file, ...a) => asyncWrite(dest(file), ...a);
fs.openSync = (file, flags, ...a) => open(typeof flags === "string" && /[wa+]/.test(flags) ? dest(file) : file, flags, ...a);
fs.appendFileSync = (file, ...a) => append(dest(file), ...a);
fs.copyFileSync = (from, to, ...a) => cp(from, dest(to), ...a);
fs.createWriteStream = (file, ...a) => stream(dest(file), ...a);
fs.unlinkSync = (file) => { const target = dest(file); if (target !== file && !fs.existsSync(target)) return; return unlink(target); };
