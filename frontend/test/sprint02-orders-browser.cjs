"use strict";
// Sprint 02: isolated React render of the orders list and export screen.
// No Next server, .env, MongoDB, Wompi, email or external requests.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-02");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const { operationalActions } = require(path.join(root, "backend/src/services/orderWorkspace"));
fs.mkdirSync(out, { recursive: true });
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint02-"));
const result = { checks: [], externalRequests: [], pageErrors: [], shots: [] };
let browser;
let server;
const shot = async (page, name) => {
  const file = path.join(out, name);
  await page.screenshot({ path: file, fullPage: true });
  result.shots.push(name);
};

(async () => {
  try {
    const loader = path.join(stage, "jsx.cjs");
    const cssLoader = path.join(stage, "css.cjs");
    const api = path.join(stage, "api.js");
    const marketing = path.join(stage, "marketing.js");
    const navigation = path.join(stage, "navigation.js");
    const link = path.join(stage, "link.jsx");
    const auth = path.join(stage, "auth.js");
    const site = path.join(stage, "site.js");
    const alerts = path.join(stage, "alerts.js");
    const entry = path.join(stage, "entry.jsx");
    fs.writeFileSync(loader, `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
    fs.writeFileSync(cssLoader, "module.exports=function(){return 'module.exports={};'};");
    fs.writeFileSync(navigation, `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));export const navigate=(url)=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:navigate});`);
    fs.writeFileSync(link, `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
    fs.writeFileSync(auth, `export const useAuth=()=>({user:{name:'Operador ficticio',role:location.pathname.startsWith('/vendedor')?'vendedor':'admin'},logout:async()=>{}});`);
    fs.writeFileSync(site, `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
    fs.writeFileSync(alerts, `export const getAlerts=async()=>({alerts:{},totalCount:0});`);
    fs.writeFileSync(api, `export const getAdminOrders=(p)=>fetch('/mock/orders?'+new URLSearchParams({...p,role:location.pathname.startsWith('/vendedor')?'vendedor':'admin'})).then(async r=>{const body=await r.json();if(!r.ok)throw new Error('fixture');return body;});export const exportOrdersPdf=async(params)=>{window.__pdf=params||{};};`);
    fs.writeFileSync(marketing, `export const exportOrdersCsv=async()=>{window.__csv=(window.__csv||0)+1};export const exportNewsletterCsv=async()=>{window.__news=(window.__news||0)+1};export const exportAbandonedCartsCsv=async()=>{window.__carts=(window.__carts||0)+1};`);
    fs.writeFileSync(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname,useSearchParams} from './navigation';import Shell from ${JSON.stringify(path.join(frontend, "src/components/admin/AdminShell.jsx"))};import Orders from ${JSON.stringify(path.join(frontend, "src/components/admin/OrdersList.jsx"))};import DataExports,{OrdersExportScreen} from ${JSON.stringify(path.join(frontend, "src/components/admin/DataExports.jsx"))};function App(){const p=usePathname(),params=useSearchParams(),vendor=p.startsWith('/vendedor'),base=vendor?'/vendedor/pedidos':'/admin/pedidos';if(p==='/admin/contenido')return <Shell variant="admin"><div className="admin-page op-export-page">{params.get('scope')==='orders'?<OrdersExportScreen/>:<><h1 className="admin-page__title">Exportaciones históricas</h1><DataExports scope={params.get('scope')||'all'}/></>}</div></Shell>;return <Shell variant={vendor?'vendedor':'admin'}><div className="admin-page"><Orders basePath={base}/></div></Shell>;}createRoot(document.getElementById('app')).render(<App/>);`);
    const compiler = webpack({
      mode: "production",
      optimization: { minimize: false },
      context: frontend,
      entry,
      output: { path: stage, filename: "bundle.js" },
      resolve: {
        extensions: [".js", ".jsx", ".mjs", ".json"],
        modules: [path.join(frontend, "node_modules"), "node_modules"],
        alias: {
          "next/link": link,
          "next/navigation": navigation,
          "@/services/orderAdminService": api,
          "@/services/adminMarketingService": marketing,
          "@/services/adminAlertService": alerts,
          "@/services/adminDashboardService": api,
          "@/context/AuthContext": auth,
          "@/context/SiteConfigContext": site,
          "@": path.join(frontend, "src"),
        },
      },
      module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.mjs$/, include: path.join(frontend, "src"), type: "javascript/auto", use: loader }, { test: /\.css$/, use: cssLoader }] },
    });
    await new Promise((resolve, reject) => compiler.run((err, stats) => {
      compiler.close(() => {});
      if (err || stats.hasErrors()) reject(err || new Error(stats.toString({ all: false, errors: true })));
      else resolve();
    }));
    const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
    const sheets = ["styles/base/variables.css", "styles/base/globals.css", "styles/layouts/admin-layout.css", "styles/pages/admin-orders.css", "styles/layouts/admin-polish.css"];
    const css = sheets.map((file) => fs.readFileSync(path.join(frontend, "src", file), "utf8")).join("\n");
    const make = (id, state = "pendiente", method = "contra_entrega", payment = "pendiente", number = `DIZ-PRUEBA-${id.toUpperCase()}`) => ({
      _id: id, id, orderNumber: number, buyer: { name: `Cliente de prueba ${id}`, email: "comprador@example.test", phone: "3001234567" },
      total: 80000, paymentMethod: method, paymentStatus: payment, orderStatus: state, stockDeducted: method === "contra_entrega" || payment === "pagado",
      checkoutState: "ready", requiresReview: false, incidents: [], createdAt: "2026-11-20T14:00:00Z", carrier: state === "enviado" ? "servientrega" : "", trackingNumber: state === "enviado" ? "GUIA-FICTICIA-501" : "", source: "web",
    });
    const records = [
      ...Array.from({ length: 6 }, (_, i) => make(`nuevo${i}`)),
      make("largo", "pendiente", "contra_entrega", "pendiente", "DIZ-20261123-ABCDEF1234567890"),
      make("wompi", "pago_pendiente", "wompi", "pendiente"),
      make("recaudo", "entregado"),
      make("pagado", "entregado", "contra_entrega", "pagado"),
      make("rechazado", "rechazado", "wompi", "rechazado"),
      make("reembolso", "devuelto", "wompi", "reembolsado"),
      make("revision", "en_preparacion"),
      make("camino", "enviado"),
      make("cerrado", "cancelado"),
    ];
    records.find((order) => order.id === "revision").requiresReview = true;
    records.find((order) => order.id === "revision").incidents = [{ code: "approved_without_stock", resolvedAt: null }];
    const dto = (order, role) => ({ ...order, operation: operationalActions(order, role) });
    const inTray = (order, tray) => tray === "all" || !tray || (tray === "prepare" && ["pendiente", "pago_pendiente", "pagado"].includes(order.orderStatus) && !order.requiresReview) || (tray === "dispatch" && order.orderStatus === "en_preparacion" && !order.requiresReview) || (tray === "transit" && order.orderStatus === "enviado") || (tray === "collection" && order.orderStatus === "entregado" && order.paymentMethod === "contra_entrega" && order.paymentStatus === "pendiente") || (tray === "review" && order.requiresReview);
    const count = (rows, role) => Object.fromEntries(["prepare", "dispatch", "transit", "collection", "review", "all", ...(role === "admin" ? ["communications"] : [])].map((tray) => [tray, tray === "communications" ? 0 : rows.filter((order) => inTray(order, tray)).length]));
    let failNext = false;
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
      if (url.pathname.startsWith("/mock/orders")) {
        res.setHeader("Content-Type", "application/json");
        if (failNext) { failNext = false; await new Promise((resolve) => setTimeout(resolve, 400)); res.statusCode = 503; return res.end(JSON.stringify({ message: "Fallo de prueba" })); }
        const role = url.searchParams.get("role") || "admin";
        const q = (url.searchParams.get("q") || "").toLowerCase();
        const method = url.searchParams.get("paymentMethod");
        const base = records.filter((order) => (!q || `${order.orderNumber} ${order.buyer.name}`.toLowerCase().includes(q)) && (!method || method === order.paymentMethod));
        const rows = base.filter((order) => inTray(order, url.searchParams.get("tray")));
        const page = Number(url.searchParams.get("page")) || 1;
        const limit = Number(url.searchParams.get("limit")) || 15;
        return res.end(JSON.stringify({ total: rows.length, page, totalPages: Math.max(1, Math.ceil(rows.length / limit)), counts: count(base, role), orders: rows.slice((page - 1) * limit, page * limit).map((order) => dto(order, role)) }));
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR</title><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
    const page = await browser.newPage();
    page.on("pageerror", (error) => result.pageErrors.push(error.stack || error.message));
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith(origin) || request.url().startsWith("data:")) request.continue();
      else { result.externalRequests.push(request.url()); request.abort(); }
    });
    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} } }); });
    const text = async (value) => page.waitForFunction((sample) => document.body.innerText.toLowerCase().includes(sample.toLowerCase()), {}, value);
    const goto = async (target, value) => { await page.goto(origin + target, { waitUntil: "domcontentloaded" }); if (value) await text(value); };
    const button = async (label) => (await page.evaluateHandle((sample) => [...document.querySelectorAll("button")].find((node) => node.textContent.trim() === sample), label)).asElement();
    const click = async (label) => { const node = await button(label); assert.ok(node, label); await node.click(); };
    const metrics = () => page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      wrap: (() => { const node = document.querySelector(".op-table-wrap"); return node ? node.scrollWidth - node.clientWidth : 0; })(),
      card: document.querySelector(".op-table tbody tr")?.getBoundingClientRect().height || 0,
      caption: document.querySelector("caption")?.getBoundingClientRect().height || 0,
    }));
    const check = (label) => result.checks.push(label);

    await page.setViewport({ width: 1440, height: 1000 });
    await goto("/admin/pedidos?tray=prepare", "Por preparar");
    assert.equal(await page.$eval('a.op-tray[aria-current="page"]', (node) => node.textContent.includes("Por preparar")), true);
    assert.match(await page.$eval(".op-tray__count", (node) => node.textContent), /\d/);
    await shot(page, "pedidos-escritorio.png");
    check("1-2 listado y bandeja activa con contador");
    await page.type('input[name="q"]', "Cliente de prueba nuevo1");
    await click("Aplicar filtros");
    await page.waitForFunction(() => location.search.includes("q=Cliente"));
    assert.equal(await page.$eval('input[name="q"]', (node) => node.value), "Cliente de prueba nuevo1");
    await text("DIZ-PRUEBA-NUEVO1");
    check("4 búsqueda conservada en la URL");
    await click("Filtros");
    await page.waitForSelector("#order-advanced-filters.is-open");
    assert.ok(await page.$('select[name="orderStatus"]'));
    assert.ok(await page.$('input[name="from"]'));
    await shot(page, "pedidos-filtros.png");
    await page.select('select[name="paymentMethod"]', "contra_entrega");
    await click("Aplicar filtros");
    await page.waitForFunction(() => location.search.includes("paymentMethod=contra_entrega"));
    await text("Filtros activos");
    await page.click('a[href="/admin/pedidos?tray=prepare"]');
    await page.waitForFunction(() => !location.search.includes("q=") && location.search.includes("tray=prepare"));
    check("5-7 filtros, limpieza y URL");
    await goto("/admin/pedidos?tray=all&limit=2&page=2", "Página 2 de");
    const back = page.url();
    const href = await page.$eval("table tbody tr a", (node) => node.getAttribute("href"));
    assert.ok(decodeURIComponent(href).includes(back.replace(origin, "")));
    await page.click("table tbody tr a");
    assert.ok(page.url().includes("/admin/pedidos/"));
    check("7-8 enlace de regreso y paginación");
    await goto("/admin/pedidos?tray=all", "DIZ-…567890");
    const longCell = await page.$eval('a[title="DIZ-20261123-ABCDEF1234567890"]', (node) => ({ short: node.querySelector("[aria-hidden]").textContent, full: node.getAttribute("title") }));
    assert.equal(longCell.short, "DIZ-…567890");
    assert.equal(longCell.full, "DIZ-20261123-ABCDEF1234567890");
    assert.match(await page.$eval('button[aria-label="Copiar número de pedido DIZ-20261123-ABCDEF1234567890"]', (node) => node.getAttribute("aria-label")), /DIZ-20261123/);
    check("9-10 referencia larga abreviada y copiable");
    await text("Recaudo pendiente");
    await text("Pagado");
    await text("Rechazado");
    await text("Reembolsado");
    await text("Pago pendiente");
    const delivered = await page.evaluate(() => [...document.querySelectorAll("tr")].find((row) => row.innerText.includes("Cliente de prueba recaudo"))?.innerText || "");
    assert.match(delivered, /Recaudo pendiente/);
    assert.equal(delivered.includes("Pagado"), false);
    check("11 estados financieros sin marcar cobrada una entrega pendiente");
    const actions = await page.evaluate(() => ({
      prepare: [...document.querySelectorAll("tr")].some((row) => row.innerText.includes("Cliente de prueba nuevo0") && row.querySelector("a.op-action")?.textContent.includes("Comenzar preparación")),
      waiting: [...document.querySelectorAll("tr")].filter((row) => row.innerText.includes("Cliente de prueba wompi")).map((row) => ({ text: row.innerText, action: !!row.querySelector("a.op-action"), note: row.querySelector(".op-note")?.innerText || "" }))[0],
    }));
    assert.equal(actions.prepare, true);
    assert.match(actions.waiting.text, /Esperando confirmación del pago/);
    assert.equal(actions.waiting.action, false);
    assert.match(actions.waiting.note, /Ver pedido/);
    check("12-13 acción real y estado informativo");
    await click("Exportar");
    await text("PDF operativo");
    await text("no usa la bandeja");
    assert.equal(await page.$eval('.op-menu__panel a[href="/admin/contenido?tab=exports&scope=orders"]', (node) => node.textContent.trim()), "CSV general");
    await click("Exportar PDF");
    assert.deepEqual(await page.evaluate(() => window.__pdf), { tray: "all" });
    check("14-16 PDF filtrado y CSV general distinguibles");
    await page.setViewport({ width: 390, height: 844 });
    await goto("/admin/pedidos?tray=prepare", "Por preparar");
    assert.equal(await page.$eval(".op-trays", (node) => getComputedStyle(node).display), "none");
    assert.equal(await page.$eval('select[aria-label="Bandeja de pedidos"]', (node) => node.value), "prepare");
    const narrow = await metrics();
    assert.ok(narrow.pageOverflow <= 1, JSON.stringify(narrow));
    assert.ok(narrow.wrap <= 1, JSON.stringify(narrow));
    assert.ok(narrow.card > 0 && narrow.card < 230, JSON.stringify(narrow));
    assert.ok(narrow.caption < 60, JSON.stringify(narrow));
    await shot(page, "pedidos-movil-390.png");
    await page.select('select[aria-label="Bandeja de pedidos"]', "transit");
    await page.waitForFunction(() => location.search.includes("tray=transit"));
    await text("En camino");
    check("3 cambio de bandeja en móvil");
    await page.setViewport({ width: 360, height: 800 });
    await goto("/admin/pedidos?tray=all", "DIZ-…567890");
    const tiny = await metrics();
    assert.ok(tiny.pageOverflow <= 1 && tiny.wrap <= 1 && tiny.card < 240, JSON.stringify(tiny));
    await shot(page, "pedidos-movil-360.png");
    await click("Filtros");
    await page.waitForSelector("#order-advanced-filters.is-open");
    const filtersNarrow = await metrics();
    assert.ok(filtersNarrow.pageOverflow <= 1, JSON.stringify(filtersNarrow));
    await shot(page, "pedidos-filtros-movil.png");
    check("9 tarjetas compactas sin desborde");
    for (const [width, height, name] of [[1024, 900, "pedidos-1024.png"], [820, 1180, "pedidos-tablet.png"]]) {
      await page.setViewport({ width, height });
      await goto("/admin/pedidos?tray=all", "Pedidos");
      const size = await metrics();
      assert.ok(size.pageOverflow <= 1, `${name} ${JSON.stringify(size)}`);
      await shot(page, name);
    }
    check("23 responsive 1440, 1024, 820, 390 y 360");
    await page.setViewport({ width: 1440, height: 900 });
    await goto("/admin/pedidos?q=nadie-ficticio", "No hay coincidencias para estos filtros.");
    await goto("/admin/pedidos?tray=dispatch", "No hay pedidos pendientes en esta bandeja.");
    failNext = true;
    await goto("/admin/pedidos?tray=all", "Cargando pedidos");
    await text("No se pudieron cargar los pedidos");
    assert.equal(await page.evaluate(() => document.body.innerText.includes("Todavía no hay pedidos")), false);
    await click("Reintentar carga");
    await text("DIZ-PRUEBA-NUEVO0");
    check("19-21 vacío, carga, error y recuperación");
    await page.focus("main");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.tagName !== "BODY"), true);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter((node) => !node.closest("label") && !node.labels?.length).length), 0);
    check("22 campos etiquetados y foco de teclado");
    await goto("/vendedor/pedidos", "Pedidos");
    assert.equal(await page.$('a[href="/admin/contenido?tab=exports&scope=orders"]'), null);
    assert.equal(await page.$('a[href*="tray=communications"]'), null);
    await click("Exportar");
    assert.equal(await page.evaluate(() => document.body.innerText.includes("CSV general")), false);
    await text("Exportar PDF");
    check("18 vendedor sin CSV ni bandeja de comunicaciones");
    await page.setViewport({ width: 1440, height: 900 });
    await goto("/admin/contenido?tab=exports&scope=orders", "Exportar pedidos");
    await text("Exportaciones de pedidos");
    await text("No aplica la bandeja");
    await text("Hasta 5.000");
    assert.equal(await page.$$eval("button", (nodes) => nodes.filter((node) => node.textContent.trim().startsWith("Exportar")).length), 1);
    assert.equal(await page.$(".op-export .cms-tabs"), null);
    await shot(page, "exportacion-escritorio.png");
    const before = await page.evaluate(() => window.__csv || 0);
    await click("Exportar pedidos (CSV)");
    assert.equal(await page.evaluate(() => window.__csv), before + 1);
    assert.equal(await page.evaluate(() => window.__pdf), undefined);
    await page.setViewport({ width: 390, height: 844 });
    const exportNarrow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(exportNarrow <= 1, String(exportNarrow));
    await shot(page, "exportacion-movil.png");
    await page.setViewport({ width: 1440, height: 900 });
    await goto("/admin/contenido?tab=exports&scope=all", "Exportaciones históricas");
    assert.equal(await page.$$eval("button", (nodes) => nodes.filter((node) => node.textContent.trim().startsWith("Exportar")).length), 3);
    await text("Volver a Newsletter");
    check("15-17 CSV de pedidos, diferencia de alcance y exportaciones históricas");
    assert.deepEqual(result.pageErrors, []);
    assert.deepEqual(result.externalRequests, []);
    result.passed = true;
  } finally {
    fs.writeFileSync(path.join(out, "resultado.json"), `${JSON.stringify(result, null, 2)}\n`);
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(stage, { recursive: true, force: true });
  }
  process.stdout.write(`${JSON.stringify({ passed: result.passed, checks: result.checks, shots: result.shots, pageErrors: result.pageErrors }, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
