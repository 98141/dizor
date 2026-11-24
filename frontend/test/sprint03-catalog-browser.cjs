"use strict";
// Isolated React render of the catalog redesign. No Next server, Mongo, .env or external calls.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-03");
fs.mkdirSync(out, { recursive: true });
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const inventory = require(path.join(root, "backend/src/services/inventoryCriteria"));
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint03-"));
const result = { checks: [], externalRequests: [], pageErrors: [], shots: [] };
let browser, server;
const shot = async (page, name) => { await page.screenshot({ path: path.join(out, name), fullPage: true }); result.shots.push(name); };
(async () => {
 try {
  const loader = path.join(stage, "jsx.cjs"), cssLoader = path.join(stage, "css.cjs"), api = path.join(stage, "api.js"), navigation = path.join(stage, "navigation.js"), link = path.join(stage, "link.jsx"), auth = path.join(stage, "auth.js"), site = path.join(stage, "site.js"), entry = path.join(stage, "entry.jsx");
  fs.writeFileSync(loader, `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  fs.writeFileSync(cssLoader, "module.exports=function(){return 'module.exports={}';};");
  fs.writeFileSync(navigation, "import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));export const navigate=(url)=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:navigate});");
  fs.writeFileSync(link, "import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented&&String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}");
  fs.writeFileSync(auth, "export const useAuth=()=>({user:{id:'admin-test',name:'Operador ficticio',role:window.__role||'admin'},logout:async()=>{}});");
  fs.writeFileSync(site, "export const useSiteConfig=()=>({siteName:'DIZOR'});");
  fs.writeFileSync(api, "async function request(url,data,method='GET'){const r=await fetch('/mock'+url+(url.includes('?')?'&':'?')+'role='+(window.__role||'admin'),{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}export const getAdminProducts=(p)=>request('/products?'+new URLSearchParams(p));export const getAdminProduct=(id)=>request('/products/'+id);export const getCatalogMeta=()=>request('/meta');export const getAlerts=()=>request('/alerts');export const updateAdminProduct=(id,b)=>request('/products/'+id,b,'PATCH');export const createAdminProduct=(b)=>request('/products',b,'POST');export const adjustProductStock=(id,b)=>request('/products/'+id+'/stock',b,'POST');export const getStockOperation=(id,key)=>request('/operations/'+id+'/'+key);export const uploadProductImages=async()=>({images:[]});export const uploadTempImages=async()=>({images:[]});export const getTaxonomy=(type)=>request('/taxonomy/'+type);export const createTaxonomyItem=(type,b)=>request('/taxonomy/'+type,b,'POST');export const updateTaxonomyItem=(type,id,b)=>request('/taxonomy/'+type+'/'+id,b,'PATCH');export const deleteTaxonomyItem=(type,id)=>request('/taxonomy/'+type+'/'+id,null,'DELETE');export const getProductHistory=(p)=>request('/history?'+new URLSearchParams(p));export const getProductHistoryStats=()=>request('/history/stats');export const exportProductHistoryPdf=(p)=>request('/history/export?'+new URLSearchParams(p));");
  fs.writeFileSync(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from './navigation';import Shell from ${JSON.stringify(path.join(frontend, "src/components/admin/AdminShell.jsx"))};import Catalog from ${JSON.stringify(path.join(frontend, "src/components/admin/CatalogWorkspace.jsx"))};import Taxonomy from ${JSON.stringify(path.join(frontend, "src/components/admin/TaxonomyManager.jsx"))};function App(){const p=usePathname();return <Shell>{p.startsWith('/admin/catalogo')?<div className="admin-page op-tax"><h1>Configuración del catálogo</h1><p className="admin-page__subtitle">Categorías, colores, tallas, tejidos y estilos para armar productos.</p><Taxonomy/></div>:<Catalog/>}</Shell>}createRoot(document.getElementById('app')).render(<App/>);`);
  await new Promise((resolve, reject) => webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, resolve: { extensions: [".js", ".jsx"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "@/services/adminCatalogService": api, "@/services/productHistoryService": api, "@/services/adminAlertService": api, "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@": path.join(frontend, "src") } }, module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.css$/, use: cssLoader }] } }).run((err, stats) => err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", "styles/layouts/admin-layout.css", "styles/pages/admin-products.css", "styles/pages/admin-orders.css", "styles/layouts/admin-polish.css", "styles/components/auth-form.css"];
  const css = sheets.map((file) => fs.readFileSync(path.join(frontend, "src", file), "utf8")).join("\n");
  const id = (n) => String(n).padStart(24, "0");
  const make = (i) => ({ id: id(i + 1), name: i === 0 ? "Sombrero artesanal" : i === 1 ? "Bolso de iraca" : `Artículo ficticio ${i}`, slug: "ficticio-" + i, category: { _id: "c1", name: "Sombreros" }, weaveType: { _id: "w1", name: "Tejido fino" }, salePrice: 80000, effectivePrice: 80000, internalCost: 32000, isActive: i !== 3, mainImage: "/fixture-image.svg", variants: [{ id: id(100 + i), sku: "DIZ-" + i, stock: i === 3 ? 0 : 12, isActive: i !== 2, price: null }] });
  const products = Array.from({ length: 4 }, (_, i) => make(i));
  products[0].variants = [{ id: id(1010), sku: "SOM-S", stock: 8, size: { name: "S" }, color: { name: "Natural" }, isActive: true }, { id: id(1011), sku: "SOM-M", stock: 3, size: { name: "M" }, color: { name: "Natural" }, isActive: true }, { id: id(1012), sku: "SOM-L", stock: 0, size: { name: "L" }, color: { name: "Natural" }, isActive: true }, { id: id(1013), sku: "SOM-X", stock: null, isActive: true }, { id: id(1014), sku: "SOM-Z", stock: 4, size: { name: "Única" }, color: { name: "Negro" }, isActive: false }];
  products[2].variants[0].isActive = false;
  const format = (p) => ({ ...p, inventory: inventory.summarize(p), variants: p.variants.map((v) => ({ ...v, stockStatus: inventory.variantStatus(v) })) });
  const records = [{ id: "h1", productId: products[0].id, variantId: products[0].variants[1].id, productName: "Sombrero artesanal", sku: "SOM-M", sizeName: "M", colorName: "Natural", eventType: "stock_adjustment", quantityChange: -1, stockBefore: 4, stockAfter: 3, userEmail: "operador@example.test", referenceType: "admin", summary: "Retiro de prueba", createdAt: "2026-11-23T15:00:00Z" }];
  const operations = new Map(); let loseApplied = false;
  const taxonomy = { categories: [{ _id: "c1", name: "Sombreros de iraca", description: "Hormas de palma", sortOrder: 1, isActive: true }, { _id: "c2", name: "Bolsos", description: "", sortOrder: 2, isActive: false }], colors: [{ _id: "col1", name: "Natural", hexCode: "#d5ad71", sortOrder: 1, isActive: true }], sizes: [{ _id: "s1", name: "M", label: "56-58 cm", sortOrder: 1, isActive: true }], "weave-types": [{ _id: "w1", name: "Tejido fino", description: "", sortOrder: 1, isActive: true }], styles: [{ _id: "st1", name: "Borsalino", description: "", sortOrder: 1, isActive: true }] };
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost"); const send = (body, status = 200) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    if (url.pathname === "/fixture-image.svg") { res.setHeader("Content-Type", "image/svg+xml"); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#f6f4ef"/></svg>'); }
    if (url.pathname.startsWith("/mock")) {
      if (url.pathname === "/mock/meta") return send({ meta: { categories: [{ _id: "c1", name: "Sombreros" }], weaveTypes: [{ _id: "w1", name: "Tejido fino" }] } });
      if (url.pathname === "/mock/alerts") return send({ alerts: {}, totalCount: 0 });
      if (url.pathname.startsWith("/mock/taxonomy/")) { const type = url.pathname.split("/")[3]; return send({ items: taxonomy[type] || [] }); }
      if (url.pathname === "/mock/history/stats") return send({ stats: { total: 1, today: 1, unitsSoldToday: 0, stockAdjustmentsToday: 1 } });
      if (url.pathname === "/mock/history/export") return send({ status: "success" });
      if (url.pathname === "/mock/history") return send({ history: records, total: records.length, page: 1, totalPages: 1, filters: { products: products.slice(0, 2).map((p) => ({ id: p.id, name: p.name })), eventTypes: ["stock_adjustment"], actors: [{ id: "admin-test", email: "operador@example.test" }] } });
      if (url.pathname.startsWith("/mock/operations/")) { const op = operations.get(url.pathname.split("/").at(-1)); return send(op ? { ...op, found: true, currentStock: op.stock } : { found: false }); }
      if (url.pathname === "/mock/products" && req.method === "GET") {
        let rows = products.filter((p) => !url.searchParams.get("productId") || p.id === url.searchParams.get("productId"));
        const q = (url.searchParams.get("q") || "").toLowerCase(); if (q) rows = rows.filter((p) => `${p.name} ${p.variants.map((v) => v.sku).join(" ")}`.toLowerCase().includes(q));
        return send({ products: rows.map(format), total: rows.length, page: 1, totalPages: 1, threshold: 5 });
      }
      const product = products.find((p) => p.id === url.pathname.split("/")[3]);
      let raw = ""; for await (const chunk of req) raw += chunk; const body = raw ? JSON.parse(raw) : {};
      if (url.pathname.endsWith("/stock")) {
        const variant = product.variants.find((v) => v.id === body.variantId);
        if (!operations.has(body.operationKey)) { variant.stock += body.delta; operations.set(body.operationKey, { stock: variant.stock, variantId: variant.id, delta: body.delta, reason: body.reason }); }
        if (loseApplied) { loseApplied = false; return send({ message: "Resultado no confirmado" }, 503); }
        return send({ ...operations.get(body.operationKey), currentStock: variant.stock });
      }
      return send({ product: format(product) });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:'production'}};window.__role=new URLSearchParams(location.search).get('role')==='vendor'?'vendedor':'admin';</script><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--disable-sync", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const page = await browser.newPage(); page.on("pageerror", (e) => result.pageErrors.push(String(e)));
  await page.setRequestInterception(true); page.on("request", (r) => r.url().startsWith(origin) || r.url().startsWith("data:") ? r.continue() : (result.externalRequests.push(r.url()), r.abort()));
  const text = (s) => page.waitForFunction((value) => document.body.innerText.toLowerCase().includes(value.toLowerCase()), {}, s);
  const click = async (s) => { const handle = await page.evaluateHandle((value) => [...document.querySelectorAll("button,a")].find((b) => b.textContent.trim() === value && b.getClientRects().length), s); const el = handle.asElement(); assert.ok(el, s); await el.click(); };
  const bodyHas = (s) => page.evaluate((value) => document.body.innerText.includes(value), s);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin + "/admin/productos"); await text("Sombrero artesanal");
  assert.equal(await bodyHas("SOM-S"), false); assert.equal(await bodyHas("Más opciones"), false);
  await shot(page, "productos-escritorio.png"); result.checks.push("1 productos compactos, sin SKU ni menú duplicado");
  await page.click("button[aria-controls='catalog-advanced-filters']"); await text("Categoría"); await shot(page, "productos-filtros.png");
  await page.type("input[name=q]", "Bolso"); await click("Aplicar filtros"); await page.waitForFunction(() => location.search.includes("q=Bolso")); await text("1 producto");
  await click("Limpiar filtros"); await page.waitForFunction(() => !location.search.includes("q=")); result.checks.push("19 filtros, URL y limpieza");
  await page.goto(origin + "/admin/productos?view=stock"); await text("Ver existencias"); assert.equal(await bodyHas("SOM-L"), false);
  await shot(page, "existencias-contraidas.png"); result.checks.push("2 existencias contraídas");
  await click("Ver existencias"); await text("SOM-S"); await text("Agotado"); await text("Revisar existencias"); await text("Inactiva");
  assert.equal(await page.$$eval("button", (nodes) => nodes.filter((n) => n.textContent.trim() === "Ocultar existencias").length), 1);
  await shot(page, "existencias-expandido.png"); result.checks.push("3, 8, 9, 10 y 11 apertura, agotado, inactiva y revisión");
  await click("Ocultar existencias"); assert.equal(await bodyHas("SOM-S"), false); result.checks.push("4 cierre del mismo producto");
  await page.setViewport({ width: 390, height: 844 }); await page.goto(origin + "/admin/productos?view=stock"); await text("Ver existencias");
  const buttons = await page.$$("button"); const labels = await Promise.all(buttons.map((b) => b.evaluate((n) => n.textContent.trim())));
  const first = labels.indexOf("Ver existencias"), second = labels.indexOf("Ver existencias", first + 1);
  await buttons[first].click(); await text("SOM-S"); await buttons[second].click(); await text("DIZ-1");
  assert.equal(await bodyHas("SOM-S"), false); assert.equal(await page.$$eval("button", (nodes) => nodes.filter((n) => n.textContent.trim() === "Ocultar existencias").length), 1);
  await shot(page, "existencias-movil.png"); result.checks.push("5 acordeón móvil: abrir otro cierra el anterior");
  await page.setViewport({ width: 1440, height: 1000 });
  const target = `/admin/productos?view=stock&productId=${products[0].id}&variantId=${products[0].variants[1].id}`;
  await page.goto(origin + target); await text("SOM-M"); await text("Stock bajo");
  assert.ok(await page.$eval("[tabindex='-1']", (e) => e === document.activeElement));
  assert.equal(await bodyHas("DIZ-1"), false); result.checks.push("6 y 7 enlace de alerta, foco y un solo producto");
  await click("Ajustar existencias · SOM-M"); await text("Stock actual mostrado:"); await shot(page, "ajuste-abierto.png");
  await page.type("input[name=adjustmentQuantity]", "2"); await page.type("input[name=adjustmentReason]", "Reposición de prueba");
  await click("Revisar ajuste"); await text("Confirmar ajuste"); const before = operations.size;
  await page.evaluate(() => { const button = [...document.querySelectorAll("button")].find((node) => node.textContent.trim() === "Confirmar ajuste"); button.click(); button.click(); });
  await text("Stock actual consultado: 5"); assert.equal(operations.size, before + 1); result.checks.push("12 y 14 ajuste positivo y doble clic");
  await text("Ajustar existencias · SOM-M"); await click("Ajustar existencias · SOM-M"); await page.select("section[aria-label='Ajustar SOM-M'] select", "remove");
  await page.type("input[name=adjustmentQuantity]", "1"); await page.type("input[name=adjustmentReason]", "Retiro de prueba");
  await click("Revisar ajuste"); await text("Confirmar ajuste"); await click("Confirmar ajuste"); await text("Stock actual consultado: 4"); result.checks.push("13 ajuste negativo");
  await text("Ajustar existencias · SOM-M"); await click("Ajustar existencias · SOM-M"); await page.type("input[name=adjustmentQuantity]", "1"); await page.type("input[name=adjustmentReason]", "Respuesta perdida");
  loseApplied = true; await click("Revisar ajuste"); await text("Confirmar ajuste"); await click("Confirmar ajuste"); await text("Resultado no confirmado");
  const pending = [...operations.keys()].at(-1); await click("Cerrar panel (se conserva la operación)"); await page.goto(origin + target); await text("Ajustar existencias · SOM-M"); await click("Ajustar existencias · SOM-M");
  await text("Existe un ajuste por comprobar"); await click("Comprobar resultado"); await text("Stock actual consultado: 5"); assert.ok(operations.has(pending));
  result.checks.push("15 y 16 resultado ambiguo y clave conservada");
  await page.goto(origin + "/admin/productos?view=movements"); await text("Retiro de prueba"); await text("operador@example.test");
  assert.equal(await bodyHas("Saldo anterior"), false); await shot(page, "movimientos-escritorio.png");
  await click("Ver detalle"); await text("Saldo anterior"); await text("SOM-M"); result.checks.push("17 y 18 historial y detalle");
  await page.setViewport({ width: 390, height: 844 }); await shot(page, "movimientos-movil.png"); result.checks.push("23 movimientos móvil");
  await page.setViewport({ width: 1440, height: 1000 }); await page.goto(origin + "/admin/productos?role=vendor"); await text("Sombrero artesanal");
  assert.equal(await bodyHas("Desactivar publicación"), false); assert.equal(await bodyHas("Costo interno"), false); assert.equal(await bodyHas("Movimientos"), false);
  result.checks.push("21 vendedor sin edición, costo ni historial");
  await page.setViewport({ width: 360, height: 800 }); await page.goto(origin + "/admin/productos"); await text("Sombrero artesanal"); await shot(page, "productos-movil-360.png");
  await page.setViewport({ width: 390, height: 844 }); await shot(page, "productos-movil.png");
  for (const width of [1440, 1024, 820, 390, 360]) { await page.setViewport({ width, height: 900 }); await page.goto(origin + "/admin/productos?view=stock"); await text("Ver existencias"); assert.ok(await overflow(), String(width)); }
  result.checks.push("23 responsive sin desborde");
  const visible = () => page.evaluate(() => [...document.querySelectorAll(".taxonomy-list-card td.admin-table__actions button")].map((button) => { const r = button.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(button); const label = range.getBoundingClientRect(); return r.width > 0 && label.right <= innerWidth + 1 && label.left >= -1 && button.scrollWidth <= button.clientWidth + 1; }));
  for (const width of [1440, 1100, 1024, 900, 390, 360]) {
    await page.setViewport({ width, height: 900 }); await page.goto(origin + "/admin/catalogo"); await text("Sombreros de iraca");
    assert.ok((await visible()).every(Boolean), `F6 ${width}`); if (width === 1440) await shot(page, "configuracion-escritorio.png"); if (width === 390) await shot(page, "configuracion-movil.png");
  }
  result.checks.push("24 F6-I01 acciones visibles");
  await page.keyboard.press("Tab"); assert.ok(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body)); result.checks.push("22 foco de teclado");
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.externalRequests, []); result.passed = true;
 } finally {
  fs.writeFileSync(path.join(out, "resultado.json"), JSON.stringify(result, null, 2) + "\n");
  if (browser) await browser.close(); if (server) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(stage, { recursive: true, force: true });
 }
 process.stdout.write(JSON.stringify(result, null, 2) + "\n");
})().catch((error) => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
