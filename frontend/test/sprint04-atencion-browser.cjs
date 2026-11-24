"use strict";
// Sprint 04 (Atención al cliente + botones): real pages/components, AdminShell, RoleRoute and the
// real admin stylesheets, bundled in an isolated temp folder. API = local fixture with fictitious
// data restricted to real backend types/statuses. No Next server, .env, MongoDB or network.
// DIZOR_SPRINT04_MODE=antes only captures the previous design.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const MODE = process.env.DIZOR_SPRINT04_MODE || "despues";
const out = path.join(process.env.DIZOR_SPRINT04_OUT || path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-04"), MODE === "antes" ? "antes" : "despues");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const F = require("./helpers/sprint04Fixtures.cjs");
// MODE=antes compiles the HEAD sources extracted with `git archive` (DIZOR_SPRINT04_SRC), never the work tree.
const srcRoot = process.env.DIZOR_SPRINT04_SRC || path.join(frontend, "src");
fs.mkdirSync(out, { recursive: true });
const tempRoot = fs.realpathSync(os.tmpdir()), stage = fs.mkdtempSync(path.join(tempRoot, "dizor-sprint04-ui-"));
const result = { mode: MODE, checks: [], externalRequests: [], pageErrors: [], consoleErrors: [], mutations: [], screenshots: [], measurements: [], buttonStyles: {} };
let browser, server;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [1440, 1024, 820, 390, 360];
(async () => {
 try {
  const w = (name, body) => { const file = path.join(stage, name); fs.writeFileSync(file, body); return file; };
  const loader = w("jsx.cjs", `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  const cssLoader = w("css.cjs", `module.exports=function(source){if(!this.resourcePath.endsWith('.module.css'))return 'module.exports={}';const prefix='m_'+require('path').basename(this.resourcePath).split('.')[0]+'_';const names=[...source.matchAll(/\\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map(m=>m[1]);return 'module.exports='+JSON.stringify(Object.fromEntries(names.map(n=>[n,prefix+n])));};`);
  const navigation = w("navigation.js", `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>{const s=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(s);};export const navigate=(url,replace)=>{history[replace?'replaceState':'pushState']({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:(u)=>navigate(u),replace:(u)=>navigate(u,true)});`);
  const link = w("link.jsx", `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,prefetch,scroll,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
  const image = w("image.jsx", `import React from 'react';export default function Image({src,alt,width,height,unoptimized,fill,priority,sizes,...p}){return <img src={src} alt={alt} width={width} height={height} {...p}/>}`);
  const auth = w("auth.js", `const role=()=>sessionStorage.getItem('role')||'admin';export const useAuth=()=>({user:{name:'Operadora ficticia',role:role()},loadingAuth:false,logout:async()=>{}});`);
  const site = w("site.js", `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  const api = w("api.js", `async function call(url,method='GET',data){const r=await fetch('/mock'+url,{method,headers:{'Content-Type':'application/json','X-Role':sessionStorage.getItem('role')||'admin'},...(data?{body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}
const qs=(p={})=>'?'+new URLSearchParams(Object.entries(p).filter(([,v])=>v!==undefined&&v!==null));
export const getAdminSpecialRequests=(p)=>call('/special-requests'+qs(p));export const getAdminSpecialRequest=(id)=>call('/special-requests/'+id);
export const updateSpecialRequestStatus=(id,b)=>call('/special-requests/'+id+'/status','PATCH',b);export const updateSpecialRequestQuote=(id,b)=>call('/special-requests/'+id+'/quote','PATCH',b);
export const adminListCustomerRequests=(p)=>call('/pqr'+qs(p));export const adminGetCustomerRequest=(id)=>call('/pqr/'+id);export const adminUpdateCustomerRequestStatus=(id,b)=>call('/pqr/'+id+'/status','PATCH',b);
export const getAlerts=()=>call('/alerts');`);
  const src = (p) => JSON.stringify(path.join(srcRoot, p));
  const entry = w("entry.jsx", `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from './navigation';
import Shell from ${src("components/admin/AdminShell.jsx")};import Confirm from ${src("components/admin/AdminConfirmModal.jsx")};
import Solicitudes from ${src("app/admin/solicitudes/page.js")};import Detalle from ${src("app/admin/solicitudes/[id]/page.js")};import Pqr from ${src("app/admin/pqr/page.js")};
function Gallery(){const [busy,setBusy]=useState(false),[open,setOpen]=useState(false),[log,setLog]=useState('');return <div className="admin-page"><h1 className="admin-page__title">Muestras de botones</h1>
<section className="order-detail-card" aria-label="Formulario"><h2>Formulario</h2><div className="gallery-row"><button type="button" className="admin-btn admin-btn--primary" id="g-primary">Guardar cambios</button><button type="button" className="admin-btn" id="g-secondary">Cancelar</button><button type="button" className="admin-btn admin-btn--tertiary" id="g-tertiary">Volver</button><button type="button" className="admin-btn admin-btn--danger" id="g-danger">Eliminar producto</button></div></section>
<section className="order-detail-card" aria-label="Fila"><h2>Acciones de fila</h2><div className="gallery-row"><button type="button" className="admin-btn admin-btn--sm" id="g-sm">Editar</button><button type="button" className="admin-btn admin-btn--sm admin-btn--danger" id="g-sm-danger">Eliminar</button><a className="admin-btn admin-btn--sm" href="/admin/pedidos" id="g-link">Ver movimientos</a><button type="button" id="g-classless">Consultar</button></div></section>
<section className="order-detail-card" aria-label="Estados"><h2>Estados</h2><div className="gallery-row"><button type="button" className="admin-btn admin-btn--primary" disabled id="g-disabled-primary">Confirmar ajuste</button><button type="button" className="admin-btn" disabled id="g-disabled">Exportar</button><button type="button" className="admin-btn admin-btn--primary" aria-busy={busy} disabled={busy} id="g-busy" onClick={()=>{setBusy(true);setLog(l=>l+'x');setTimeout(()=>setBusy(false),900);}}>Guardar cambios</button><button type="button" className="admin-btn" aria-busy="true" disabled id="g-busy-secondary">Actualizar</button></div><p id="g-log">{log}</p></section>
<section className="order-detail-card" aria-label="Clases existentes"><h2>Otras clases existentes</h2><div className="op-orders gallery-row"><button type="button" className="op-btn" id="g-op">Exportar</button><button type="button" className="op-btn op-btn--primary" id="g-op-primary">Aplicar filtros</button></div><div className="dz-page gallery-row"><button type="button" className="dz-btn dz-btn--primary" id="g-dz-primary">Actualizar resumen</button><a className="dz-btn" href="/admin/pedidos" id="g-dz">Ver pedidos</a></div></section>
<section className="order-detail-card" aria-label="Diálogo"><h2>Diálogo de confirmación</h2><button type="button" className="admin-btn admin-btn--danger" id="g-open-modal" onClick={()=>setOpen(true)}>Eliminar categoría</button><Confirm isOpen={open} title="Eliminar categoría" message="Esta acción no se puede deshacer." onCancel={()=>setOpen(false)} onConfirm={()=>{setLog(l=>l+'c');setOpen(false);}}/></section></div>;}
function App(){const p=usePathname();if(p==='/admin/solicitudes')return <Solicitudes/>;if(p.startsWith('/admin/solicitudes/'))return <Detalle params={Promise.resolve({id:p.split('/').pop()})}/>;if(p==='/admin/pqr')return <Pqr/>;if(p==='/admin/muestras-botones')return <Shell variant="admin"><Gallery/></Shell>;return <Shell variant="admin"><div className="admin-page"><h1>Destino de prueba</h1><p data-destination>{p+location.search}</p></div></Shell>;}
const el=document.getElementById('app');const root=createRoot(el);root.render(<React.Suspense fallback={<p>Cargando…</p>}><App/></React.Suspense>);`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, performance: { hints: false },
    resolve: { extensions: [".js", ".jsx", ".mjs", ".json"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "next/image": image,
      "@/services/specialRequestAdminService": api, "@/services/customerRequestService": api, "@/services/adminAlertService": api,
      "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@": srcRoot } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve(); }));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  // The exact sheets of app/layout.js + app/admin/layout.js, in the same order (missing ones are skipped in MODE=antes).
  const layout = fs.readFileSync(path.join(srcRoot, "app/admin/layout.js"), "utf8");
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", ...[...layout.matchAll(/@\/(styles\/[^"]+\.css)/g)].map((m) => m[1])];
  result.sheets = sheets;
  const css = sheets.map((file) => fs.readFileSync(path.join(srcRoot, file), "utf8")).join("\n") + "\n.gallery-row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:.6rem}";
  let special = F.specialRequests(), pqr = F.customerRequests();
  const scenario = { emptyRequests: false, emptyPqr: false, failRequests: 0, failPqr: 0, failDetail: 0, slowMutation: 0, slowList: 0 };
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    if (url.pathname.startsWith("/mock")) {
      res.setHeader("Content-Type", "application/json");
      const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)); };
      const role = req.headers["x-role"], q = url.searchParams, parts = url.pathname.split("/").slice(2);
      let body = ""; for await (const c of req) body += c; const data = body ? JSON.parse(body) : {};
      if (req.method !== "GET") { result.mutations.push({ method: req.method, path: url.pathname.slice(5), role, body: data, at: Date.now() }); if (scenario.slowMutation) await delay(scenario.slowMutation); }
      if (parts[0] === "alerts") return send({ alerts: {}, totalCount: 0 });
      if (parts[0] === "special-requests") {
        if (!["admin", "superadmin", "vendedor"].includes(role)) return send({ message: "No autorizado" }, 403);
        if (parts.length === 1) {
          if (scenario.slowList) await delay(scenario.slowList);
          if (scenario.failRequests) { scenario.failRequests--; return send({ message: "Fallo de prueba" }, 503); }
          const text = (q.get("q") || "").toLowerCase();
          const rows = (scenario.emptyRequests ? [] : special).filter((r) => (!q.get("type") || r.type === q.get("type")) && (!q.get("status") || r.status === q.get("status"))
            && (!text || [r.requestNumber, r.contact.name, r.contact.email, r.productName].some((v) => String(v).toLowerCase().includes(text))));
          const limit = Number(q.get("limit")) || 20, page = Number(q.get("page")) || 1;
          return send({ status: "success", total: rows.length, page, totalPages: Math.ceil(rows.length / limit) || 1,
            requests: rows.slice((page - 1) * limit, page * limit).map(({ id, requestNumber, type, status, contact, productName, estimatedQuantity, quotedAmount, createdAt }) => ({ id, requestNumber, type, status, contact, productName, estimatedQuantity, quotedAmount, createdAt })) });
        }
        const r = special.find((x) => x.id === parts[1]); if (!r) return send({ message: "Solicitud no encontrada" }, 404);
        if (req.method === "GET") { if (scenario.failDetail) { scenario.failDetail--; return send({ message: "Fallo" }, 503); } return send({ request: r }); }
        if (parts[2] === "status") { r.status = data.status; r.statusHistory.push({ status: data.status, note: data.note || "", changedAt: new Date().toISOString() }); return send({ request: r }); }
        if (parts[2] === "quote") { if (data.quotedAmount != null) { r.quotedAmount = data.quotedAmount; r.quotedAt = new Date().toISOString(); if (["pendiente", "en_revision"].includes(r.status)) { r.status = "cotizado"; r.statusHistory.push({ status: "cotizado", note: data.adminNotes || "Cotización enviada al cliente", changedAt: new Date().toISOString() }); } } if (data.adminNotes !== undefined) r.adminNotes = data.adminNotes; return send({ request: r }); }
      }
      if (parts[0] === "pqr") {
        if (!["admin", "superadmin"].includes(role)) return send({ message: "No autorizado" }, 403);
        if (parts.length === 1) {
          if (scenario.failPqr) { scenario.failPqr--; return send({ message: "Fallo local de carga PQR" }, 503); }
          const rows = (scenario.emptyPqr ? [] : pqr).filter((r) => (!q.get("category") || r.category === q.get("category")) && (!q.get("status") || r.status === q.get("status")));
          const page = Number(q.get("page")) || 1; return send({ status: "success", requests: rows.slice((page - 1) * 30, page * 30), total: rows.length, page });
        }
        const r = pqr.find((x) => x.id === parts[1]); if (!r) return send({ message: "Solicitud no encontrada" }, 404);
        if (req.method === "GET") return send({ request: r });
        r.status = data.status; r.history.push({ status: data.status, publicNote: data.publicNote || "", internalNote: data.internalNote || "", changedAt: new Date().toISOString() }); return send({ request: r });
      }
      return send({ message: "No encontrado" }, 404);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR · Sprint 04 aislado</title><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => result.pageErrors.push(e.stack || e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource: the server responded with a status of (403|404|503)/.test(m.text())) result.consoleErrors.push(m.text()); });
  await page.setRequestInterception(true);
  page.on("request", (r) => { if (r.url().startsWith(origin) || r.url().startsWith("data:")) r.continue(); else { result.externalRequests.push(r.url()); r.abort(); } });
  const text = async (s, timeout = 15000) => { try { await page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, s); } catch (error) { result.failure = { waiting: s, url: page.url(), body: await page.$eval("body", (e) => e.innerText) }; await page.screenshot({ path: path.join(out, "fallo-navegador.png"), fullPage: true }); throw error; } };
  const role = (r) => page.evaluate((r) => sessionStorage.setItem("role", r), r);
  const goto = async (url, ready) => { await page.goto(origin + url, { waitUntil: "domcontentloaded" }); await text(ready); await delay(200); };
  const shot = async (name, fullPage = true) => { await page.evaluate(() => scrollTo(0, 0)); await delay(80); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage }); result.screenshots.push(`${name}.png`); };
  const check = (label) => { result.checks.push(label); process.stdout.write(`ok - ${label}\n`); };
  const audit = () => page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth > innerWidth;
    const offenders = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".dz-sr-only"); }).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 50)}`);
    const covered = [];
    for (const el of document.querySelectorAll("main :is(h1,h2,h3,p,span,strong,a,button,dt,dd,li,td,th,label,legend,time)")) {
      if (covered.length > 5) break; if (el.closest(".dz-sr-only, thead")) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.color === "rgba(0, 0, 0, 0)") continue;
      const hit = document.elementFromPoint(Math.min(r.right - 2, r.left + 4), r.top + r.height / 2);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) covered.push({ text: el.textContent.trim().slice(0, 40), by: `${hit.tagName}.${String(hit.className).slice(0, 40)}` });
    }
    const section = document.querySelector(".cs-section"), thead = document.querySelector(".cs-table thead");
    const layout = section ? { section: Math.round(section.getBoundingClientRect().width), rem: parseFloat(getComputedStyle(document.documentElement).fontSize), thead: thead && getComputedStyle(thead).display } : null;
    return { docOverflow, offenders, covered, height: document.documentElement.scrollHeight, layout };
  });
  const sweep = async (name, url, ready, { assertOk = MODE !== "antes", before } = {}) => {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900 }); await goto(url, ready); if (before) await before(); await delay(200);
      const a = await audit(); result.measurements.push({ name, width, ...a });
      if (assertOk) { assert.equal(a.docOverflow, false, `${name} ${width}: ${a.offenders.join(", ")}`); assert.deepEqual(a.offenders, [], `${name} ${width}`); assert.deepEqual(a.covered, [], `${name} ${width}: texto tapado`); }
      await shot(`${name}-${width}`);
    }
    check(`${name}: ${WIDTHS.join("/")} px${assertOk ? " sin desbordamiento ni texto tapado" : ""}`);
  };
  const button = (label) => page.waitForFunction((l) => [...document.querySelectorAll("button,a")].find((e) => e.getClientRects().length && (e.textContent.trim() === l || e.getAttribute("aria-label") === l)), { timeout: 15000 }, label);
  const click = async (label) => { const h = await button(label); await h.click(); await h.dispose(); };
  const firstId = F.specialRequests()[0].id, wholesaleId = F.specialRequests()[1].id;
  await page.goto(origin + "/admin/muestras-botones", { waitUntil: "domcontentloaded" }); await role("admin");

  if (MODE === "antes") {
    await sweep("solicitudes", "/admin/solicitudes", "SOL-20261124-0001");
    scenario.emptyRequests = true; await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/solicitudes", "No hay solicitudes"); await shot("solicitudes-vacias-1440"); await page.setViewport({ width: 390, height: 900 }); await goto("/admin/solicitudes", "No hay solicitudes"); await shot("solicitudes-vacias-390"); scenario.emptyRequests = false;
    await sweep("detalle", `/admin/solicitudes/${firstId}`, "María Fernanda");
    await sweep("pqr", "/admin/pqr", "PQR-20261124-0001");
    scenario.emptyPqr = true; await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/pqr", "Sin solicitudes."); await shot("pqr-vacia-1440"); scenario.emptyPqr = false;
    await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/pqr", "PQR-20261124-0001"); await click("Ver"); await text("Registro del cambio"); await shot("pqr-detalle-1440");
    await page.setViewport({ width: 390, height: 900 }); await goto("/admin/pqr", "PQR-20261124-0001"); await click("Ver"); await text("Registro del cambio"); await shot("pqr-detalle-390");
    await sweep("botones", "/admin/muestras-botones", "Muestras de botones");
    result.passed = true; return;
  }

  // ── CSS scope: admin-only selectors, never the public store ─────────────
  for (const file of ["styles/layouts/admin-buttons.css", "styles/pages/admin-atencion.css", "styles/layouts/admin-premium.css"]) {
    const cssText = fs.readFileSync(path.join(frontend, "src", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...cssText.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
    const topLevel = (sel) => { const parts = []; let depth = 0, cur = ""; for (const ch of sel) { if (ch === "(" || ch === "[") depth++; if (ch === ")" || ch === "]") depth--; if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch; } parts.push(cur.trim()); return parts; };
    const outside = selectors.flatMap(topLevel).filter((s) => !/^(html )?\.admin-shell\b/.test(s));
    assert.deepEqual(outside, [], `${file}: selectores fuera del administrador`);
  }
  const shop = fs.readFileSync(path.join(frontend, "src/app/(shop)/layout.js"), "utf8") + fs.readFileSync(path.join(frontend, "src/app/layout.js"), "utf8");
  assert.ok(!/admin-buttons|admin-atencion|admin-premium/.test(shop), "La tienda pública no importa hojas del administrador");
  const vendorLayout = fs.readFileSync(path.join(frontend, "src/app/vendedor/layout.js"), "utf8");
  assert.ok(/admin-premium\.css/.test(vendorLayout) && /admin-buttons\.css/.test(vendorLayout), "El vendedor carga los estilos compartidos");
  check("B00 estilos acotados a .admin-shell; la tienda no los importa; el vendedor carga dz- y botones");

  // ── Botones: variantes, estados, foco, diálogo ───────────────────────────
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/muestras-botones", "Muestras de botones");
  const style = (id, pseudo) => page.$eval(`#${id}`, (e, p) => { const s = getComputedStyle(e, p || null); const r = e.getBoundingClientRect(); return { bg: s.backgroundColor, color: s.color, border: s.borderTopColor, radius: s.borderTopLeftRadius, h: Math.round(r.height), weight: s.fontWeight, cursor: s.cursor, outline: s.outlineStyle + " " + s.outlineWidth, content: s.content, deco: s.textDecorationLine }; }, pseudo);
  const ids = ["g-primary", "g-secondary", "g-tertiary", "g-danger", "g-sm", "g-sm-danger", "g-link", "g-classless", "g-disabled-primary", "g-disabled", "g-busy-secondary", "g-op", "g-op-primary", "g-dz-primary", "g-dz"];
  for (const id of ids) result.buttonStyles[id] = await style(id);
  const S = result.buttonStyles;
  assert.equal(S["g-primary"].bg, "rgb(37, 39, 37)"); assert.equal(S["g-primary"].color, "rgb(255, 255, 255)");
  for (const id of ["g-secondary", "g-sm", "g-link", "g-classless", "g-op", "g-dz"]) { assert.equal(S[id].bg, "rgb(255, 255, 255)", id); assert.equal(S[id].color, "rgb(37, 39, 37)", id); }
  for (const id of ["g-op-primary", "g-dz-primary"]) assert.equal(S[id].bg, "rgb(37, 39, 37)", id);
  assert.equal(S["g-tertiary"].bg, "rgba(0, 0, 0, 0)"); assert.equal(S["g-tertiary"].deco, "underline");
  for (const id of ["g-danger", "g-sm-danger"]) { assert.equal(S[id].color, "rgb(155, 44, 44)", id); assert.equal(S[id].bg, "rgb(255, 255, 255)", id); }
  for (const id of ["g-disabled-primary", "g-disabled"]) { assert.equal(S[id].bg, "rgb(239, 237, 232)", id); assert.equal(S[id].cursor, "not-allowed", id); }
  assert.notEqual(S["g-disabled-primary"].bg, S["g-primary"].bg, "Un primario deshabilitado no parece activo");
  assert.equal(S["g-busy-secondary"].color, "rgba(0, 0, 0, 0)"); assert.notEqual((await style("g-busy-secondary", "::after")).content, "none");
  assert.ok(new Set(ids.map((id) => S[id].radius)).size === 1, "Radio único");
  assert.ok([S["g-primary"].h, S["g-secondary"].h, S["g-danger"].h].every((h) => h >= 44)); assert.ok([S["g-sm"].h, S["g-op"].h].every((h) => h >= 36 && h < 44));
  const contrast = await page.evaluate((ids) => { const lum = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
    const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return "rgb(255,255,255)"; };
    return Object.fromEntries(ids.map((id) => { const e = document.getElementById(id), a = lum(getComputedStyle(e).color), b = lum(bgOf(e)); return [id, +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2)]; })); }, ids.filter((id) => !id.includes("busy")));
  result.buttonContrast = contrast; assert.deepEqual(Object.entries(contrast).filter(([, c]) => c < 4.5), [], "Texto de botones ≥ 4,5:1");
  await page.hover("#g-secondary"); await page.waitForFunction((bg) => getComputedStyle(document.getElementById("g-secondary")).backgroundColor !== bg, { timeout: 2000 }, S["g-secondary"].bg); result.buttonStyles["g-secondary:hover"] = await style("g-secondary");
  await page.focus("body"); await page.keyboard.press("Tab"); for (let i = 0; i < 40 && await page.evaluate(() => document.activeElement.id !== "g-primary"); i++) await page.keyboard.press("Tab");
  assert.match((await style("g-primary")).outline, /solid 3px/, "Foco visible");
  await page.click("#g-busy"); await page.$eval("#g-busy", (e) => { e.click(); e.click(); }); assert.equal(await page.$eval("#g-log", (e) => e.textContent), "x", "El botón procesando no acepta más clics");
  assert.equal(await page.$eval("#g-busy", (e) => e.getAttribute("aria-busy")), "true"); const busyWidth = await page.$eval("#g-busy", (e) => e.getBoundingClientRect().width);
  await page.waitForFunction(() => document.getElementById("g-busy").getAttribute("aria-busy") === "false"); assert.equal(Math.round(await page.$eval("#g-busy", (e) => e.getBoundingClientRect().width)), Math.round(busyWidth), "Sin salto de ancho");
  await page.click("#g-open-modal"); await page.waitForSelector('[role="dialog"]'); assert.equal(await page.evaluate(() => document.activeElement.textContent), "Cancelar");
  const modalCancel = await page.$eval('[role="dialog"] .admin-btn:not(.admin-btn--danger)', (e) => getComputedStyle(e).backgroundColor), modalDanger = await page.$eval('[role="dialog"] .admin-btn--danger', (e) => getComputedStyle(e).color);
  assert.equal(modalCancel, "rgb(255, 255, 255)"); assert.equal(modalDanger, "rgb(155, 44, 44)");
  await shot("botones-dialogo-1440", false);
  await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); assert.equal(await page.evaluate(() => document.activeElement.id), "g-open-modal", "El foco vuelve al disparador");
  check("B01–B08 primario, secundario, terciario, destructivo, deshabilitado, procesando (sin salto ni doble clic), foco, hover, contraste ≥4,5 y diálogo con retorno de foco");
  await sweep("botones", "/admin/muestras-botones", "Muestras de botones");

  // ── Solicitudes: listado, filtros, estados ──────────────────────────────
  await sweep("solicitudes", "/admin/solicitudes", "SOL-20261124-0001");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/solicitudes", "SOL-20261124-0001");
  assert.equal(await page.$eval("main h1", (e) => e.textContent), "Atención al cliente");
  assert.ok(await page.evaluate(() => document.body.innerText.includes("Gestiona solicitudes, personalizaciones y consultas de tus clientes.")));
  const tabs = await page.$$eval('nav[aria-label="Secciones de Atención al cliente"] a', (a) => a.map((x) => [x.textContent, x.getAttribute("aria-current")]));
  assert.deepEqual(tabs.map((t) => t[0]), ["Solicitudes especiales", "PQR y datos personales"]); assert.equal(tabs[0][1], "page");
  const headerBeforeTabs = await page.evaluate(() => { const h = document.querySelector("main h1"), n = document.querySelector('nav[aria-label="Secciones de Atención al cliente"]'); return !!(h.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); });
  assert.ok(headerBeforeTabs, "Cabecera antes de las pestañas");
  assert.equal(await page.$$eval("table tbody tr", (r) => r.length), 15); await text("18 solicitudes · página 1 de 2");
  const types = await page.$$eval(".cs-cell-type .cs-strong", (e) => [...new Set(e.map((x) => x.textContent))]); assert.deepEqual(types.sort(), ["Pedido al por mayor", "Personalización"]);
  const chips = await page.$$eval(".cs-cell-status .dz-chip", (e) => [...new Set(e.map((x) => x.textContent))]); for (const label of ["Pendiente", "En revisión", "Cotizado", "Aprobado", "Completado", "Rechazado", "Cancelado"]) assert.ok(chips.includes(label), label);
  assert.ok(await page.$eval("table tbody a", (a) => /\/admin\/solicitudes\/sr1\?returnTo=/.test(a.getAttribute("href"))), "El primer enlace de la fila es el número");
  check("S01–S03 cabecera, pestañas, tabla con tipos y los 7 estados reales, paginación del backend");
  await page.select('select[aria-label="Tipo de solicitud"]', "wholesale"); await click("Buscar"); await page.waitForFunction(() => location.search.includes("type=wholesale"));
  await page.waitForFunction(() => [...document.querySelectorAll(".cs-cell-type .cs-strong")].every((e) => e.textContent === "Pedido al por mayor") && document.querySelectorAll("table tbody tr").length > 0);
  await page.type('input[aria-label="Buscar solicitudes"]', "zzz-sin-resultado"); await click("Buscar"); await text("No hay solicitudes con estos filtros");
  await shot("solicitudes-sin-coincidencias-1440", false);
  await click("Limpiar filtros"); await page.waitForFunction(() => location.search === "" || location.search === "?"); await text("18 solicitudes");
  check("S04 filtros por tipo y búsqueda, sin coincidencias distinto de vacío, limpiar filtros");
  await click("Siguiente"); await page.waitForFunction(() => location.search.includes("page=2")); await text("página 2 de 2"); assert.equal(await page.$$eval("table tbody tr", (r) => r.length), 3);
  check("S05 paginación existente con Anterior/Siguiente");
  scenario.emptyRequests = true; await goto("/admin/solicitudes", "Aún no hay solicitudes especiales"); assert.equal(await page.$("table"), null); await shot("solicitudes-vacias-1440"); await page.setViewport({ width: 390, height: 900 }); await goto("/admin/solicitudes", "Aún no hay solicitudes especiales"); await shot("solicitudes-vacias-390"); scenario.emptyRequests = false;
  await page.setViewport({ width: 1440, height: 900 }); scenario.failRequests = 1; await goto("/admin/solicitudes", "No se pudieron cargar las solicitudes"); assert.ok(await page.evaluate(() => !/Aún no hay|No hay solicitudes/.test(document.body.innerText)));
  await shot("solicitudes-error-1440", false); await click("Reintentar solicitudes"); await text("SOL-20261124-0001");
  scenario.slowList = 1200; await goto("/admin/solicitudes", "Atención al cliente"); await page.waitForSelector(".cs-skeleton[aria-busy=true]"); await shot("solicitudes-cargando-1440", false); await text("SOL-20261124-0001"); scenario.slowList = 0;
  check("S06–S08 vacío real, error con reintento distinto de vacío, carga");
  await page.focus('input[aria-label="Buscar solicitudes"]'); await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Buscar");
  const viewLink = await page.$('a[aria-label="Ver solicitud SOL-20261124-0002"]'); await viewLink.focus(); await page.keyboard.press("Enter"); await page.waitForFunction(() => location.pathname === "/admin/solicitudes/sr2");
  await text("Pedido al por mayor"); check("S09 teclado: filtros en orden lógico y «Ver solicitud» con nombre contextual abre el detalle");

  // ── Detalle ─────────────────────────────────────────────────────────────
  await sweep("detalle", `/admin/solicitudes/${firstId}?returnTo=%2Fadmin%2Fsolicitudes%3Ftype%3Dcustomization`, "María Fernanda");
  await page.setViewport({ width: 1440, height: 900 }); await goto(`/admin/solicitudes/${firstId}?returnTo=%2Fadmin%2Fsolicitudes%3Ftype%3Dcustomization`, "María Fernanda");
  for (const t of ["SOL-20261124-0001", "Personalización", "Pendiente", "Talla M · Natural", "Grabado de iniciales", "Hotel Boutique Casa Colonial de Pasto S.A.S.", "Notas del cliente", "Aún no hay cambios de estado registrados", "Visible en el seguimiento del cliente", "Solo equipo", "Estos cambios no envían mensajes automáticos al cliente."]) await text(t);
  assert.equal(await page.$eval(".request-detail-grid select", (e) => e.id), "status", "Primer select = estado");
  assert.ok(await page.$eval("#adminNotes", (e) => !!e.labels.length));
  check("D01 detalle: referencia y estado, cliente, solicitud completa (variante, opciones, notas), visible/interno diferenciado");
  const statusBtn = () => page.$eval(".cs-manage__block .admin-btn", (e) => [e.textContent, e.className]);
  assert.match((await statusBtn())[1], /admin-btn--primary/);
  await page.select("#status", "cancelado"); await text("Vas a cerrar la solicitud"); assert.match((await statusBtn())[1], /admin-btn--danger/);
  await shot("detalle-cierre-destructivo-1440", false); await page.select("#status", "en_revision"); assert.match((await statusBtn())[1], /admin-btn--primary/);
  check("D02 jerarquía: Actualizar estado primario; pasa a destructivo discreto al elegir Cancelado/Rechazado; Guardar cotización secundario; Volver terciario");
  scenario.slowMutation = 700; const before = result.mutations.length;
  await page.type("#statusNote", "Revisión con el taller.");
  await page.$eval(".cs-manage__block .admin-btn", (e) => { e.click(); e.click(); });
  await page.waitForFunction(() => document.querySelector(".cs-manage__block .admin-btn").getAttribute("aria-busy") === "true");
  assert.ok(await page.$eval(".cs-manage__block .admin-btn", (e) => e.disabled));
  await text("Estado actualizado"); assert.equal(result.mutations.length - before, 1, "Doble clic = una sola operación"); scenario.slowMutation = 0;
  await text("Revisión con el taller."); assert.equal(await page.$eval(".cs-detail-head .dz-chip", (e) => e.textContent), "En revisión");
  check("D03 procesando + doble clic: una sola petición, botón ocupado y deshabilitado; historial y cabecera actualizados");
  await page.$eval("#quotedAmount", (e) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "950000"); e.dispatchEvent(new Event("input", { bubbles: true })); });
  await click("Guardar cotización"); await text("Cotización guardada"); assert.equal(await page.$eval(".cs-detail-head .dz-chip", (e) => e.textContent), "Cotizado");
  check("D04 cotización guardada: el backend la pasa a Cotizado y la vista lo refleja");
  await click("← Volver a solicitudes"); await page.waitForFunction(() => location.search === "?type=customization"); check("D05 «Volver» conserva los filtros (returnTo)");
  scenario.failDetail = 1; await goto(`/admin/solicitudes/${firstId}`, "No se pudo cargar la solicitud."); await click("Reintentar solicitud"); await text("María Fernanda");
  await goto("/admin/solicitudes/no-existe", "Solicitud no encontrada"); check("D06 error de detalle con reintento y no encontrada");
  await sweep("detalle-mayorista", `/admin/solicitudes/${wholesaleId}`, "Tienda Artesanías del Sur");

  // ── Vendedor ────────────────────────────────────────────────────────────
  await role("vendedor"); await sweep("vendedor-solicitudes", "/admin/solicitudes", "SOL-20261124-0001");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/solicitudes", "SOL-20261124-0001");
  assert.equal(await page.$eval("main h1", (e) => e.textContent), "Solicitudes especiales"); assert.equal(await page.$('nav[aria-label="Secciones de Atención al cliente"]'), null);
  await goto(`/admin/solicitudes/${firstId}`, "María Fernanda"); assert.ok(await page.$("#status")); assert.ok(await page.$("#quotedAmount"));
  await goto("/admin/pqr", "Destino de prueba"); assert.equal(await page.evaluate(() => location.pathname), "/cuenta");
  check("P01 vendedor: solicitudes y su gestión como antes (el backend decide), sin pestaña PQR y /admin/pqr redirigido");
  await role("admin");

  // ── PQR ─────────────────────────────────────────────────────────────────
  await sweep("pqr", "/admin/pqr", "PQR-20261124-0001");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/pqr", "PQR-20261124-0001");
  assert.equal(await page.$$eval("table tbody tr", (r) => r.length), 8); await text("8 radicados");
  assert.ok(await page.evaluate(() => !/@example\.test|@hotel/.test(document.querySelector("table").innerText)), "El listado no muestra datos de contacto");
  assert.equal(await page.$$eval(".cs-chip-data", (e) => e.length), 5);
  for (const t of ["Reclamo", "Petición", "Queja", "Suprimir mis datos", "Corregir mis datos", "Consultar mis datos", "Revocar una autorización", "Actualizar mis datos", "Recibida", "En trámite", "Respondida", "Cerrada"]) await text(t);
  check("Q01 PQR: radicado, fecha, categoría, motivo y estado reales; datos personales identificados; sin contacto en el listado");
  const selects = await page.$$(".cs-toolbar select"); await selects[0].select("datos_personales"); await page.waitForFunction(() => document.querySelectorAll("table tbody tr").length === 5);
  await selects[1].select("respondida");
  await page.waitForFunction(() => document.querySelectorAll("table tbody tr").length === 1); await selects[1].select("cerrada"); await page.waitForFunction(() => document.querySelectorAll("table tbody tr").length === 1);
  await (await page.$$(".cs-toolbar select"))[0].select("consumo"); await (await page.$$(".cs-toolbar select"))[1].select("recibida");
  await text("Sin solicitudes con estos filtros"); await shot("pqr-sin-coincidencias-1440", false); await click("Limpiar filtros"); await text("8 radicados");
  check("Q02 filtros de categoría y estado; sin coincidencias con limpiar");
  scenario.emptyPqr = true; await goto("/admin/pqr", "Sin solicitudes."); await shot("pqr-vacia-1440"); await page.setViewport({ width: 390, height: 900 }); await goto("/admin/pqr", "Sin solicitudes."); await shot("pqr-vacia-390"); scenario.emptyPqr = false;
  await page.setViewport({ width: 1440, height: 900 }); scenario.failPqr = 1; await goto("/admin/pqr", "Fallo local de carga PQR"); assert.ok(await page.evaluate(() => !document.body.innerText.includes("Sin solicitudes.")));
  await click("Reintentar PQR"); await text("PQR-20261124-0001"); check("Q03 vacío y error distintos; recuperación");
  await click("Ver"); await text("Registro del cambio"); assert.equal(await page.evaluate(() => document.activeElement.id), "cs-pqr-detail-title", "El foco va al detalle");
  assert.equal(await page.$eval('button[aria-label="Ver PQR-20261124-0001"]', (e) => e.getAttribute("aria-expanded")), "true");
  for (const t of ["Nota al solicitante", "Nota interna", "Recibimos su reclamo", "Revisar fotos con bodega.", "DIZ-20261103-8F2C1A9B0D3E4F5A6B7C", "Solicito el cambio del producto"]) await text(t);
  await (await page.$(".cs-pqr-detail")).screenshot({ path: path.join(out, "pqr-detalle-1440.png") }); result.screenshots.push("pqr-detalle-1440.png");
  scenario.slowMutation = 600; const pb = result.mutations.length;
  await page.select("fieldset select", "respondida"); await page.type("fieldset textarea", "Enviamos un sombrero de reemplazo.");
  await page.$eval("fieldset button", (e) => { e.click(); e.click(); }); await text("Cambio de estado guardado"); assert.equal(result.mutations.length - pb, 1); scenario.slowMutation = 0;
  await page.waitForFunction(() => document.querySelector("table tbody tr .dz-chip:last-child")); await text("Enviamos un sombrero de reemplazo.");
  check("Q04 detalle PQR: foco, historial con notas pública/interna diferenciadas, guardado único con doble clic");
  await (await page.$('button[aria-label="Ver PQR-20261124-0002"]')).click();
  await text("Solicitud de titular de datos personales"); await (await page.$(".cs-pqr-detail")).screenshot({ path: path.join(out, "pqr-detalle-datos-1440.png") }); result.screenshots.push("pqr-detalle-datos-1440.png");
  await click("Cerrar detalle"); assert.equal(await page.$(".cs-pqr-detail"), null); check("Q05 solicitud de datos personales con tratamiento diferenciado; cerrar detalle");
  for (const width of [390, 360]) { await page.setViewport({ width, height: 900 }); await goto("/admin/pqr", "PQR-20261124-0001"); await click("Ver"); await text("Registro del cambio"); const a = await audit(); assert.equal(a.docOverflow, false); assert.deepEqual(a.offenders, []); await page.screenshot({ path: path.join(out, `pqr-detalle-${width}.png`), fullPage: true }); }
  check("Q06 detalle PQR en móvil sin desbordamiento");

  // ── Texto al 200 % ──────────────────────────────────────────────────────
  for (const [url, ready, name] of [["/admin/solicitudes", "SOL-20261124-0001", "solicitudes"], [`/admin/solicitudes/${firstId}`, "María Fernanda", "detalle"], ["/admin/pqr", "PQR-20261124-0001", "pqr"]]) for (const width of [1280, 390]) {
    await page.setViewport({ width, height: 900 }); await goto(url, ready); await page.addStyleTag({ content: "html{font-size:200% !important}" }); await delay(300);
    const a = await audit(); result.measurements.push({ name: `${name}-texto200`, width, ...a });
    assert.equal(a.docOverflow, false, `${name} 200% ${width}: ${a.offenders}`); assert.deepEqual(a.offenders, [], `${name} 200% ${width}`); await shot(`${name}-texto200-${width}`, false);
  }
  check("A01 texto al 200 % (1280 y 390) sin desbordamiento");
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.consoleErrors, []); assert.deepEqual(result.externalRequests, []);
  assert.ok(result.mutations.every((m) => m.role !== "vendedor" || m.path.startsWith("/special-requests")), "El vendedor sólo opera solicitudes");
  result.passed = true;
 } finally {
  fs.writeFileSync(path.join(out, "navegador-componentes.json"), JSON.stringify(result, null, 2) + "\n");
  if (browser) await browser.close(); if (server) await new Promise((resolve) => server.close(resolve));
  const target = fs.realpathSync(stage); if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith("dizor-sprint04-ui-")) throw new Error("Unexpected cleanup target");
  fs.rmSync(target, { recursive: true, force: true });
 }
 process.stdout.write(`\n${result.checks.length} comprobaciones · passed=${!!result.passed}\n`);
})().catch((error) => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
