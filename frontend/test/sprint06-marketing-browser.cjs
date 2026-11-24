"use strict";
// Sprint 06: Marketing real (cupones, popup, newsletter, carritos) con API local.
// Sin Next, Mongo, correos ni red externa.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-06");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const srcRoot = path.join(frontend, "src");
fs.mkdirSync(out, { recursive: true });
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint06-"));
const result = { checks: [], externalRequests: [], pageErrors: [], consoleErrors: [], mutations: [], screenshots: [] };
let browser, server;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const marketing = { key: "default", popup: { title: "Aviso de taller", text: "Piezas nuevas de iraca.", ctaLabel: "", ctaHref: "", imageUrl: "", variant: "newsletter", couponCode: "", enabled: true, showNewsletterForm: true, delaySeconds: 4 }, newsletter: { footerTitle: "Novedades", footerText: "Avisos del oficio", successMessage: "Listo" }, abandonedCart: { emailSubject: "Tu carrito", enabled: false, featureEnabled: false, delayHours: 24, maxReminders: 2 } };
(async () => {
 try {
  const w = (name, body) => { const file = path.join(stage, name); fs.writeFileSync(file, body); return file; };
  const loader = w("jsx.cjs", `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  const cssLoader = w("css.cjs", "module.exports=function(){return 'module.exports={}';};");
  const navigation = w("navigation.js", `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>{const s=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(s);};export const navigate=(url,replace)=>{history[replace?'replaceState':'pushState']({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:(u)=>navigate(u),replace:(u)=>navigate(u,true),prefetch(){}});`);
  const link = w("link.jsx", `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,prefetch,scroll,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
  const image = w("image.jsx", `import React from 'react';export default function Image({src,alt,width,height,...p}){return <img src={src} alt={alt||''} width={width} height={height} {...p}/>}`);
  const auth = w("auth.js", `export const useAuth=()=>({user:{name:'Operadora ficticia',role:sessionStorage.getItem('role')||'admin'},loadingAuth:false,logout:async()=>{}});`);
  const site = w("site.js", `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  const alerts = w("alerts.js", `export const getAlerts=async()=>({alerts:{},totalCount:0});`);
  const services = w("services.js", `async function call(url,method='GET',data){const r=await fetch('/mock'+url,{method,headers:{'Content-Type':'application/json'},...(data!==undefined?{body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}
export const getCoupons=()=>call('/coupons');
export const createCoupon=(data)=>call('/coupons','POST',data);
export const updateCoupon=(id,data)=>call('/coupons/'+id,'PATCH',data);
export const toggleCoupon=(id)=>call('/coupons/'+id+'/toggle','PATCH',{});
export const deleteCoupon=(id)=>call('/coupons/'+id,'DELETE',{});
export const getAdminHomeContent=()=>call('/content/home');
export const updateAdminHomeContent=(d)=>call('/content/home','PATCH',d);
export const getAdminPages=()=>call('/content/pages');
export const getAdminPage=(id)=>call('/content/pages/'+id);
export const createAdminPage=(d)=>call('/content/pages','POST',d);
export const updateAdminPage=(id,d)=>call('/content/pages/'+id,'PATCH',d);
export const deleteAdminPage=(id)=>call('/content/pages/'+id,'DELETE',{});
export const getAdminBanners=()=>call('/content/banners');
export const createAdminBanner=(d)=>call('/content/banners','POST',d);
export const updateAdminBanner=(id,d)=>call('/content/banners/'+id,'PATCH',d);
export const deleteAdminBanner=(id)=>call('/content/banners/'+id,'DELETE',{});
export const uploadCmsImage=async()=>({url:''});
export const getMarketingSettings=async()=>call('/marketing');
export const updateMarketingSettings=(data)=>call('/marketing','PATCH',data);
export const getNewsletterSubscribers=async()=>call('/subscribers');
export const getAbandonedCarts=async()=>call('/carts');
export const sendAbandonedReminders=async()=>call('/reminders','POST',{});
export const exportNewsletterCsv=async()=>call('/export/newsletter','POST',{});
export const exportOrdersCsv=async()=>new Blob();
export const exportAbandonedCartsCsv=async()=>call('/export/carts','POST',{});
export const getStoreSettings=async()=>call('/settings');
export const updateStoreSettings=(d)=>call('/settings','PATCH',d);
export const getAdminHomeImages=async()=>({images:[]});
export const createAdminHomeImage=async()=>({});
export const updateAdminHomeImage=async()=>({});
export const reorderAdminHomeImages=async()=>({});
export const deleteAdminHomeImage=async()=>({});
export const getCatalogFilters=async()=>({filters:{weaveTypes:[]}});
export const getAdminReviews=async()=>({reviews:[],total:0,page:1,pages:1,limit:10});
export const approveAdminReview=async()=>({});
export const rejectAdminReview=async()=>({});
export const createBrandReview=async()=>({});`);
  const entry = w("entry.jsx", `import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from './navigation';
import Cupones from ${JSON.stringify(path.join(srcRoot, "app/admin/cupones/page.js"))};
import Contenido from ${JSON.stringify(path.join(srcRoot, "app/admin/contenido/page.js"))};
import Marketing from ${JSON.stringify(path.join(srcRoot, "app/admin/marketing/page.js"))};
function App(){const p=usePathname();if(p==='/admin/cupones')return <Cupones/>;if(p==='/admin/marketing')return <Marketing/>;return <Contenido/>;}
createRoot(document.getElementById('app')).render(<React.Suspense fallback={<p>Cargando…</p>}><App/></React.Suspense>);`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, performance: { hints: false },
    resolve: { extensions: [".js", ".jsx", ".mjs", ".json"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "next/image": image, "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@/services/adminAlertService": alerts, "@/services/adminCouponService": services, "@/services/adminCmsService": services, "@/services/adminMarketingService": services, "@/services/adminSettingsService": services, "@/services/adminHomeImageService": services, "@/services/productService": services, "@/services/reviewService": services, "@": srcRoot } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve(); }));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  const layout = fs.readFileSync(path.join(srcRoot, "app/admin/layout.js"), "utf8");
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", ...[...layout.matchAll(/@\/(styles\/[^"]+\.css)/g)].map((m) => m[1])];
  const css = sheets.map((file) => fs.readFileSync(path.join(srcRoot, file), "utf8")).join("\n");
  let coupons = [];
  let subscribers = [{ _id: "s1", email: "una.suscriptora@example.test", name: "Ana", source: "footer", createdAt: "2026-11-20T12:00:00.000Z" }];
  let carts = [{ _id: "c1", email: "un.carrito@example.test", itemCount: 1, subtotal: 180000, remindersSent: 0, updatedAt: "2026-11-22T15:00:00.000Z" }];
  const scenario = { failMarketing: 0 };
  const home = { hero: { brandClaim: "DIZOR", title: "Oficio", subtitle: "", ctaLabel: "", ctaHref: "", secondaryCtaLabel: "", secondaryCtaHref: "" }, features: [], announcement: { items: [] } };
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    if (url.pathname.startsWith("/mock")) {
      res.setHeader("Content-Type", "application/json");
      const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)); };
      const parts = url.pathname.split("/").slice(2);
      let raw = ""; for await (const c of req) raw += c; const data = raw ? JSON.parse(raw) : {};
      if (req.method !== "GET") result.mutations.push({ method: req.method, path: url.pathname.slice(5) });
      if (parts[0] === "coupons") {
        if (req.method === "POST") { coupons.push({ _id: "cp" + coupons.length, ...data, isActive: true, usedCount: 0 }); return send({ coupon: coupons.at(-1) }); }
        if (parts[2] === "toggle") { coupons = coupons.map((c) => c._id === parts[1] ? { ...c, isActive: !c.isActive } : c); return send({ coupon: coupons.find((c) => c._id === parts[1]) }); }
        if (req.method === "DELETE") { coupons = coupons.filter((c) => c._id !== parts[1]); return send({ status: "success" }); }
        return send({ coupons });
      }
      if (parts[0] === "marketing") { if (scenario.failMarketing && req.method === "GET") { scenario.failMarketing--; return send({ message: "Fallo de marketing" }, 503); } return send({ status: "success", settings: marketing }); }
      if (parts[0] === "subscribers") return send({ status: "success", subscribers });
      if (parts[0] === "carts") return send({ status: "success", carts });
      if (parts[0] === "reminders") return send({ message: "no enviado" }, 403);
      if (parts[0] === "export") return send({ status: "success" });
      if (parts[0] === "settings") return send({ status: "success", settings: { id: "s", appearance: { siteName: "Dizor", logoUrl: "", primaryColor: "", accentColor: "", bgColor: "", faviconUrl: "" } } });
      if (parts[0] === "content") { if (parts[1] === "home") return send({ home }); if (parts[1] === "pages") return send({ pages: [] }); if (parts[1] === "banners") return send({ banners: [] }); }
      return send({ message: "No encontrado" }, 404);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><script>sessionStorage.setItem('role','admin')</script><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => result.pageErrors.push(e.stack || e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) result.consoleErrors.push(m.text()); });
  await page.setRequestInterception(true);
  page.on("request", (r) => { if (r.url().startsWith(origin) || r.url().startsWith("data:")) r.continue(); else { result.externalRequests.push(r.url()); r.abort(); } });
  const text = async (s) => { try { await page.waitForFunction((s) => document.body.innerText.includes(s), { timeout: 15000 }, s); } catch (error) { result.failure = { waiting: s, body: await page.evaluate(() => document.body.innerText.slice(0, 1200)) }; await page.screenshot({ path: path.join(out, "fallo.png"), fullPage: true }); throw error; } };
  const goto = async (url, ready) => { await page.goto(origin + url, { waitUntil: "networkidle0" }); if (ready) await text(ready); };
  const shot = async (name) => { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true }); result.screenshots.push(name + ".png"); };
  const check = (label) => { result.checks.push(label); process.stdout.write("ok - " + label + "\n"); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const shop = fs.readFileSync(path.join(srcRoot, "app/(shop)/layout.js"), "utf8");
  assert.equal(/admin-marketing/.test(shop), false);

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/cupones", "No hay cupones creados.");
  assert.ok(await page.$("#code"));
  const listFirst = await page.evaluate(() => { const list = document.querySelector(".taxonomy-list-card").getBoundingClientRect(); const form = document.querySelector(".mk-composer").getBoundingClientRect(); return list.top < form.top && form.width < 800; });
  assert.equal(listFirst, true);
  await shot("cupones-vacio-1440");
  await page.type("#code", "IRACA6"); await page.type("#value", "10"); await page.click("button.admin-btn--primary[type=submit]");
  await text("Cupón creado correctamente"); await text("IRACA6");
  assert.equal(result.mutations.filter((m) => m.path === "/coupons" && m.method === "POST").length, 1);
  await shot("cupones-datos-1440");
  check("M01 cupones: vacío compacto, listado primero y un alta");

  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/cupones", "IRACA6"); assert.equal(await overflow(), true); await shot("cupones-390");

  await page.setViewport({ width: 1440, height: 900 });
  scenario.failMarketing = 1;
  await goto("/admin/marketing?tab=popup", "guardar está bloqueado");
  assert.equal(await page.$("#popupTitle"), null);
  await shot("popup-error-1440");
  scenario.failMarketing = 0;
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Reintentar configuración de marketing")).click());
  await page.waitForFunction(() => document.querySelector("#popupTitle")?.value === "Aviso de taller", { timeout: 15000 });
  const openHistoric = await page.$eval(".mk-historic", (e) => e.open);
  assert.equal(openHistoric, false);
  const cols = await page.$eval(".mk-grid", (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
  assert.ok(cols >= 2);
  await shot("popup-1440");
  check("M02 popup: el fallo bloquea el formulario y los campos cortos comparten fila");

  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/marketing?tab=popup", "Popup promocional"); assert.equal(await overflow(), true); await shot("popup-390");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/marketing?tab=newsletter", "suscriptores activos (últimos 50)");
  assert.equal(await page.$$eval("nav[aria-label='Secciones de Marketing'] a", (n) => n.length), 4);
  const sheet = await page.$eval(".mk-sheet", (e) => e.getBoundingClientRect().width);
  assert.ok(sheet < 900, "la hoja de un suscriptor no ocupa todo el ancho");
  await shot("newsletter-uno-1440");
  subscribers.push({ _id: "s2", email: "otra@example.test", name: "", source: "popup", createdAt: "2026-11-21T12:00:00.000Z" }, { _id: "s3", email: "tercera@example.test", name: "Luz", source: "footer", createdAt: "2026-11-22T12:00:00.000Z" });
  await page.reload({ waitUntil: "networkidle0" }); await text("3 suscriptores activos");
  await shot("newsletter-varios-1440");
  check("M03 newsletter: cantidad de la página, no un total inventado, y ancho contenido");

  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/marketing?tab=newsletter", "una.suscriptora@example.test"); assert.equal(await overflow(), true); await shot("newsletter-390");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/marketing?tab=carritos", "Recordatorios desactivados");
  const sendDisabled = await page.$eval("button", (buttons) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Enviar recordatorios")).disabled);
  assert.equal(sendDisabled, true);
  assert.equal(result.mutations.some((m) => m.path === "/reminders"), false);
  await shot("carritos-uno-1440");
  carts.push({ _id: "c2", email: "otro.carrito@example.test", itemCount: 3, subtotal: 420000, remindersSent: 0, updatedAt: "2026-11-23T15:00:00.000Z" });
  await page.reload({ waitUntil: "networkidle0" }); await text("otro.carrito@example.test");
  await shot("carritos-varios-1440");
  check("M04 carritos compactos y recordatorios sin envío");

  for (const width of [1024, 820, 360]) { await page.setViewport({ width, height: 900 }); await goto("/admin/marketing?tab=popup", "Guardar configuración"); assert.equal(await overflow(), true, String(width)); }
  await page.setViewport({ width: 360, height: 900 }); await shot("popup-360");
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.externalRequests, []);
  result.passed = true;
 } catch (error) {
  result.passed = false; result.error = error.stack || error.message; console.error(result.error); if (result.failure) console.error(JSON.stringify(result.failure));
 } finally {
  if (browser) await browser.close(); if (server) await new Promise((r) => server.close(r));
  fs.writeFileSync(path.join(out, "navegador.json"), JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
 }
})();
