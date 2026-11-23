// Mantiene el archivo F original y todas sus aserciones. Agrega la decisión nueva solo en F32.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const original=path.resolve(__dirname,'../../auditoria-cierre-residuales/evidencias/adversarial-cierre.test.cjs'),source=fs.readFileSync(original,'utf8');
const needle='await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) }); const after = pay(await alerts());';
if(source.split(needle).length!==2)throw Error('Cambió F32; revisar adaptación');
const action=`await archive(c.r, { reason: REASON, evidenceReceiptId: String(c.proof._id) });
  const conclusion = await f.api('POST', '/api/admin/orders/payment-events/' + c.r._id + '/conclude-follow-up', {cookie: f.cookies.admin, body: {reason: 'Contradicción investigada, pago aplicado y pedido sin incidencias'}});
  assert.equal(conclusion.status, 200, 'Conclusión explícita auditada'); const after = pay(await alerts());`;
fs.writeFileSync(path.join(__dirname,'f-variante-origen.json'),JSON.stringify({original,sha256:crypto.createHash('sha256').update(source).digest('hex'),assertionsChanged:0,flowChanges:1,action},null,2));
const mod=new Module(original,module);mod.filename=original;mod.paths=Module._nodeModulePaths(path.dirname(original));mod._compile(source.replace(needle,action),original);
