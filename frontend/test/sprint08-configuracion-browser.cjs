"use strict";
// Sprint 08 · Configuración de tienda, Usuarios y personal, Historial de auditoría.
// Real page components bundled with Next's webpack/SWC, fictitious service doubles
// (helpers/sprint08Mocks.cjs), loopback only. DIZOR_SPRINT08_MODE=antes only captures.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const mocks = require("./helpers/sprint08Mocks.cjs");
const MODE = process.env.DIZOR_SPRINT08_MODE === "antes" ? "antes" : "despues";
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend"), srcRoot = path.join(frontend, "src");
const out = path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-08", MODE);
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
fs.mkdirSync(out, { recursive: true });
fs.rmSync(path.join(out, "fallo.png"), { force: true }); // only a failing run leaves this capture
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint08-"));
const result = { mode: MODE, checks: [], externalRequests: [], pageErrors: [], screenshots: [], measurements: [] };
let browser, server;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
 try {
  const w = (name, body) => { const file = path.join(stage, name); fs.writeFileSync(file, body); return file; };
  const loader = w("jsx.cjs", `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  const cssLoader = w("css.cjs", "module.exports=function(){return 'module.exports={}';};");
  const navigation = w("navigation.js", `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>{const s=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(s);};export const navigate=(url,replace)=>{history[replace?'replaceState':'pushState']({},'',url);dispatchEvent(new PopStateEvent('popstate'))};const router={push:(u)=>navigate(u),replace:(u)=>navigate(u,true),prefetch(){},back:()=>history.back()};export const useRouter=()=>router;`);
  const link = w("link.jsx", `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
  const auth = w("auth.js", `const names={superadmin:'Super ficticia',admin:'Admin ficticia',vendedor:'Vendedor ficticio'};export const useAuth=()=>{const role=sessionStorage.getItem('role')||'superadmin';return {user:{name:names[role],role},loadingAuth:false,logout:async()=>{}};};`);
  const site = w("site.js", `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  const alerts = w("alerts.js", `export const getAlerts=async()=>({alerts:{},totalCount:0});`);
  const settingsMock = w("settings.js", mocks.settings), usersMock = w("users.js", mocks.users), auditMock = w("audit.js", mocks.audit);
  const page = (p) => JSON.stringify(path.join(srcRoot, "app/admin", p, "page.js"));
  const entry = w("entry.jsx", `import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from './navigation';
import Config from ${page("configuracion")};import Users from ${page("usuarios")};import Audit from ${page("auditoria")};
function App(){const p=usePathname();if(p==='/admin/configuracion')return <Config/>;if(p==='/admin/usuarios')return <Users/>;if(p==='/admin/auditoria')return <Audit/>;return <p id="fuera">Ruta fuera del panel: {p}</p>;}
createRoot(document.getElementById('app')).render(<App/>);`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, performance: { hints: false },
    resolve: { extensions: [".js", ".jsx", ".mjs", ".json"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@/services/adminAlertService": alerts, "@/services/adminSettingsService": settingsMock, "@/services/adminUserService": usersMock, "@/services/auditAdminService": auditMock, "@": srcRoot } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve(); }));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  const layout = fs.readFileSync(path.join(srcRoot, "app/admin/layout.js"), "utf8");
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", ...[...layout.matchAll(/@\/(styles\/[^"]+\.css)/g)].map((m) => m[1])];
  const css = sheets.map((file) => fs.readFileSync(path.join(srcRoot, file), "utf8")).join("\n");
  server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR admin</title><style>${css}</style></head><body><script>window.__dzScenario=JSON.parse(sessionStorage.getItem('dz-scenario')||'{}');sessionStorage.setItem('role',window.__dzScenario.role||'superadmin');window.__dzCalls=[];</script><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const p = await browser.newPage();
  p.on("pageerror", (e) => result.pageErrors.push(e.stack || e.message));
  p.on("dialog", (d) => { result.pageErrors.push("native dialog: " + d.message()); d.dismiss(); });
  await p.setRequestInterception(true);
  p.on("request", (r) => { if (r.url().startsWith(origin) || r.url().startsWith("data:")) r.continue(); else { result.externalRequests.push(r.url()); r.abort(); } });

  // ── helpers ──
  const bodyHas = (s) => p.evaluate((s) => document.body.innerText.includes(s), s);
  const text = async (s, timeout = 10000) => { try { await p.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, s); } catch (error) { result.failure = { waiting: s, body: await p.evaluate(() => document.body.innerText.slice(0, 2500)) }; await p.screenshot({ path: path.join(out, "fallo.png"), fullPage: true }); throw error; } };
  const gone = (s) => p.waitForFunction((s) => !document.body.innerText.includes(s), { timeout: 10000 }, s);
  const scenario = async (s, url, waitUntil = "networkidle0") => { await p.goto(origin + "/", { waitUntil: "domcontentloaded" }); await p.evaluate((s) => sessionStorage.setItem("dz-scenario", JSON.stringify(s)), s); await p.goto(origin + url, { waitUntil }); };
  const calls = (api) => p.evaluate((api) => window.__dzCalls.filter((c) => !api || c.api === api), api);
  const shot = async (name, full = true) => { await p.evaluate(() => scrollTo(0, 0)); await sleep(80); await p.screenshot({ path: path.join(out, name + ".png"), fullPage: full }); result.screenshots.push(name + ".png"); };
  const height = () => p.evaluate(() => document.documentElement.scrollHeight);
  const noOverflow = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const viewport = (width, h = 900) => p.setViewport({ width, height: h });
  const visible = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);
  const clickText = async (label, sel = "button,a,summary") => {
    const handle = await p.waitForFunction((label, sel) => [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && e.textContent.trim() === label), { timeout: 10000 }, label, sel);
    await handle.click(); await handle.dispose();
  };
  const fill = async (sel, value) => { await p.waitForSelector(sel); await p.$eval(sel, (e, v) => { e.focus(); const setter = Object.getOwnPropertyDescriptor(e.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value").set; setter.call(e, v); e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, value); };
  const check = (id, label) => { result.checks.push(`${id} ${label}`); process.stdout.write(`ok - ${id} ${label}\n`); };
  const measure = async (name, width) => { const m = { name, width, height: await height(), overflow: !(await noOverflow()) }; result.measurements.push(m); return m; };
  const widths = [1440, 1024, 820, 390, 360];

  if (MODE === "antes") {
    await viewport(1440); await scenario({}, "/admin/configuracion"); await text("Envío incluido"); await shot("configuracion-1440"); await measure("configuracion", 1440);
    await viewport(390); await shot("configuracion-390"); await measure("configuracion", 390);
    await viewport(1440); await scenario({ settingsGetFail: 9 }, "/admin/configuracion"); await text("No se pudo cargar"); await shot("configuracion-error-1440");
    await scenario({}, "/admin/usuarios"); await text("Ana Martínez"); await shot("usuarios-1440"); await measure("usuarios", 1440);
    await viewport(390); await shot("usuarios-390"); await measure("usuarios", 390);
    await viewport(1440); await scenario({ users: "empty" }, "/admin/usuarios"); await text("Equipo activo"); await shot("usuarios-vacios-1440");
    await scenario({ usersGetFail: 9 }, "/admin/usuarios"); await text("No se pudo cargar el equipo"); await shot("usuarios-error-1440");
    await scenario({}, "/admin/auditoria"); await text("Página 1 de"); await shot("auditoria-1440"); await measure("auditoria", 1440);
    await clickText("Ver"); await text("Datos nuevos"); await shot("auditoria-detalle-1440");
    await viewport(390); await scenario({}, "/admin/auditoria"); await text("Página 1 de"); await shot("auditoria-390"); await measure("auditoria", 390);
    await viewport(360); await measure("auditoria", 360);
    await viewport(1440); await scenario({ auditGetFail: 9 }, "/admin/auditoria"); await sleep(400); await shot("auditoria-error-1440");
    result.auditErrorShowsEmpty = await bodyHas("No hay eventos con estos filtros");
    result.passed = true;
    return;
  }

  // ════════════════════ Configuración de tienda ════════════════════
  await viewport(1440);
  await scenario({ settingsDelay: 400 }, "/admin/configuracion");
  await text("Envío incluido en el precio.");
  assert.equal(await p.$("#shippingMode"), null); assert.equal(await p.$("#shippingFixedCost"), null);
  await text("Inter Rapidísimo"); await text("Servientrega");
  const cfg = await p.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const tax = r("#taxRate"), main = r(".cf-settings__main"), side = r(".cf-settings__side"), carriers = r("#cf-carriers"); return { taxWidth: tax.width, mainLeft: main.left, sideLeft: side.left, sideTop: side.top, mainTop: main.top, carriersHeight: carriers.height, envia: document.body.innerText.includes("Envía") || document.body.innerText.toLowerCase().includes("envia") }; });
  result.measurements.push({ name: "configuracion-geometria-1440", ...cfg });
  assert.ok(cfg.taxWidth <= 200, "tasa acotada " + cfg.taxWidth); assert.ok(cfg.sideLeft > cfg.mainLeft + 300, "dos columnas"); assert.ok(Math.abs(cfg.sideTop - cfg.mainTop) < 5);
  assert.ok(cfg.carriersHeight < 200, "transportadoras compactas " + cfg.carriersHeight); assert.equal(cfg.envia, false, "transportadora histórica no ofrecida");
  check("C01", "configuración cargada en dos columnas, tasa de ancho acotado, transportadoras confirmadas");
  await shot("configuracion-1440"); await measure("configuracion", 1440);
  // historical shipping policy: read-only disclosure, P16 summary text kept
  await clickText("Consultar configuración histórica de envío", "summary"); await text("Costo guardado");
  assert.equal(await p.$$eval("details input, details select", (n) => n.length), 0);
  await text("Vigente"); check("C04", "envío incluido como condición vigente e histórico de solo lectura");
  check("C05", "Inter Rapidísimo y Servientrega en una tarjeta compacta, sin edición");
  // tax toggle and payload
  assert.equal(await p.$eval("#taxEnabled", (e) => e.checked), true);
  await p.click("#taxEnabled"); await text("no se aplican"); await text("Cambios sin guardar");
  await p.$eval("form.cf-tax", (f) => { f.requestSubmit(); f.requestSubmit(); });
  await text("Configuración guardada");
  let patches = await calls("PATCH /admin/settings");
  assert.equal(patches.length, 1, "doble envío → una petición"); assert.deepEqual(Object.keys(patches[0].data).sort(), ["taxEnabled", "taxRate"]);
  assert.deepEqual(patches[0].data, { taxEnabled: false, taxRate: 19 });
  assert.ok(await p.$eval(".cf-tax [role=status]", (e) => e.textContent.includes("Configuración guardada")));
  await text("Desactivados"); assert.equal(await bodyHas("Cambios sin guardar"), false);
  check("C03", "impuestos editables, estado desactivado explicado y guardado {taxEnabled,taxRate}");
  check("C06", "los campos de envío inactivos no viajan en el guardado");
  check("C08", "doble envío produce un único PATCH");
  // validation: empty and out-of-range rate are blocked before the network
  await p.click("#taxEnabled"); await fill("#taxRate", "150"); await p.$eval("form.cf-tax", (f) => f.requestSubmit()); await sleep(200);
  assert.equal((await calls("PATCH /admin/settings")).length, 1); assert.equal(await p.$eval("#taxRate", (e) => e.validity.rangeOverflow), true);
  await fill("#taxRate", ""); await p.$eval("form.cf-tax", (f) => f.requestSubmit()); await sleep(200);
  assert.equal((await calls("PATCH /admin/settings")).length, 1); assert.equal(await p.$eval("#taxRate", (e) => e.validity.valueMissing), true);
  // server rejection keeps the draft and announces the error
  await fill("#taxRate", "12"); await p.evaluate(() => { window.__dzScenario.patchMode = "reject"; });
  await p.$eval("form.cf-tax", (f) => f.requestSubmit()); await text("La tasa de impuesto debe estar entre 0 y 100");
  assert.equal(await p.$eval("#taxRate", (e) => e.value), "12"); assert.ok(await p.$(".cf-tax [role=alert]"));
  await shot("configuracion-error-guardado-1440");
  // unknown result: applied on the server but the answer was lost
  await p.evaluate(() => { window.__dzScenario.patchMode = "lost"; });
  await p.$eval("form.cf-tax", (f) => f.requestSubmit()); await text("No se pudo confirmar"); await clickText("Comprobar configuración");
  await text("El servidor confirma los cambios"); assert.equal(await p.$eval("#taxRate", (e) => e.value), "12");
  check("C07", "guardado confirmado, validación previa, rechazo con borrador conservado y resultado desconocido verificable");
  for (const width of widths) { await viewport(width); assert.equal(await noOverflow(), true, "configuración " + width); await measure("configuracion", width); }
  // Comparable with "antes": fresh load, history closed, no feedback message.
  await viewport(390); await scenario({}, "/admin/configuracion"); await text("Envío incluido en el precio.");
  await shot("configuracion-390"); await measure("configuracion-390-inicial", 390);
  await viewport(1440);
  await scenario({ settingsGetFail: 1 }, "/admin/configuracion");
  await text("No se pudo cargar la configuración"); assert.equal(await p.$("#taxRate"), null); await shot("configuracion-error-1440");
  await clickText("Reintentar"); await text("Envío incluido en el precio."); assert.ok(await p.$("#taxRate"));
  check("C02", "error de carga sin formulario ficticio y recuperación con Reintentar");

  // ════════════════════ Usuarios y personal ════════════════════
  await scenario({ usersDelay: 1500 }, "/admin/usuarios", "domcontentloaded");
  await text("Cargando equipo"); assert.equal(await bodyHas("Aún no hay"), false);
  check("U16", "estado de carga anunciado sin afirmar un equipo vacío");
  await text("Ana Martínez"); await text("Usuarios del equipo"); await text("Administra los accesos y roles del personal autorizado.");
  assert.equal(await p.$$eval(".cf-team tbody tr", (n) => n.length), 4);
  await text("Administrador"); await text("Vendedor"); await text("Inactivo");
  const sensitive = await p.evaluate(() => /password|contraseña:|\$2[aby]\$|hash/i.test(document.querySelector(".cf-team").innerText));
  assert.equal(sensitive, false);
  check("U10", "equipo en tabla compacta: nombre, correo, rol, estado y acciones, sin credenciales");
  // contextual form: closed by default, opened on demand
  const trigger = await p.$("#cf-new-user");
  assert.equal(await trigger.evaluate((e) => e.getAttribute("aria-expanded")), "false");
  assert.equal(await visible("#name"), false); assert.equal(await bodyHas("Crear usuario"), false);
  const listFirst = await p.evaluate(() => document.querySelector(".cf-team").getBoundingClientRect().top < 400);
  assert.equal(listFirst, true, "el equipo aparece primero");
  await shot("usuarios-1440"); await measure("usuarios", 1440);
  await trigger.click(); await text("Crear usuario");
  assert.equal(await trigger.evaluate((e) => e.getAttribute("aria-expanded")), "true");
  assert.equal(await p.evaluate(() => document.activeElement.id), "name");
  const cols = await p.evaluate(() => { const a = document.querySelector("#name").getBoundingClientRect(), b = document.querySelector("#email").getBoundingClientRect(); return { sameRow: Math.abs(a.top - b.top) < 4, w: a.width }; });
  assert.equal(cols.sameRow, true, "dos columnas en escritorio");
  assert.deepEqual(await p.$$eval("#role option", (n) => n.map((o) => o.value)), ["vendedor", "admin"]);
  assert.equal(await p.$eval("#password", (e) => e.autocomplete), "new-password");
  check("U13", "roles creables limitados a vendedor y administrador");
  await shot("usuario-nuevo-1440");
  await p.keyboard.press("Escape"); await gone("Crear usuario");
  assert.equal(await p.evaluate(() => document.activeElement.id), "cf-new-user");
  check("U15", "formulario contextual bajo demanda; Escape lo cierra y devuelve el foco");
  // validation: native e-mail check and server password rule
  await trigger.click(); await fill("#name", "Persona de prueba"); await fill("#email", "correo-invalido"); await fill("#password", "debil");
  await p.$eval("form.cf-user-form", (f) => f.requestSubmit()); await sleep(200);
  assert.equal((await calls("POST /admin/users")).length, 0); assert.equal(await p.$eval("#email", (e) => e.validity.typeMismatch), true);
  await fill("#email", "persona.prueba@dizor.example"); await fill("#password", "debilsinnumero");
  await p.$eval("form.cf-user-form", (f) => f.requestSubmit()); await text("Contraseña débil");
  assert.equal(await p.$eval("#email", (e) => e.value), "persona.prueba@dizor.example");
  await shot("usuario-nuevo-error-1440");
  check("U12", "validación nativa y regla de contraseña del servidor, con borrador conservado");
  // creation: double submit → one POST, confirmation, panel closes, list refreshed, password not kept
  await fill("#password", "PruebaSegura2026!");
  await p.$eval("form.cf-user-form", (f) => { f.requestSubmit(); f.requestSubmit(); });
  await text("Usuario creado correctamente"); await text("Persona de prueba");
  const posts = await calls("POST /admin/users");
  assert.equal(posts.length, 2); assert.deepEqual(posts[1].keys, ["email", "name", "password", "phone", "role"]);
  assert.equal(await p.$eval("#password", (e) => e.value), ""); assert.equal(await visible("#name"), false);
  assert.ok(await p.$("[role=status]"));
  check("U11", "creación confirmada con una sola petición, lista actualizada y contraseña descartada");
  check("U08", "doble clic en Crear usuario no duplica la creación");
  // deactivate with confirmation
  await p.evaluate(() => [...document.querySelectorAll(".cf-team button")].find((b) => b.textContent.trim() === "Desactivar" && b.getAttribute("aria-label").includes("Ana Martínez")).click());
  await p.waitForSelector(".admin-confirm"); await text("no podrá iniciar sesión");
  await shot("usuario-desactivar-confirmacion-1440", false);
  await clickText("Desactivar acceso"); await text("Usuario desactivado");
  const statusCalls = await calls("PATCH /admin/users/:id/status");
  assert.equal(statusCalls.length, 1); assert.deepEqual([statusCalls[0].id, statusCalls[0].isActive], ["u1", false]);
  check("U18", "desactivar exige confirmación y usa el endpoint existente una vez");
  for (const width of widths) { await viewport(width); assert.equal(await noOverflow(), true, "usuarios " + width); await measure("usuarios", width); }
  await viewport(390); await scenario({}, "/admin/usuarios"); await text("Ana Martínez");
  await shot("usuarios-390"); await measure("usuarios-390-inicial", 390);
  await p.click("#cf-new-user"); await text("Crear usuario");
  const single = await p.evaluate(() => { const a = document.querySelector("#name").getBoundingClientRect(), b = document.querySelector("#email").getBoundingClientRect(); return b.top > a.top + 10; });
  assert.equal(single, true, "una columna en móvil"); await shot("usuario-nuevo-390");
  await viewport(1440);
  // empty and error are different states
  await scenario({ users: "empty" }, "/admin/usuarios"); await text("Aún no hay administradores ni vendedores");
  assert.equal(await p.$(".cf-team table"), null); await shot("usuarios-vacios-1440");
  await clickText("Crear primer usuario"); await text("Crear usuario");
  check("U09", "equipo vacío confirmado con estado propio y acceso a crear el primero");
  await scenario({ usersGetFail: 1 }, "/admin/usuarios"); await text("No se pudo cargar el equipo");
  assert.equal(await bodyHas("Aún no hay"), false); assert.equal(await bodyHas("0 personas"), false); await shot("usuarios-error-1440");
  await clickText("Reintentar equipo"); await text("Ana Martínez");
  check("U17", "error de consulta distinto de vacío, con recuperación");
  // unknown creation result is verified against the refreshed list
  await scenario({ createMode: "lost" }, "/admin/usuarios"); await text("Ana Martínez");
  await p.click("#cf-new-user"); await fill("#name", "Persona incierta"); await fill("#email", "incierta@dizor.example"); await fill("#password", "PruebaSegura2026!");
  await p.$eval("form.cf-user-form", (f) => f.requestSubmit()); await text("aparece en el equipo");
  check("U19", "resultado desconocido de creación comprobado contra el equipo real");
  // authorization in the interface (the API 403 is covered by backend/test/sprint08)
  await scenario({ role: "admin" }, "/admin/usuarios"); await p.waitForFunction(() => location.pathname === "/cuenta");
  assert.equal(await bodyHas("Usuarios del equipo"), false);
  await scenario({ role: "admin" }, "/admin/configuracion"); await text("Envío incluido en el precio.");
  assert.deepEqual(await p.$$eval('nav[aria-label="Secciones de Configuración"] a', (n) => n.map((a) => a.textContent)), ["Configuración de tienda", "Auditoría"]);
  await scenario({ role: "vendedor" }, "/admin/auditoria"); await p.waitForFunction(() => location.pathname === "/cuenta");
  assert.equal(await bodyHas("Historial de auditoría"), false);
  check("U14", "administrador sin acceso a Usuarios y vendedor sin acceso a Auditoría en la interfaz");

  // ════════════════════ Historial de auditoría ════════════════════
  await scenario({}, "/admin/auditoria"); await text("Página 1 de 10");
  const stats = await p.evaluate(() => window.__dzStats);
  const kpi = await p.$$eval(".cf-kpi", (n) => n.map((e) => e.innerText.replace(/\s+/g, " ")));
  assert.ok(kpi[0].includes("138")); assert.ok(kpi[1].includes(String(stats.today))); assert.ok(kpi[2].includes(String(stats.failed)));
  check("A23", `eventos de hoy (${stats.today}) desde la fuente de estadísticas`); check("A24", `eventos fallidos (${stats.failed}) desde la fuente de estadísticas`);
  assert.equal(await p.$$eval(".cf-audit tbody tr.cf-audit__row", (n) => n.length), 15);
  const firstCall = (await calls("GET /admin/audit"))[0];
  assert.equal(Number(firstCall.params.limit), 15); assert.equal(Number(firstCall.params.page), 1);
  check("A19", "138 eventos: 15 por página desde el servidor, 10 páginas");
  const heads = await p.$$eval(".cf-audit thead th", (n) => n.map((e) => e.textContent.trim()));
  assert.deepEqual(heads, ["Fecha y hora", "Usuario", "Módulo", "Acción", "Resultado", "Detalle"]);
  const ipInRows = await p.evaluate(() => [...document.querySelectorAll(".cf-audit__row")].some((r) => r.innerText.includes("10.0.0.")));
  assert.equal(ipInRows, false);
  assert.equal(await bodyHas("tok_ficticio_no_mostrar"), false);
  const wrap = await p.evaluate(() => { const t = document.querySelector(".cf-audit table"); return t.getBoundingClientRect().width <= t.parentElement.getBoundingClientRect().width + 1; });
  assert.equal(wrap, true, "correos largos sin romper columnas");
  assert.equal(await visible("#cf-audit-filters-toggle"), false, "en escritorio los filtros están siempre visibles, sin conmutador");
  assert.equal(await visible("#cf-audit-module"), true);
  await shot("auditoria-1440"); await measure("auditoria", 1440);
  // detail on demand, contextual names
  const names = await p.$$eval(".cf-audit__toggle", (n) => n.map((b) => b.getAttribute("aria-label")));
  assert.equal(new Set(names).size, names.length, "nombres accesibles únicos"); assert.ok(names[0].startsWith("Ver detalle de"));
  const toggleAt = async (i) => (await p.$$(".cf-audit__toggle"))[i];
  await (await toggleAt(0)).click();
  const detailId = await p.$eval(".cf-audit__toggle", (b) => b.getAttribute("aria-controls"));
  await p.waitForSelector("#" + detailId);
  await text("Descripción"); await text("10.0.0.0");
  assert.equal(await p.$eval(".cf-audit__toggle", (b) => b.getAttribute("aria-expanded")), "true");
  await shot("auditoria-detalle-1440");
  // second event carries a token field: redacted in the detail
  await (await toggleAt(1)).click(); await text("[oculto]");
  assert.equal(await bodyHas("tok_ficticio_no_mostrar"), false);
  check("A25", "detalle expandible con fecha completa, usuario, rol, descripción, referencias e IP");
  check("A27", "IP y datos solo en el detalle; claves sensibles ocultas");
  // read-only
  const writable = await p.evaluate(() => { const m = document.querySelector(".cf-audit-page"); return { inputs: m.querySelectorAll(".cf-audit input:not([type=search]), .cf-audit textarea, [contenteditable=true]").length, verbs: [...m.querySelectorAll("button")].filter((b) => /editar|eliminar|borrar|modificar/i.test(b.textContent)).length }; });
  assert.deepEqual(writable, { inputs: 0, verbs: 0 });
  assert.ok((await calls()).every((c) => c.api.startsWith("GET")));
  await text("Solo lectura");
  check("A26", "historial de solo lectura: sin edición ni eliminación, solo consultas GET");
  // keyboard: toggle with Enter
  await (await toggleAt(2)).focus(); await p.keyboard.press("Enter");
  assert.equal(await (await toggleAt(2)).evaluate((b) => b.getAttribute("aria-expanded")), "true");
  const ring = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(ring, "none");
  check("A29", "Ver detalle accesible con teclado y foco visible");
  // page change, URL, reload and history
  await clickText("Siguiente"); await text("Página 2 de 10");
  assert.equal(new URL(p.url()).searchParams.get("page"), "2");
  assert.equal(Number((await calls("GET /admin/audit")).at(-1).params.page), 2);
  await p.reload({ waitUntil: "networkidle0" }); await text("Página 2 de 10");
  await p.goBack({ waitUntil: "networkidle0" }).catch(() => {});
  check("A22", "cambio de página por servidor, conservado en URL y tras recargar");
  // combined filters
  await scenario({}, "/admin/auditoria"); await text("Página 1 de 10");
  await p.select("#cf-audit-module", "auth"); await text("Autenticación");
  await p.select("#cf-audit-result", "false");
  await p.waitForFunction(() => new URL(location.href).searchParams.get("result") === "false");
  await p.waitForFunction(() => !document.querySelector(".cf-audit[aria-busy=true]"));
  const last = (await calls("GET /admin/audit")).at(-1).params;
  assert.equal(last.module, "auth"); assert.equal(last.success, "false"); assert.equal(Number(last.page), 1);
  const rowsOk = await p.$$eval(".cf-audit__row", (n) => n.every((r) => r.innerText.includes("Autenticación") && r.innerText.includes("Fallido")));
  assert.equal(rowsOk, true);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await fill("#cf-audit-from", "2030-01-02"); await fill("#cf-audit-to", "2030-01-01");
  await p.$eval("form.cf-audit-filters", (f) => f.requestSubmit()); await text("La fecha inicial no puede ser posterior");
  await fill("#cf-audit-from", today); await fill("#cf-audit-to", today); await fill("#cf-audit-q", "ana.martinez");
  await p.$eval("form.cf-audit-filters", (f) => f.requestSubmit());
  await p.waitForFunction(() => new URL(location.href).searchParams.get("q") === "ana.martinez");
  await p.waitForFunction(() => !document.querySelector(".cf-audit[aria-busy=true]"));
  const combo = (await calls("GET /admin/audit")).at(-1).params;
  assert.deepEqual([combo.term, combo.from, combo.to, combo.module, combo.success], ["ana.martinez", today, today, "auth", "false"]);
  await p.reload({ waitUntil: "networkidle0" });
  assert.equal(await p.$eval("#cf-audit-module", (e) => e.value), "auth"); assert.equal(await p.$eval("#cf-audit-q", (e) => e.value), "ana.martinez");
  await text("Sin coincidencias"); await text("Limpiar filtros");
  check("A20", "filtros combinados (búsqueda, módulo, resultado, desde, hasta) enviados al servidor y conservados en URL");
  await shot("auditoria-sin-coincidencias-1440");
  await clickText("Limpiar filtros"); await text("Página 1 de 10"); assert.equal(new URL(p.url()).search, "");
  check("A21", "paginación y filtros restablecidos sin descargar el historial completo");
  // responsive
  for (const width of widths) { await viewport(width); assert.equal(await noOverflow(), true, "auditoría " + width); await measure("auditoria", width); }
  await viewport(390); await scenario({}, "/admin/auditoria"); await text("Página 1 de 10");
  assert.equal(await visible("#cf-audit-module"), false, "filtros avanzados contraídos en móvil");
  const cards = await p.$$eval(".cf-audit__row", (n) => n.map((r) => r.getBoundingClientRect().height));
  result.measurements.push({ name: "auditoria-ficha-390", max: Math.max(...cards), min: Math.min(...cards) });
  assert.ok(Math.max(...cards) <= 140, "fichas compactas " + Math.max(...cards));
  await shot("auditoria-390"); await measure("auditoria-390-inicial", 390);
  await clickText("Ver detalle", "button"); await text("Descripción"); await shot("auditoria-detalle-390");
  const toggle = await p.$("#cf-audit-filters-toggle");
  assert.equal(await toggle.evaluate((e) => e.getAttribute("aria-expanded")), "false");
  await toggle.click(); assert.equal(await visible("#cf-audit-module"), true); await shot("auditoria-filtros-390", false);
  await viewport(360); assert.equal(await noOverflow(), true);
  check("A28", "responsive 1440–360 sin desbordes, fichas compactas y filtros bajo demanda en móvil");
  // few events, empty, error
  await viewport(1440);
  await scenario({ auditCount: 4 }, "/admin/auditoria"); await text("4 eventos");
  assert.equal(await p.$(".cf-pagination"), null); assert.equal(await p.$$eval(".cf-audit__row", (n) => n.length), 4);
  await shot("auditoria-pocos-1440");
  check("A18", "pocos eventos: sin paginación ni contenedores sobredimensionados");
  await scenario({ auditCount: 0 }, "/admin/auditoria"); await text("Aún no hay eventos registrados");
  await scenario({ auditGetFail: 1, statsFail: 1 }, "/admin/auditoria"); await text("No se pudo consultar el historial");
  assert.equal(await bodyHas("No hay eventos"), false); assert.equal(await bodyHas("Aún no hay eventos"), false);
  assert.equal(await bodyHas("Indicadores no disponibles"), true);
  await shot("auditoria-error-1440");
  await clickText("Reintentar historial"); await text("Página 1 de 10");
  check("A17", "error de consulta distinto de vacío, con indicadores no inventados y recuperación");
  // section navigation
  const tabs = await p.$$eval('nav[aria-label="Secciones de Configuración"] a', (n) => n.map((a) => [a.textContent, a.getAttribute("aria-current")]));
  assert.deepEqual(tabs, [["Configuración de tienda", null], ["Usuarios y personal", null], ["Auditoría", "page"]]);
  await viewport(360); const nav = await p.$eval('nav[aria-label="Secciones de Configuración"]', (e) => { const r = e.getBoundingClientRect(); const links = [...e.querySelectorAll("a")].map((a) => a.getBoundingClientRect()); return { h: r.height, oneRow: links.every((l) => Math.abs(l.top - links[0].top) < 2), minH: Math.min(...links.map((l) => l.height)) }; });
  assert.equal(nav.oneRow, true); assert.ok(nav.h < 80, "selector compacto " + nav.h); assert.ok(nav.minH >= 44);
  result.measurements.push({ name: "navegacion-secundaria-360", ...nav });
  check("N01", "navegación secundaria: estado activo, permisos y una sola fila de 44 px en 360");

  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.externalRequests, []);
  result.passed = true;
 } catch (error) {
  result.passed = false; result.error = error.stack || error.message; console.error(result.error); if (result.failure) console.error(JSON.stringify(result.failure).slice(0, 3000));
 } finally {
  if (browser) await browser.close(); if (server) await new Promise((r) => server.close(r));
  fs.writeFileSync(path.join(out, "navegador.json"), JSON.stringify(result, null, 2));
  try { fs.rmSync(stage, { recursive: true, force: true }); } catch {}
  if (!result.passed) process.exitCode = 1;
 }
})();
