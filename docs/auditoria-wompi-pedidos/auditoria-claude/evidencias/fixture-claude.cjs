// Cargador independiente: reutiliza el arnés aislado de la auditoría original
// (Mongo en memoria con replica set, Wompi simulado, red externa bloqueada)
// SIN el adaptador de Codex que copia el estado del evento al proveedor simulado.
// Aquí cada prueba decide explícitamente qué responde GET /v1/transactions/{id}.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const original = path.resolve(__dirname, '../../evidencias/auditoria-wompi.cjs');
const mod = new Module(original, module);
mod.filename = original; mod.paths = Module._nodeModulePaths(path.dirname(original));
const source = fs.readFileSync(original, 'utf8').split('main().catch(')[0];
mod._compile(source + `
module.exports = { setup, api, login, newWompi, makeProduct, createOrder, orderBody, linkTx, postEvent, signEvent, fresh, stockOf, canPrepare, provider,
  get M() { return M; }, get cookies() { return cookies; }, get users() { return users; }, failpoint, mongoose,
  async close() { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); if (mongod) await mongod.stop(); }
};`, original);
module.exports = mod.exports;
