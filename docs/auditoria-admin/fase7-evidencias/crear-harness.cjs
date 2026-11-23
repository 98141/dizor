const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
let source=fs.readFileSync(path.join(root,'frontend/test/admin-polish-next-browser.cjs'),'utf8');
source=source.replaceAll('docs/auditoria-admin/fase6-evidencias','docs/auditoria-admin/fase7-evidencias').replaceAll('dizor-phase6-next-','dizor-phase7-next-').replaceAll('build-fase6','build-fase7').replace("require('./helpers/adminPolishBrowserFlow.cjs')","require('./helpers/phase7BrowserFlow.cjs')");
fs.writeFileSync(path.join(root,'frontend/test/phase7-next-browser.cjs'),source);
