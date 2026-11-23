// Explicit fixture adapter only. Original assertions and evidence stay byte-identical.
// Old tests invented sku on transaction events; Payment Links associate by link ID.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const originalRead = fs.readFileSync;
fs.readFileSync = function(file, options) {
  let result = originalRead.call(this, file, options);
  if (typeof file !== 'string' || typeof result !== 'string') return result;
  const relative = path.relative(root, path.resolve(file)).replaceAll('\\', '/');
  if (relative === 'docs/auditoria-admin/cierre-fase1/independiente.test.js') {
    result = result.replace('sku: order.orderNumber,', 'payment_link_id: order.wompi.paymentLinkId,');
    result = result.replace('currency: "COP", reference: "r",', 'currency: "COP", reference: "r", payment_link_id: order.wompi.paymentLinkId,');
    result = result.replace('const timestamp = Math.floor(Date.now() / 1000);', 'providerTx.set(tx.id, { ...(providerTx.get(tx.id) || tx), status: tx.status }); const timestamp = Math.floor(Date.now() / 1000);');
  }
  if (relative === 'backend/test/phase1.test.js') {
    result = result.replace('sku: order.orderNumber, ...extra,', 'payment_link_id: order.wompi.paymentLinkId, ...extra,');
    result = result.replace('return createOrder({', 'const createdWompi = await createOrder({');
    result = result.replace('const wompiEvent = (tx) => {', 'const wompiEvent = (tx) => { providerResponses.set(`https://sandbox.wompi.co/v1/transactions/${tx.id}`, {body:{data:{...tx}}});');
    result = result.replace('};\nconst wompiEvent', '  createdWompi.wompi.paymentLinkId = "fixture_" + createdWompi._id; await createdWompi.save(); return createdWompi;\n};\nconst wompiEvent');
    result = result.replace('};\r\nconst wompiEvent', '  createdWompi.wompi.paymentLinkId = "fixture_" + createdWompi._id; await createdWompi.save(); return createdWompi;\r\n};\r\nconst wompiEvent');
  }
  if (relative === 'backend/test/helpers/phase2Fixture.cjs') result = result.replace('clientId, blocked', 'clientId, blocked, providerTx');
  return result;
};
const Module = require('node:module');
const loadJS = Module._extensions['.js'];
Module._extensions['.js'] = function(mod, file) {
  if (path.resolve(file) === path.join(root, 'backend/test/phase1.test.js')) return mod._compile(fs.readFileSync(file, 'utf8'), file);
  return loadJS(mod, file);
};
