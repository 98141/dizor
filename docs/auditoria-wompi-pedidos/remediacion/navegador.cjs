// Reuse the historical real Next/Express/Chrome flow, changing only evidence destination.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const original = path.resolve(__dirname, '../../../frontend/test/phase7-next-browser.cjs');
const mod = new Module(original, module); mod.filename = original; mod.paths = Module._nodeModulePaths(path.dirname(original));
const folder=process.env.REMEDIATION_UI === '1' ? 'navegador-remediacion' : 'navegador';
let source = fs.readFileSync(original, 'utf8').replace("out=path.join(root,'docs/auditoria-admin/fase7-evidencias')", `out=path.join(root,'docs/auditoria-wompi-pedidos/remediacion/evidencias/${folder}')`);
if (process.env.REMEDIATION_UI === '1') source = source.replace(' }finally{', ` await require(${JSON.stringify(path.join(__dirname,'flujo-remediacion.cjs'))})({page,fixture,ctx,origin,out,result,cookie,text,goto,click,check});\n }finally{`);
mod._compile(source, original);
