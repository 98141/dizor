"use strict";
const fs = require("node:fs");
const path = require("node:path");
const here = __dirname;
const audit = path.resolve(here, "../..");
function dest(file) {
  if (typeof file !== "string") return file;
  const absolute = path.resolve(file);
  if (absolute === here || absolute.startsWith(here + path.sep)) return file;
  const marker = "fase7-evidencias";
  const index = absolute.lastIndexOf(marker);
  if (index !== -1) {
    const rest = absolute.slice(index + marker.length).replace(/^[/\\]/, "");
    const target = path.join(here, "reproduccion", rest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    return target;
  }
  const relative = path.relative(audit, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return file;
  const target = path.join(here, "regresion", relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}
const write = fs.writeFileSync.bind(fs);
const asyncWrite = fs.promises.writeFile.bind(fs.promises);
const open = fs.openSync.bind(fs);
const append = fs.appendFileSync.bind(fs);
fs.writeFileSync = (file, ...args) => write(dest(file), ...args);
fs.promises.writeFile = (file, ...args) => asyncWrite(dest(file), ...args);
fs.openSync = (file, flags, ...args) => open(typeof flags === "string" && /[wa+]/.test(flags) ? dest(file) : file, flags, ...args);
fs.appendFileSync = (file, ...args) => append(dest(file), ...args);
