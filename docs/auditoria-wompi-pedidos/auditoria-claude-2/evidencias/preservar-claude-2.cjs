// Precarga de la segunda auditoría independiente (auditoria-claude-2).
// Desvía cualquier escritura bajo <AUD_ROOT>/docs (informes históricos,
// evidencias previas, auditorías y remediaciones anteriores) hacia
// auditoria-claude-2/evidencias/salidas/<CLAUDE_RUN>/ del repositorio.
// AUD_ROOT es la raíz del árbol que se prueba: la exportación aislada de
// 23ce3a6 o el propio repositorio. No toca código, pruebas ni aserciones.
const fs = require('node:fs');
const path = require('node:path');
// Normaliza rutas cortas 8.3 de Windows (p. ej. ASUSEX~1) y mayúsculas: sin esto
// una ruta larga escrita por las pruebas no coincide con la raíz y no se desvía.
const real = (p) => { const abs = path.resolve(p); let dir = abs, rest = '';
  while (!fs.existsSync(dir) && path.dirname(dir) !== dir) { rest = path.join(path.basename(dir), rest); dir = path.dirname(dir); }
  return path.join(fs.realpathSync.native(dir), rest).toLowerCase(); };
const own = real(path.resolve(__dirname, '..'));
const root = real(process.env.AUD_ROOT || path.resolve(__dirname, '../../../..'));
const out = path.join(__dirname, 'salidas', process.env.CLAUDE_RUN || 'sin-nombre');
const redirected = [];
for (const name of ['writeFileSync', 'appendFileSync', 'writeFile', 'appendFile']) {
  const original = fs[name];
  fs[name] = function (file, ...args) {
    if (typeof file === 'string') {
      const absolute = real(file);
      if (absolute.startsWith(path.join(root, 'docs') + path.sep) && !absolute.startsWith(own + path.sep)) {
        file = path.join(out, path.relative(root, absolute));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        redirected.push(path.relative(root, absolute));
      }
    }
    return original.call(this, file, ...args);
  };
}
process.on('exit', () => {
  if (redirected.length) process.stderr.write(`[preservar-claude-2] escrituras desviadas: ${[...new Set(redirected)].join(', ')}\n`);
});
