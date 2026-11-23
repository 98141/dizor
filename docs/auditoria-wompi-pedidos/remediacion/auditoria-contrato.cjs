// Original assertions, augmented simulated provider contract only.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const original = path.resolve(__dirname, '../evidencias/auditoria-wompi.cjs');
const mod = new Module(original, module); mod.filename = original; mod.paths = Module._nodeModulePaths(path.dirname(original));
const source = fs.readFileSync(original, 'utf8').replace('const data = { transaction: tx };',
  'provider.tx.set(tx.id, { ...(provider.tx.get(tx.id) || tx), status: tx.status }); const data = { transaction: tx };');
mod._compile(source, original);
