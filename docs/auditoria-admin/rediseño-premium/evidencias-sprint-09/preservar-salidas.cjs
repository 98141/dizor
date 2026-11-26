"use strict";
// Sprint 09 · same redirector as evidencias-sprint-01: writes that earlier-phase tests make inside
// docs/auditoria-admin (repo copy or the outer Dizor/docs copy) go to evidencias-sprint-09/regresion/,
// so earlier evidence is never overwritten. Writes inside this sprint folder are kept.
const fs = require("node:fs"), path = require("node:path");
const own = __dirname;
const roots = [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../../../../docs/auditoria-admin")];
const inside = (file, dir) => { const r = path.relative(dir, file); return !!r && !r.startsWith("..") && !path.isAbsolute(r) ? r : null; };
function dest(file) {
  if (typeof file !== "string" && !(file instanceof URL)) return file;
  const absolute = path.resolve(file instanceof URL ? file.pathname.replace(/^\/([A-Za-z]:)/, "$1") : file);
  if (inside(absolute, own)) return file;
  for (const root of roots) {
    const rel = inside(absolute, root); if (!rel) continue;
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
try { const fsp = require("node:fs/promises"); if (fsp.writeFile !== fs.promises.writeFile) fsp.writeFile = fs.promises.writeFile; } catch { /* same object */ }
