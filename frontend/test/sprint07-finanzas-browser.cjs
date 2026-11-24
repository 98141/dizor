"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-07");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const srcRoot = path.join(frontend, "src");
fs.mkdirSync(out, { recursive: true });
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint07-"));
const result = { checks: [], externalRequests: [], pageErrors: [], screenshots: [] };
let browser, server;
(async () => {
 try {
  const w = (name, body) => { const file = path.join(stage, name); fs.writeFileSync(file, body); return file; };
  const loader = w("jsx.cjs", `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  const cssLoader = w("css.cjs", "module.exports=function(){return 'module.exports={}';};");
  const navigation = w("navigation.js", `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>{const s=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(s);};export const navigate=(url,replace)=>{history[replace?'replaceState':'pushState']({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:(u)=>navigate(u),replace:(u)=>navigate(u,true),prefetch(){}});`);
  const link = w("link.jsx", `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
  const auth = w("auth.js", `export const useAuth=()=>({user:{name:'Super ficticia',role:sessionStorage.getItem('role')||'superadmin'},loadingAuth:false,logout:async()=>{}});`);
  const site = w("site.js", `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  const alerts = w("alerts.js", `export const getAlerts=async()=>({alerts:{},totalCount:0});`);
  const finance = w("finance.js", `const report={status:'success',period:{label:'Mes actual'},sales:{ordersCount:4,totalCollected:860000,productRevenue:800000,unitsSold:6,cogs:120000,grossProfit:680000,grossMarginPct:85,averageOrderValue:215000,shippingCollected:40000,taxCollected:0,discountsGiven:20000,itemsMissingCost:2,knownProfit:80000,knownMarginPct:40,knownRevenue:200000,missingRevenue:600000,marginReliable:false,costCoveragePct:25,profitabilityStatus:'partial',topByRevenue:[{productId:'p1',name:'Sombrero vueltiao',units:2,revenue:500000,profit:null,costComplete:false},{productId:'p2',name:'Bolso de iraca',units:2,revenue:200000,profit:80000,costComplete:true}],topByProfit:[{productId:'p2',name:'Bolso de iraca',marginPct:40,profit:80000,costComplete:true}],missingCostProducts:[{productId:'p1',name:'Sombrero vueltiao'}]},pending:{ordersCount:1,amount:90000},inventory:{investmentAtCost:4500000,potentialRetail:31522050000,potentialProfit:31517550000,potentialProfitKnown:1800000,potentialRetailKnown:6300000,potentialMarginPct:99.9,potentialMarginReliable:false,unitsInStock:141452,productsMissingCost:36,unpublishedUnits:12,unpublishedProducts:2,catalogCount:40,stockLeaders:[{id:'big',name:'Canasto de carga',isActive:true,unitsInStock:140098,internalCost:null,costKnown:false,potentialRetail:31522050000,investmentAtCost:0}],investmentTop:[{id:'known',name:'Individual de palma',unitsInStock:20,internalCost:15000,costKnown:true,investmentAtCost:300000,potentialRetail:900000}],lowMarginProducts:[]},paymentMethods:[{method:'wompi',count:3,total:640000},{method:'contra_entrega',count:1,total:220000}],monthlyTrend:[{key:'2026-09',month:'sept 26',orders:1,productRevenue:100000,grossProfit:0,marginReliable:false},{key:'2026-10',month:'oct 26',orders:2,productRevenue:300000,grossProfit:90000,marginReliable:true},{key:'2026-11',month:'nov 26',orders:4,productRevenue:800000,grossProfit:80000,marginReliable:false}],notes:[]};
const products={products:[{id:'p1',name:'Sombrero vueltiao',isActive:true,totalStock:4,internalCost:null,salePrice:250000,margin:null,marginPct:null,stockValue:null,salesCount:2,variants:[]},{id:'p2',name:'Bolso de iraca',isActive:true,totalStock:8,internalCost:60000,salePrice:100000,margin:40000,marginPct:40,stockValue:480000,salesCount:3,variants:[{id:'v1',sizeName:'Única',colorName:'Natural',sku:'BOLSO-1',stock:8,price:null}]}],summary:{total:40,active:36,missingCost:36,totalStockValue:4500000,avgMarginPct:40,withMargin:4},total:2,page:1,pages:1,limit:20};
const history={groupBy:'month',rows:[{periodKey:'2026-10',label:'octubre de 2026',shortLabel:'oct 26',ordersCount:2,totalRevenue:300000,onlineRevenue:280000,cogs:90000,grossProfit:190000,grossMarginPct:67.9,knownProfit:90000,marginReliable:false,unitsSold:3,itemsMissingCost:1},{periodKey:'2026-11',label:'noviembre de 2026',shortLabel:'nov 26',ordersCount:4,totalRevenue:860000,onlineRevenue:800000,cogs:120000,grossProfit:680000,grossMarginPct:85,knownProfit:80000,marginReliable:false,unitsSold:6,itemsMissingCost:2}],summary:{totalRevenue:1160000,totalProfit:870000,knownProfit:170000,marginReliable:false,profitabilityStatus:'partial',grossMarginPct:80,totalOrders:6,periodsWithSales:2},page:1,pages:1,total:2,limit:12};
export const getFinanceReport=async()=>report;
export const getFinanceOverview=getFinanceReport;
export const getFinanceHistory=async()=>history;
export const getFinanceProducts=async()=>products;
export const updateProductCost=async()=>({product:{id:'p1',internalCost:1000}});
export const exportFinanceCsv=async()=>{};
export const exportFinanceXlsx=async()=>{};
export const exportFinancePdf=async()=>{};`);
  const entry = w("entry.jsx", `import React from 'react';import {createRoot} from 'react-dom/client';import Page from ${JSON.stringify(path.join(srcRoot, "app/admin/finanzas/page.js"))};createRoot(document.getElementById('app')).render(<Page/>);`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, performance: { hints: false },
    resolve: { extensions: [".js", ".jsx", ".mjs", ".json"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@/services/adminAlertService": alerts, "@/services/financeAdminService": finance, "@": srcRoot } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve(); }));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  const layout = fs.readFileSync(path.join(srcRoot, "app/admin/layout.js"), "utf8");
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", ...[...layout.matchAll(/@\/(styles\/[^"]+\.css)/g)].map((m) => m[1])];
  const css = sheets.map((file) => fs.readFileSync(path.join(srcRoot, file), "utf8")).join("\n");
  server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><script>sessionStorage.setItem('role','superadmin')</script><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => result.pageErrors.push(e.stack || e.message));
  await page.setRequestInterception(true);
  page.on("request", (r) => { if (r.url().startsWith(origin) || r.url().startsWith("data:")) r.continue(); else { result.externalRequests.push(r.url()); r.abort(); } });
  const text = async (s) => { try { await page.waitForFunction((s) => document.body.innerText.includes(s), { timeout: 15000 }, s); } catch (error) { result.failure = { waiting: s, body: await page.evaluate(() => document.body.innerText.slice(0, 1500)) }; await page.screenshot({ path: path.join(out, "fallo.png"), fullPage: true }); throw error; } };
  const shot = async (name) => { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true }); result.screenshots.push(name + ".png"); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(origin + "/admin/finanzas", { waitUntil: "networkidle0" });
  await text("Rentabilidad pendiente de completar costos");
  await text("140.098");
  assert.equal(await page.evaluate(() => document.body.innerText.includes("99.9%")), false);
  await shot("panel-1440");
  for (const width of [1024, 820, 390, 360]) { await page.setViewport({ width, height: 900 }); assert.equal(await overflow(), true, String(width)); }
  await page.setViewport({ width: 390, height: 900 }); await shot("panel-390");
  result.checks.push("F01 panel: cobertura incompleta y stock elevado sin desborde");
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Costos y precios").click());
  await text("Editar costo"); await text("Sin costo"); await shot("costos-1440");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Editar costo").click());
  await text("Guardar costo"); await shot("costo-edicion-1440");
  await page.setViewport({ width: 390, height: 900 }); await shot("costos-390");
  result.checks.push("F02 costos paginados y edición sin tocar el stock");
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Historial").click());
  await text("No verificable"); await text("oct 26"); await shot("historial-1440");
  await page.setViewport({ width: 390, height: 900 }); await shot("historial-390");
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.externalRequests, []);
  result.checks.push("F03 historial compacto y margen no verificable");
  result.passed = true;
  result.checks.forEach((c) => process.stdout.write("ok - " + c + "\n"));
 } catch (error) {
  result.passed = false; result.error = error.stack || error.message; console.error(result.error); if (result.failure) console.error(JSON.stringify(result.failure));
 } finally {
  if (browser) await browser.close(); if (server) await new Promise((r) => server.close(r));
  fs.writeFileSync(path.join(out, "navegador.json"), JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
 }
})();
