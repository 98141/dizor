const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const root = path.resolve(__dirname, "../../..");
const original = path.join(root, "docs/auditoria-admin/cierre-fase1/independiente.test.js");
const mod = new Module(original, module);
mod.filename = original; mod.paths = Module._nodeModulePaths(path.dirname(original));
// Fixture reuse only. No independent test, migration probe or standalone runs.
mod.require = (name) => name === "node:test" ? () => {} : Module.prototype.require.call(mod, name);
mod._compile(fs.readFileSync(original, "utf8") + `
module.exports = {
  setup, api, makeProduct, orderBody, postEvent, txFor, stockOf,
  setProviderTransaction(tx) { providerTx.set(tx.id, structuredClone(tx)); },
  get context() { return { Order, Product, User, ProductHistory, mongoose, base, adminCookie, vendorCookie, clientCookie, superCookie, clientId, blocked }; },
  async close() {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); if (mongod) await mongod.stop();
  },
};`, original);
module.exports = mod.exports;
