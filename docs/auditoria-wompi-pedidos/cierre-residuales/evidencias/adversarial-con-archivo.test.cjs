// Variante explícita del flujo: aserciones de Claude intactas; NO reemplaza el original.
// Solo agrega la nueva acción administrativa en D04b/D19b antes de consultar la bandeja.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const original=path.resolve(__dirname,'../../auditoria-claude-2/evidencias/adversarial-2.test.cjs');
const source=fs.readFileSync(original,'utf8');
const needle='const quedan = (await inbox()).filter((e) => e._id === String(r._id));';
if(source.split(needle).length!==3)throw Error('La prueba original cambió; revisar adaptación explícita.');
const action=`const trustedReceipt = await f.M.PaymentEvent.findOne({ transactionId: r.transactionId, source: 'provider_query', processedAt: { $ne: null } }).lean();
  const archiveResult = await f.api('POST', '/api/admin/orders/payment-events/' + r._id + '/archive', { cookie: f.cookies.admin,
    body: { reason: 'Contradicción investigada; cierre administrativo con evidencia autenticada', evidenceReceiptId: String(trustedReceipt._id) } });
  assert.equal(archiveResult.status, 200, 'La decisión de archivo explícito debe quedar auditada');
  `;
fs.writeFileSync(path.join(__dirname,'variante-archivo-origen.json'),JSON.stringify({original,sha256:crypto.createHash('sha256').update(source).digest('hex'),insertions:2,assertionsChanged:0,insertedAction:action},null,2));
const mod=new Module(original,module);mod.filename=original;mod.paths=Module._nodeModulePaths(path.dirname(original));mod._compile(source.replaceAll(needle,action+needle),original);
