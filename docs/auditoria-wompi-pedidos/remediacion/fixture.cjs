const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const original = path.resolve(__dirname, '../evidencias/auditoria-wompi.cjs');
const mod = new Module(original, module);
mod.filename = original; mod.paths = Module._nodeModulePaths(path.dirname(original));
// Reuse only setup/helpers; all original scenarios and assertions remain intact.
const source = fs.readFileSync(original, 'utf8').split('main().catch(')[0]
  .replace('const ev = signEvent(tx, opts);', 'provider.tx.set(tx.id, { ...(provider.tx.get(tx.id) || tx), status: tx.status }); const ev = signEvent(tx, opts);');
mod._compile(source + `
module.exports = { setup, api, newWompi, linkTx, postEvent, fresh, stockOf, canPrepare, provider,
  get M() { return M; }, get cookies() { return cookies; }, get users() { return users; }, failpoint,
  async close() { if(server) await new Promise(r=>server.close(r)); await mongoose.disconnect(); if(mongod) await mongod.stop(); }
};`, original);
module.exports = mod.exports;
