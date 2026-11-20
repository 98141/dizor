"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const source = path.join(root, "frontend");
const tempRoot = fs.realpathSync(os.tmpdir());
const stage = fs.mkdtempSync(path.join(tempRoot, "dizor-cierre-build-"));
const out = path.join(__dirname, "correcciones-build.txt");
let result;
try {
  fs.cpSync(source, stage, { recursive: true, filter: (file) => {
    const name = path.basename(file);
    return !["node_modules", ".next", ".git", "test"].includes(name) && !name.startsWith(".env");
  } });
  fs.symlinkSync(path.join(source, "node_modules"), path.join(stage, "node_modules"), "junction");
  const guard = path.join(stage, "offline.cjs");
  fs.writeFileSync(guard, `
    const net = require("node:net");
    globalThis.fetch = async () => { throw new Error("Build aislado: HTTP deshabilitado"); };
    const connect = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function (...args) {
      const value = args[0];
      if (typeof value === "string" && value.startsWith("\\\\\\\\.\\\\pipe\\\\")) return connect.apply(this, args);
      if (value && typeof value === "object" && value.path) return connect.apply(this, args);
      throw new Error("Build aislado: TCP deshabilitado");
    };
  `);
  const env = {};
  for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"]) {
    if (process.env[name]) env[name] = process.env[name];
  }
  Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:9/api", NODE_OPTIONS: `--require=${JSON.stringify(guard)}` });
  result = spawnSync(process.execPath, [path.join(source, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
    cwd: stage, env, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 240000,
  });
  fs.writeFileSync(out, `${result.stdout || ""}\n${result.stderr || ""}\n${result.error?.message || ""}`);
  fs.writeFileSync(path.join(__dirname, "correcciones-build.json"), JSON.stringify({
    exitCode: result.status, signal: result.signal, isolatedCopy: true, envFilesCopied: false,
    inheritedCredentials: false, network: "fetch/TCP blocked", compiler: "Next.js --webpack",
  }, null, 2));
  process.stdout.write(`Build aislado: salida ${result.status}. Evidencia: ${out}\n`);
} finally {
  // The junction must be removed before deleting our own temporary build tree.
  const junction = path.join(stage, "node_modules");
  if (fs.existsSync(junction)) {
    if (!fs.lstatSync(junction).isSymbolicLink()) throw new Error("Se esperaba una junction, no un directorio compartido");
    fs.unlinkSync(junction);
  }
  const target = fs.realpathSync(stage);
  if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith("dizor-cierre-build-")) throw new Error("Destino temporal inesperado");
  fs.rmSync(target, { recursive: true, force: true });
}
process.exitCode = result?.status === 0 ? 0 : 1;
