"use strict";
// Desvía las escrituras de las evidencias de Fase 6 hacia el cierre independiente.
const fs = require("node:fs");
const path = require("node:path");
const from = path.resolve(__dirname, "../fase6-evidencias");
const to = path.resolve(__dirname, "reproduccion");
function dest(file) {
  if (typeof file !== "string") return file;
  const absolute = path.resolve(file);
  const relative = path.relative(from, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return file;
  const target = path.join(to, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}
const write = fs.writeFileSync.bind(fs);
const asyncWrite = fs.promises.writeFile.bind(fs.promises);
const open = fs.openSync.bind(fs);
fs.writeFileSync = (file, ...args) => write(dest(file), ...args);
fs.promises.writeFile = (file, ...args) => asyncWrite(dest(file), ...args);
fs.openSync = (file, ...args) => open(dest(file), ...args);
