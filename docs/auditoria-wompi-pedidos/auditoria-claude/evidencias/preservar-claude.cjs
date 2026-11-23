// Precarga de la auditoría independiente: desvía cualquier escritura bajo docs/
// (informes históricos, evidencias previas, carpeta de remediación) hacia
// auditoria-claude/evidencias/salidas/<CLAUDE_RUN>/. No toca código ni aserciones.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const own = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'salidas', process.env.CLAUDE_RUN || 'sin-nombre');
for (const name of ['writeFileSync', 'appendFileSync']) {
  const original = fs[name];
  fs[name] = function (file, ...args) {
    if (typeof file === 'string') {
      const absolute = path.resolve(file);
      if (absolute.startsWith(path.join(root, 'docs') + path.sep) && !absolute.startsWith(own + path.sep)) {
        file = path.join(out, path.relative(root, absolute));
        fs.mkdirSync(path.dirname(file), { recursive: true });
      }
    }
    return original.call(this, file, ...args);
  };
}
