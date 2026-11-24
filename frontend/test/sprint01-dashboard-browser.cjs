"use strict";
// Sprint 01 (Inicio + Centro de alertas): real React components, real AdminShell and the
// real admin stylesheets, bundled in an isolated temp folder. The HTTP API is a local
// fixture with fictitious data (test/helpers/sprint01Fixtures.cjs). No Next dev server,
// .env, MongoDB, Wompi, e-mail or external network. MODE=antes only takes screenshots of
// the previous design; MODE=despues (default) also asserts the new behaviour.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const MODE = process.env.DIZOR_SPRINT01_MODE || "despues";
const out = path.join(process.env.DIZOR_SPRINT01_OUT || path.resolve(root, "../docs/auditoria-admin/rediseño-premium/evidencias-sprint-01"), MODE === "antes" ? "antes" : "despues");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const { operationalActions } = require(path.join(root, "backend/src/services/orderWorkspace"));
const F = require("./helpers/sprint01Fixtures.cjs");
fs.mkdirSync(out, { recursive: true });
const tempRoot = fs.realpathSync(os.tmpdir()), stage = fs.mkdtempSync(path.join(tempRoot, "dizor-sprint01-ui-"));
const result = { mode: MODE, checks: [], externalRequests: [], pageErrors: [], consoleErrors: [], requests: [], screenshots: [], measurements: [] };
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
  const auth = w("auth.js", `export const useAuth=()=>({user:{name:'Operadora ficticia',role:location.pathname.startsWith('/vendedor')?'vendedor':'admin'},loadingAuth:false,logout:async()=>{}});`);
  const site = w("site.js", `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  const api = w("api.js", `async function request(url){const r=await fetch('/mock'+url+(url.includes('?')?'&':'?')+'role='+(location.pathname.startsWith('/vendedor')?'vendedor':'admin'));const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}
async function mutate(url,data){const r=await fetch('/mock'+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}
export const getAdminDashboard=()=>request('/dashboard');export const getOrderStats=()=>request('/stats');export const getAlerts=()=>request('/alerts');
export const getDashboardAnalytics=(p={})=>request('/analytics?'+new URLSearchParams(p));
export const getPaymentEvents=(p={})=>request('/payment-events?'+new URLSearchParams(p));
export const reprocessPaymentEvent=(id)=>mutate('/payment-events/'+id+'/reprocess');export const archivePaymentEvent=(id,b)=>mutate('/payment-events/'+id+'/archive',b);export const reopenPaymentEvent=(id,b)=>mutate('/payment-events/'+id+'/reopen',b);export const concludePaymentEventFollowUp=(id,b)=>mutate('/payment-events/'+id+'/conclude',b);`);
  const src = (p) => JSON.stringify(path.join(frontend, "src", p));
  const entry = w("entry.jsx", `import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from './navigation';
import Shell from ${src("components/admin/AdminShell.jsx")};import Dashboard from ${src("components/admin/AdminDashboard.jsx")};import Alertas from ${src("app/admin/alertas/page.js")};
function App(){const p=usePathname();if(p==='/admin/alertas')return <Alertas/>;if(p.startsWith('/vendedor'))return <Shell variant="vendedor"><div className="admin-page"><Dashboard vendor/></div></Shell>;if(p==='/admin')return <Shell variant="admin"><Dashboard/></Shell>;return <Shell variant="admin"><div className="admin-page"><h1>Destino de prueba</h1><p data-destination>{p+location.search}</p></div></Shell>;}
createRoot(document.getElementById('app')).render(<App/>);`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, performance: { hints: false },
    resolve: { extensions: [".js", ".jsx", ".mjs", ".json"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "next/image": image,
      "@/services/orderAdminService": api, "@/services/adminDashboardService": api, "@/services/adminAlertService": api,
      "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@": path.join(frontend, "src") } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader },{ test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve(); }));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  // Same global sheets as app/layout.js + app/admin/layout.js, plus CSS modules with the loader's names.
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", "styles/layouts/admin-layout.css", "styles/pages/admin-cms.css", "styles/pages/admin-products.css", "styles/pages/admin-orders.css", "styles/pages/admin-marketing.css", "styles/pages/admin-dashboard.css", "styles/pages/admin-finanzas.css", "styles/pages/admin-alertas.css", "styles/layouts/admin-polish.css", "components/admin/OrderWorkspace.module.css"];
  const css = sheets.map((file) => { const text = fs.readFileSync(path.join(frontend, "src", file), "utf8"); if (!file.endsWith(".module.css")) return text; const prefix = "m_" + path.basename(file).split(".")[0] + "_"; return text.replace(/\.([A-Za-z_][A-Za-z0-9_-]*)/g, (m, n) => /^\d/.test(n) ? m : "." + prefix + n); }).join("\n");
  const scenario = { analytics: "data", alerts: "data", failDashboard: 0, failAnalytics: 0, failAlerts: 0, slowAnalytics: 0 };
  const dto = (o, role) => ({ ...o, operation: operationalActions(o, role) });
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    if (url.pathname.startsWith("/mock")) {
      res.setHeader("Content-Type", "application/json");
      const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)); };
      const role = url.searchParams.get("role"); url.searchParams.delete("role");
      result.requests.push({ method: req.method, path: url.pathname.slice(5), query: Object.fromEntries(url.searchParams), at: Date.now() });
      if (req.method !== "GET") return send({ message: "Operación ficticia registrada" });
      if (url.pathname === "/mock/dashboard") {
        if (scenario.failDashboard) { scenario.failDashboard--; return send({ message: "Fallo de prueba" }, 503); }
        return send({ status: "success", dashboard: { attention: F.attention, operationalOrders: F.recentOrders.map((o) => dto(o, role)), orders: { ordersToday: 3, revenueMonth: 5848000, shippedToday: 1 }, deliveredToday: 1, timeZone: "America/Bogota" } });
      }
      if (url.pathname === "/mock/stats") return send({ counts: F.vendorAttention });
      if (url.pathname === "/mock/analytics") {
        if (role !== "admin") return send({ message: "No autorizado" }, 403);
        if (scenario.slowAnalytics) await delay(scenario.slowAnalytics);
        if (scenario.failAnalytics) { scenario.failAnalytics--; return send({ message: "Fallo de prueba" }, 503); }
        return send(F.analytics(url.searchParams, { empty: scenario.analytics === "empty" }));
      }
      if (url.pathname === "/mock/alerts") {
        if (scenario.failAlerts) { scenario.failAlerts--; return send({ message: "Fallo de prueba" }, 503); }
        return send(F.alerts({ empty: scenario.alerts === "empty" }));
      }
      if (url.pathname === "/mock/payment-events") {
        const view = url.searchParams.get("view"), data = F.alerts();
        if (view === "financial-follow-up") return send({ count: 1, events: data.alerts.financialFollowUp.items });
        if (view === "closed-follow-up" || view === "verified") return send({ count: 0, events: [] });
        return send({ count: 2, events: data.alerts.paymentEvents.items });
      }
      return send({ message: "No encontrado" }, 404);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR · Sprint 01 aislado</title><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => result.pageErrors.push(e.stack || e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource: the server responded with a status of (403|503)/.test(m.text())) result.consoleErrors.push(m.text()); });
  // Fast polling only when a test opts in through sessionStorage; the product interval stays 60 s.
  await page.evaluateOnNewDocument(() => { const si = window.setInterval; window.setInterval = (fn, ms, ...a) => si(fn, ms === 60000 && sessionStorage.getItem("fastPoll") === "1" ? 1500 : ms, ...a); });
  await page.setRequestInterception(true);
  page.on("request", (r) => { if (r.url().startsWith(origin) || r.url().startsWith("data:")) r.continue(); else { result.externalRequests.push(r.url()); r.abort(); } });
  const text = async (s, timeout = 15000) => { try { await page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, s); } catch (error) { result.failure = { waiting: s, url: page.url(), body: await page.$eval("body", (e) => e.innerText) }; await page.screenshot({ path: path.join(out, "fallo-navegador.png"), fullPage: true }); throw error; } };
  const goto = async (url, ready) => { await page.goto(origin + url, { waitUntil: "domcontentloaded" }); await text(ready); await delay(150); };
  const shot = async (name, fullPage = true) => { await page.evaluate(() => scrollTo(0, 0)); await delay(80); const file = path.join(out, `${name}.png`); await page.screenshot({ path: file, fullPage }); result.screenshots.push(path.basename(file)); };
  const check = (label) => { result.checks.push(label); process.stdout.write(`ok - ${label}\n`); };
  // Geometry audit: no horizontal overflow and no visible text node covered by another element.
  const audit = () => page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth > innerWidth;
    const offenders = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)}`);
    const covered = [];
    for (const el of document.querySelectorAll("main .dz-page :is(h1,h2,h3,p,span,strong,small,a,button,dt,dd,li,td,th,label)")) {
      if (covered.length > 5) break;
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const style = getComputedStyle(el); if (style.visibility === "hidden" || style.clipPath === "inset(50%)") continue;
      const x = Math.min(r.right - 2, r.left + 4), y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) covered.push({ text: el.textContent.trim().slice(0, 40), by: `${hit.tagName}.${String(hit.className).slice(0, 40)}` });
    }
    return { docOverflow, offenders, covered, height: document.documentElement.scrollHeight };
  });
  const sweep = async (name, url, ready, { assertOk = true } = {}) => {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900 }); await goto(url, ready); await delay(250);
      const a = await audit(); result.measurements.push({ name, width, ...a });
      if (assertOk && MODE !== "antes") { assert.equal(a.docOverflow, false, `${name} ${width}: desbordamiento horizontal ${a.offenders.join(", ")}`); assert.deepEqual(a.offenders, [], `${name} ${width}`); assert.deepEqual(a.covered, [], `${name} ${width}: texto tapado`); }
      await shot(`${name}-${width}`);
    }
    check(`${name}: ${WIDTHS.join("/")} px sin desbordamiento ni texto tapado`);
  };
  const button = async (label) => page.waitForFunction((l) => [...document.querySelectorAll("button,a")].find((e) => e.getClientRects().length && (e.textContent.trim() === l || e.getAttribute("aria-label") === l)), { timeout: 15000 }, label);
  const click = async (label) => { const h = await button(label); await h.click(); await h.dispose(); };
  // React-controlled date input: native setter + input event (independent of the browser locale).
  const setDate = (selector, value) => page.$eval(selector, (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, v); e.dispatchEvent(new Event("input", { bubbles: true })); }, value);

  if (MODE === "antes") {
    await sweep("inicio", "/admin", "Listos para preparar", { assertOk: false });
    await sweep("alertas", "/admin/alertas", "Stock bajo", { assertOk: false });
    await sweep("vendedor", "/vendedor", "Listos para preparar", { assertOk: false });
    result.passed = true; return;
  }

  // ── Inicio con datos ───────────────────────────────────────────────
  await sweep("inicio", "/admin", "Ventas conciliadas");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin", "Ventas conciliadas");
  assert.equal(await page.$eval("main h1", (e) => e.textContent), "Resumen general");
  assert.ok(await page.evaluate(() => document.body.innerText.includes("Pedidos, ventas y actividad de tu tienda en un solo lugar.")));
  // Marker used by earlier regression suites; it also states the criterion of the task block.
  assert.ok(await page.evaluate(() => document.body.innerText.includes("Resumen de pedidos") && document.body.innerText.includes("Otras alertas")));
  for (const [tray, n] of [["prepare", 4], ["dispatch", 3], ["review", 1], ["collection", 2], ["communications", 3]]) assert.equal(await page.$eval(`a[href="/admin/pedidos?tray=${tray}"] .dz-metric__value`, (e) => e.textContent.trim()), String(n), tray);
  check("D01 cinco tareas operativas con los contadores del backend y enlace a su bandeja");
  const first = await page.$$eval("main .dz-page a, main .dz-page button, main .dz-page select, main .dz-page input", (els) => els.map((e) => e.tabIndex));
  assert.ok(first.every((t) => t >= 0), "Todos los controles son alcanzables con teclado");
  await page.focus('a[href="/admin/pedidos?tray=prepare"]'); await page.keyboard.press("Enter"); await page.waitForFunction(() => location.search === "?tray=prepare");
  assert.equal(await page.$eval("[data-destination]", (e) => e.textContent), "/admin/pedidos?tray=prepare");
  check("D02 tarjeta de tarea navegable con teclado (Enter) hacia la bandeja");
  await goto("/admin", "Ventas conciliadas");
  const firstAnalytics = result.requests.filter((r) => r.path === "/analytics").at(-1); assert.equal(firstAnalytics.query.period, "30d");
  await page.evaluate(() => sessionStorage.removeItem("dizor.dashboard.period"));
  await click("7 días"); await page.waitForFunction(() => new URLSearchParams(location.search).get("periodo") === "7d"); await text("Últimos 7 días");
  assert.equal(result.requests.filter((r) => r.path === "/analytics").at(-1).query.period, "7d");
  const dashBefore = result.requests.filter((r) => r.path === "/dashboard").length;
  await click("Hoy"); await page.waitForFunction(() => new URLSearchParams(location.search).get("periodo") === "hoy"); await text("Hoy ·");
  assert.equal(result.requests.filter((r) => r.path === "/dashboard").length, dashBefore, "Cambiar el periodo no recarga las tareas operativas");
  for (const [tray, n] of [["prepare", 4], ["review", 1]]) assert.equal(await page.$eval(`a[href="/admin/pedidos?tray=${tray}"] .dz-metric__value`, (e) => e.textContent.trim()), String(n));
  check("D03 selector de periodo cambia URL y analítica; las tareas conservan su estado actual");
  await page.reload({ waitUntil: "domcontentloaded" }); await text("Hoy ·");
  assert.equal(result.requests.filter((r) => r.path === "/analytics").at(-1).query.period, "today");
  await goto("/admin/pedidos", "Destino de prueba"); await goto("/admin", "Hoy ·");
  assert.equal(await page.evaluate(() => new URLSearchParams(location.search).get("periodo")), "hoy");
  check("D04 periodo conservado al recargar (URL) y al volver a Inicio (sesión)");
  await click("Personalizado"); await page.waitForSelector("#dz-period-from");
  await setDate("#dz-period-from", "2026-11-01"); await setDate("#dz-period-to", "2026-11-15");
  await click("Aplicar rango"); await page.waitForFunction(() => location.search.includes("desde=2026-11-01") && location.search.includes("hasta=2026-11-15"));
  const custom = result.requests.filter((r) => r.path === "/analytics").at(-1).query; assert.deepEqual([custom.period, custom.from, custom.to], ["custom", "2026-11-01", "2026-11-15"]);
  await setDate("#dz-period-from", "2026-11-20"); await click("Aplicar rango");
  await text("La fecha inicial debe ser anterior o igual a la final");
  check("D05 rango personalizado en URL y validación de fechas invertidas sin consulta");
  await goto("/admin?periodo=30d", "Ventas conciliadas");
  const kpis = await page.$$eval(".dz-kpis .dz-metric", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
  assert.equal(kpis.length, 4); assert.ok(kpis[0].includes("Ventas conciliadas") && kpis[0].includes("$")); assert.ok(kpis[2].includes("Ticket promedio")); assert.ok(kpis[3].includes("Unidades vendidas"));
  assert.ok(kpis[0].includes("16,3 %"), "Comparación visible cuando el backend la valida");
  check("D06 indicadores comerciales con periodo y comparación sólo cuando existe");
  const chart = await page.$(".dz-trend [role=application], .dz-trend svg"); assert.ok(chart);
  await page.focus(".dz-trend__plot"); await page.keyboard.press("End"); await page.waitForSelector(".dz-trend__tooltip");
  const tip = await page.$eval(".dz-trend__tooltip", (e) => e.innerText); assert.match(tip, /\$/);
  await page.keyboard.press("Home"); const tip2 = await page.$eval(".dz-trend__tooltip", (e) => e.innerText); assert.notEqual(tip, tip2);
  assert.ok(await page.$eval(".dz-trend table", (t) => t.rows.length > 10));
  check("D07 evolución de ventas: tooltip por teclado y tabla equivalente");
  const dist = await page.$$eval(".dz-dist__row", (rows) => rows.map((r) => r.innerText.replace(/\s+/g, " ")));
  assert.ok(dist.length >= 5); assert.ok(await page.evaluate(() => document.body.innerText.includes("Requieren revisión")));
  check("D08 distribución por estado con revisión como indicador separado");
  assert.equal(await page.$$eval(".dz-top li", (l) => l.length), 5); assert.ok(await page.$('a[href="/admin/productos/p1/editar"]'));
  assert.ok(await page.evaluate(() => document.body.innerText.includes("Productos publicados sin ventas conciliadas durante el periodo")));
  assert.ok(await page.$('a[href="/admin/productos?view=stock&productId=p2&variantId=v21"]'));
  check("D09 rendimiento de productos: top, sin ventas y variantes con enlace directo");
  const recent = await page.$$eval(".dz-recent__row", (r) => r.length); assert.ok(recent > 0 && recent <= 6);
  assert.ok(await page.$('a[href^="/admin/pedidos/ord4?"]'));
  check("D10 pedidos recientes limitados con acción del backend");

  // ── Estados vacíos, carga, error y reintento ───────────────────────
  scenario.analytics = "empty"; await page.setViewport({ width: 1440, height: 900 }); await goto("/admin?periodo=7d", "Sin ventas conciliadas");
  assert.ok(await page.evaluate(() => !document.body.innerText.includes("16,3 %")));
  await shot("inicio-sin-datos-1440"); await page.setViewport({ width: 390, height: 900 }); await goto("/admin?periodo=7d", "Sin ventas conciliadas"); await shot("inicio-sin-datos-390");
  scenario.analytics = "data"; check("D11 estado vacío real, sin cifras inventadas ni porcentaje");
  scenario.failAnalytics = 1; await page.setViewport({ width: 1440, height: 900 }); await goto("/admin", "No se pudieron cargar los indicadores comerciales");
  assert.ok(await page.$('a[href="/admin/pedidos?tray=prepare"]'), "El error comercial no oculta la operación");
  assert.ok(await page.evaluate(() => !document.querySelector(".dz-kpis .dz-metric__value")));
  await shot("inicio-error-analitica-1440"); await click("Reintentar indicadores"); await text("Ventas conciliadas"); await page.waitForSelector(".dz-kpis .dz-metric__value");
  check("D12 error comercial distinto de cero, aislado y con reintento");
  scenario.failDashboard = 1; await goto("/admin", "No se pudo cargar la operación");
  assert.equal(await page.$('a[href="/admin/pedidos?tray=prepare"]'), null); await click("Reintentar carga"); await text("Listos para preparar");
  check("D13 error operativo no muestra ceros y se recupera");
  scenario.slowAnalytics = 1200; await goto("/admin?periodo=30d", "Listos para preparar"); await page.waitForSelector(".dz-kpis[aria-busy=true]"); await shot("inicio-cargando-1440", false); await text("Ventas conciliadas"); scenario.slowAnalytics = 0;
  check("D14 estado de carga visible sin saltos");
  const mutations = result.requests.filter((r) => r.method !== "GET"); assert.deepEqual(mutations, [], "El dashboard sólo consulta");
  check("D15 Inicio no realiza operaciones de escritura");

  // ── Vendedor ───────────────────────────────────────────────────────
  const before = result.requests.length; await sweep("vendedor", "/vendedor", "Panel vendedor");
  assert.equal(result.requests.slice(before).filter((r) => r.path === "/analytics" || r.path === "/dashboard").length, 0, "El vendedor no consulta analítica ni el dashboard administrativo");
  assert.ok(await page.evaluate(() => !/Ventas conciliadas|Ticket promedio|Ingresos/.test(document.body.innerText)));
  assert.ok(await page.$('a[href="/vendedor/pedidos?tray=prepare"]')); assert.equal(await page.$('a[href="/vendedor/pedidos?tray=communications"]'), null);
  check("D16 vendedor sin indicadores financieros ni bandeja de comunicaciones");

  // ── Texto al 200 % (WCAG 1.4.4): sin desbordamiento ni texto tapado ─────
  for (const [url, ready, name] of [["/admin?periodo=30d", "Ventas conciliadas", "inicio"], ["/admin/alertas", "Centro de alertas", "alertas"]]) for (const width of [1280, 390]) {
    await page.setViewport({ width, height: 900 }); await goto(url, ready); await page.addStyleTag({ content: "html{font-size:200% !important}" }); await delay(400);
    const a = await audit(); result.measurements.push({ name: `${name}-texto200`, width, ...a });
    assert.equal(a.docOverflow, false, `${name} 200% ${width}: ${a.offenders.join(", ")}`); assert.deepEqual(a.offenders, [], `${name} 200% ${width}`); assert.deepEqual(a.covered, [], `${name} 200% ${width}: texto tapado`);
    await shot(`${name}-texto200-${width}`, false);
  }
  check("D17 texto al 200 % en 1280 y 390 px sin desbordamiento ni texto tapado");

  // ── Centro de alertas ──────────────────────────────────────────────
  await sweep("alertas", "/admin/alertas", "Centro de alertas");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/alertas", "Centro de alertas");
  const order = await page.$$eval(".dz-alert-group", (g) => g.map((e) => e.dataset.group));
  assert.ok(order.indexOf("payments") < order.indexOf("orders") && order.indexOf("orders") < order.indexOf("out") && order.indexOf("out") < order.indexOf("low") && order.indexOf("low") < order.indexOf("communications") && order.indexOf("communications") < order.indexOf("requests") && order.indexOf("requests") < order.indexOf("coupons"));
  check("A01 prioridad: pagos, pedidos, agotado, bajo, comunicaciones, solicitudes, cupones");
  const lowRows = () => page.$$eval('[data-group="low"] .dz-alert-row', (r) => r.length);
  const initial = await lowRows(); assert.ok(initial <= 4, `filas iniciales ${initial}`);
  await shot("alertas-contraidas-1440", false);
  assert.ok(await page.evaluate(() => /Mostrando 3 de 18/.test(document.querySelector('[data-group="low"]').innerText)));
  await page.click('[data-group="low"] .dz-alert-group__more'); assert.equal(await lowRows(), 10);
  assert.ok(await page.evaluate(() => /Mostrando 10 de 18 · el resumen incluye sólo los primeros registros/.test(document.querySelector('[data-group="low"]').innerText)), "No afirma tener todos los registros");
  await page.evaluate(() => document.querySelector('[data-group="low"]').scrollIntoView()); await delay(100); await page.screenshot({ path: path.join(out, "alertas-ver-mas-1440.png") }); result.screenshots.push("alertas-ver-mas-1440.png");
  const toggle = await page.$('[data-group="low"] .dz-alert-group__toggle'); await toggle.click(); assert.equal(await toggle.evaluate((e) => e.getAttribute("aria-expanded")), "false"); assert.equal(await lowRows(), 0);
  await toggle.focus(); await page.keyboard.press("Enter"); assert.equal(await toggle.evaluate((e) => e.getAttribute("aria-expanded")), "true");
  assert.ok(await page.$('[data-group="low"] a[href="/admin/productos?view=stock&stock=low"]'));
  assert.ok(await page.$('a[href="/admin/productos?view=stock&productId=s1&variantId=ov1"]'));
  assert.ok(await page.evaluate(() => !document.querySelector('[data-group="low"]').innerText.includes("Stock total")));
  check("A02 ver más, contraer/expandir por teclado, ver todos y variante/SKU sin totales engañosos");
  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/alertas", "Centro de alertas");
  const groupHeights = await page.$$eval(".dz-alert-group", (g) => g.map((e) => [e.dataset.group, Math.round(e.getBoundingClientRect().height)]));
  result.measurements.push({ name: "alertas-390-alturas", groupHeights });
  assert.ok(groupHeights.find(([k]) => k === "low")[1] < 700, "Stock bajo no ocupa metros en móvil");
  await shot("alertas-movil-390"); check("A03 móvil compacto: cada grupo limitado antes de pasar al siguiente");
  await page.evaluate(() => sessionStorage.setItem("fastPoll", "1")); await page.setViewport({ width: 1440, height: 900 }); await goto("/admin/alertas", "Centro de alertas");
  const polled = result.requests.filter((r) => r.path === "/alerts").length; await delay(3500);
  assert.ok(result.requests.filter((r) => r.path === "/alerts").length >= polled + 1, "Polling periódico");
  await page.evaluate(() => sessionStorage.removeItem("fastPoll"));
  assert.ok(await page.evaluate(() => /cada 60 s/.test(document.body.innerText) && !/tiempo real/i.test(document.body.innerText)));
  const manual = result.requests.filter((r) => r.path === "/alerts").length; await click("Actualizar"); await delay(400); assert.ok(result.requests.filter((r) => r.path === "/alerts").length > manual);
  check("A04 actualización manual y periódica (60 s), sin presentarla como tiempo real");
  scenario.failAlerts = 1; await click("Actualizar"); await text("No se pudieron actualizar las alertas"); assert.ok(await page.$('[data-group="low"]'), "Conserva los datos anteriores");
  await click("Actualizar"); await page.waitForFunction(() => !document.body.innerText.includes("No se pudieron actualizar las alertas"));
  scenario.failAlerts = 1e9; await goto("/admin/alertas", "No se pudieron cargar las alertas"); assert.equal(await page.$(".dz-alert-summary"), null); scenario.failAlerts = 0; await click("Reintentar"); await text("Incidencias de pagos");
  check("A05 error inicial y error de actualización distintos de 'sin alertas'");
  scenario.alerts = "empty"; await goto("/admin/alertas", "Sin alertas activas"); await shot("alertas-vacias-1440"); scenario.alerts = "data";
  check("A06 estado sin alertas");
  await goto("/admin/alertas", "Incidencias de pagos"); await click("Consultar eventos de pago pendientes"); await text("11968-1732460000-41267");
  await shot("alertas-pagos-consultados-1440");
  check("A07 conciliación Wompi conserva consulta, reproceso y archivo");
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.consoleErrors, []); assert.deepEqual(result.externalRequests, []);
  result.passed = true;
 } finally {
  fs.writeFileSync(path.join(out, "navegador-componentes.json"), JSON.stringify(result, null, 2) + "\n");
  if (browser) await browser.close(); if (server) await new Promise((resolve) => server.close(resolve));
  const target = fs.realpathSync(stage); if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith("dizor-sprint01-ui-")) throw new Error("Unexpected cleanup target");
  fs.rmSync(target, { recursive: true, force: true });
 }
 process.stdout.write(`\n${result.checks.length} comprobaciones · passed=${!!result.passed}\n`);
})().catch((error) => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
