"use strict";
// Revalidación independiente de F6-I01. No modifica la aplicación.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../../../..");
const front = path.join(root, "frontend");
const out = __dirname;
const shots = path.join(out, "capturas");
fs.mkdirSync(shots, { recursive: true });
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const tempRoot = fs.realpathSync(os.tmpdir());
const stage = fs.mkdtempSync(path.join(tempRoot, "dizor-reval6-next-"));
const widths = [360, 390, 700, 820, 899, 900, 1024, 1099, 1100, 1101, 1280, 1440];
const neighbors = [699, 701, 901, 1099, 1101];
const allWidths = [...new Set([...widths, ...neighbors])].sort((a, b) => a - b);
const types = [
  ["categories", "Categorías", "Nombre artesanal extenso de categoria para la auditoria visual"],
  ["colors", "Colores", "Color artesanal extenso de auditoria"],
  ["sizes", "Tallas", "Talla larga de auditoria"],
  ["weave-types", "Tejidos", "Tejido artesanal extenso para auditoria visual"],
  ["styles", "Estilos / hormas", "Estilo artesanal extenso para auditoria visual"],
];
const shotWidths = new Set([390, 900, 1024, 1100, 1440]);
const result = { startedAt: new Date().toISOString(), widths: allWidths, issues: [], measurements: [], keyboard: [], roles: {}, pageErrors: [], hydrationErrors: [], externalRequests: [], isolatedNext: true };
let page, browser, nextServer, fixture, ready = false, buildLog = "", serverLog = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function command(args, env, onData) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: stage, env, windowsHide: true });
    const timer = setTimeout(() => child.kill(), 240000);
    child.stdout.on("data", (d) => onData(d.toString()));
    child.stderr.on("data", (d) => onData(d.toString()));
    child.once("error", reject);
    child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
  });
}
function issue(id, detail) { result.issues.push({ id, detail }); console.error("ISSUE", id, detail); }
(async () => {
  try {
    const port = await new Promise((resolve) => { const probe = http.createServer(); probe.listen(0, "127.0.0.1", () => { const value = probe.address().port; probe.close(() => resolve(value)); }); });
    fixture = require(path.join(root, "backend/test/helpers/phase2Fixture.cjs"));
    process.env.CLIENT_URL = `http://127.0.0.1:${port}`;
    process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
    process.env.MARKETING_CART_REMINDERS_ENABLED = "false";
    await fixture.setup();
    ready = true;
    const ctx = fixture.context;
    const origin = `http://127.0.0.1:${port}`;
    fs.cpSync(front, stage, { recursive: true, filter: (file) => !["node_modules", ".next", ".git", "test"].includes(path.basename(file)) && !path.basename(file).startsWith(".env") });
    fs.symlinkSync(path.join(front, "node_modules"), path.join(stage, "node_modules"), "junction");
    const guard = path.join(stage, "offline.cjs");
    fs.writeFileSync(guard, `const net=require('node:net');const fetch=globalThis.fetch;globalThis.fetch=async(input,init)=>{if(process.env.DIZOR_ISOLATED_RUNTIME==='1'&&['localhost','127.0.0.1'].includes(new URL(typeof input==='string'?input:input.url).hostname))return fetch(input,init);throw Error('Isolated fetch blocked');};const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const value=args[0];if(value&&typeof value==='object'&&value.path)return connect.apply(this,args);if(typeof value==='string'&&value.includes('pipe'))return connect.apply(this,args);if(process.env.DIZOR_ISOLATED_RUNTIME==='1'){const normalized=Array.isArray(value)?value[0]:value;const host=typeof normalized==='object'?normalized.host:args[1];if(host===undefined||['localhost','127.0.0.1','::1'].includes(host))return connect.apply(this,args);}throw Error('Isolated TCP blocked');};`);
    const env = {};
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"]) if (process.env[name]) env[name] = process.env[name];
    Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_URL: ctx.base + "/api", NEXT_PUBLIC_SITE_URL: origin, NODE_OPTIONS: `--require=${JSON.stringify(guard)}` });
    const nextBin = path.join(front, "node_modules/next/dist/bin/next");
    const built = await command([nextBin, "build", "--webpack"], env, (text) => { buildLog += text; });
    fs.writeFileSync(path.join(out, "build.txt"), buildLog);
    fs.writeFileSync(path.join(out, "build.json"), JSON.stringify({ exitCode: built.code, isolatedCopy: true, envFilesCopied: false, inheritedCredentials: false, compiler: "Next.js --webpack" }, null, 2));
    if (built.code !== 0) throw new Error(buildLog.slice(-4000));
    nextServer = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: stage, env: { ...env, DIZOR_ISOLATED_RUNTIME: "1" }, windowsHide: true });
    nextServer.stdout.on("data", (d) => { serverLog += d; });
    nextServer.stderr.on("data", (d) => { serverLog += d; });
    for (let attempt = 0; attempt < 80; attempt++) { try { if ((await fetch(origin + "/admin")).status === 200) break; } catch {} await sleep(250); if (attempt === 79) throw new Error(serverLog); }
    for (const [type, , longName] of types) {
      const body = { name: longName, description: "Registro temporal de revalidacion", hexCode: "#b87305", label: "Etiqueta temporal", sortOrder: 0, isActive: true };
      const created = await fixture.api("POST", "/api/admin/catalog/" + type, { cookie: ctx.superCookie, body });
      if (created.status !== 201) issue("seed-" + type, created.status + " " + created.text);
    }
    browser = await puppeteer.launch({ executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-background-networking", "--disable-sync", "--no-first-run"] });
    page = await browser.newPage();
    page.on("pageerror", (e) => result.pageErrors.push(e.message));
    page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text())) result.hydrationErrors.push(m.text()); });
    let failCatalog = false;
    const writes = [];
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) { result.externalRequests.push(url.origin + url.pathname); request.abort(); return; }
      if (["POST", "PATCH", "DELETE"].includes(request.method())) writes.push({ method: request.method(), path: url.pathname });
      if (failCatalog && request.method() === "GET" && url.pathname.endsWith("/api/admin/catalog/categories")) { failCatalog = false; request.respond({ status: 500, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ message: "Fallo de auditoria" }) }); return; }
      request.continue();
    });
    const cookie = async (role) => {
      const cookies = await page.cookies();
      if (cookies.length) await page.deleteCookie(...cookies);
      const raw = role === "superadmin" ? ctx.superCookie : role === "vendedor" ? ctx.vendorCookie : ctx.adminCookie;
      await page.setCookie(...raw.split("; ").filter((pair) => pair.includes("=")).map((pair) => { const index = pair.indexOf("="); return { name: pair.slice(0, index), value: pair.slice(index + 1), url: origin, httpOnly: true, sameSite: "Lax" }; }));
    };
    const measure = () => page.evaluate(() => {
      const grid = document.querySelector(".taxonomy-grid");
      const form = document.querySelector(".taxonomy-form-card").getBoundingClientRect();
      const list = document.querySelector(".taxonomy-list-card").getBoundingClientRect();
      const wrap = document.querySelector(".taxonomy-list-card .admin-table-wrap");
      const table = wrap.querySelector("table");
      const columns = getComputedStyle(grid).gridTemplateColumns;
      const buttons = [...wrap.querySelectorAll("td.admin-table__actions button")].map((button) => {
        const rect = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        const text = range.getBoundingClientRect();
        const clippedBy = [];
        for (let parent = button.parentElement; parent; parent = parent.parentElement) {
          const overflow = getComputedStyle(parent).overflowX;
          if (["auto", "scroll", "hidden", "clip"].includes(overflow)) {
            const parentRect = parent.getBoundingClientRect();
            const left = parentRect.left + parent.clientLeft;
            const right = left + parent.clientWidth;
            if (rect.left < left - 0.5 || rect.right > right + 0.5 || text.left < left - 0.5 || text.right > right + 0.5) clippedBy.push((parent.className || parent.tagName) + ":" + overflow);
          }
        }
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const inView = cy >= 0 && cy < innerHeight && cx >= 0 && cx < innerWidth;
        const hit = inView ? document.elementFromPoint(cx, cy) : null;
        return { label: button.textContent.trim(), name: button.getAttribute("aria-label") || button.textContent.trim(), width: rect.width, height: rect.height, textWidth: text.width, textInside: text.left >= rect.left - 1 && text.right <= rect.right + 1, scrollFits: button.scrollWidth <= button.clientWidth + 1, clippedBy, inView, hittable: !inView || hit === button || button.contains(hit), color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor };
      });
      const headings = [...wrap.querySelectorAll("th")].filter((cell) => getComputedStyle(cell.closest("thead")).position !== "absolute").map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const bounds = wrap.getBoundingClientRect();
        return { text: cell.textContent.trim(), complete: text.left >= bounds.left - 0.5 && text.right <= bounds.right + 0.5 };
      });
      return { width: innerWidth, document: document.documentElement.scrollWidth, columns, tracks: columns.trim().split(/\s+/).length, tableMin: getComputedStyle(table).minWidth, wrap: { client: wrap.clientWidth, scroll: wrap.scrollWidth, left: wrap.scrollLeft, overflowX: getComputedStyle(wrap).overflowX }, stacked: list.top >= form.bottom - 12, sideBySide: list.left >= form.right - 16, overflow: { html: getComputedStyle(document.documentElement).overflowX, body: getComputedStyle(document.body).overflowX, shell: getComputedStyle(document.querySelector(".admin-shell")).overflowX }, buttons, headings, tab: location.search };
    });
    await cookie("superadmin");
    for (const [type, label] of types) {
      await page.setViewport({ width: 1440, height: 900 });
      const response = await page.goto(origin + "/admin/catalogo?tab=" + type, { waitUntil: "domcontentloaded" });
      if (![200, 304].includes(response.status())) issue("ruta-" + type, String(response.status()));
      await page.waitForFunction((name) => document.body.innerText.includes(name), { timeout: 20000 }, types.find((item) => item[0] === type)[2]);
      const stable = page.url();
      for (const width of allWidths) {
        await page.setViewport({ width, height: 900 });
        await sleep(100);
        await page.evaluate(() => { document.querySelectorAll(".admin-table-wrap").forEach((node) => { node.scrollLeft = 0; }); document.querySelector(".taxonomy-list-card tbody tr")?.scrollIntoView({ block: "center" }); });
        await sleep(50);
        const data = await measure();
        data.type = type;
        data.urlStable = page.url() === stable;
        result.measurements.push(data);
        const expectedTracks = width <= 1100 ? 1 : 2;
        if (!data.urlStable) issue("url-" + type + "-" + width, page.url());
        if (data.document > data.width + 1) issue("documento-" + type + "-" + width, data.document + ">" + data.width);
        if (data.tracks !== expectedTracks) issue("columnas-" + type + "-" + width, data.columns);
        if (width <= 1100 && !data.stacked) issue("apilado-" + type + "-" + width, "formulario y listado no quedan en columna");
        if (width >= 1101 && !data.sideBySide) issue("lateral-" + type + "-" + width, "formulario y listado no quedan en dos columnas");
        if (data.wrap.scroll > data.wrap.client + 1) issue("scroll-" + type + "-" + width, data.wrap.scroll + "/" + data.wrap.client);
        if (data.tableMin !== "0px") issue("minimo-" + type + "-" + width, data.tableMin);
        if (!data.buttons.length) issue("botones-" + type + "-" + width, "sin acciones");
        for (const button of data.buttons) {
          if (!button.textInside || !button.scrollFits || button.clippedBy.length || button.width < 44 || button.height < 40) issue("recorte-" + type + "-" + width + "-" + button.label, JSON.stringify(button));
          if (button.inView && !button.hittable) issue("puntero-" + type + "-" + width + "-" + button.label, "el centro no recibe el botón");
          if (!["Editar", "Eliminar"].includes(button.label)) issue("texto-" + type + "-" + width, button.label);
        }
        if (data.headings.some((heading) => !heading.complete)) issue("encabezado-" + type + "-" + width, JSON.stringify(data.headings));
        if (["hidden", "clip"].includes(data.overflow.html) || ["hidden", "clip"].includes(data.overflow.shell)) issue("oculto-" + type + "-" + width, JSON.stringify(data.overflow));
        if (shotWidths.has(width)) {
          await page.screenshot({ path: path.join(shots, `${type}-${width}.png`) });
          if (type === "categories" && [900, 1024, 1100, 1440, 390].includes(width)) await page.screenshot({ path: path.join(shots, `pagina-${type}-${width}.png`), fullPage: true });
        }
      }
      console.log("medido", label);
    }
    await page.setViewport({ width: 1024, height: 900 });
    await page.goto(origin + "/admin", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Productos"));
    await page.evaluate(() => { const direct = [...document.querySelectorAll("a")].find((link) => link.getAttribute("href") === "/admin/catalogo" && link.getClientRects().length); if (direct) { direct.click(); return; } [...document.querySelectorAll("button,a")].find((node) => node.textContent.trim() === "Productos" && node.getClientRects().length)?.click(); });
    await page.waitForSelector("a[href='/admin/catalogo']");
    await page.evaluate(() => [...document.querySelectorAll("a")].find((link) => link.getAttribute("href") === "/admin/catalogo").click());
    await page.waitForFunction(() => location.pathname === "/admin/catalogo");
    await page.waitForFunction(() => document.body.innerText.includes("Nombre artesanal extenso"));
    const setValue = async (selector, value) => page.evaluate((target, next) => { const field = document.querySelector(target); const proto = Object.getPrototypeOf(field); Object.getOwnPropertyDescriptor(proto, "value").set.call(field, next); field.dispatchEvent(new Event("input", { bubbles: true })); }, selector, value);
    const patchesBefore = () => writes.filter((item) => item.method === "PATCH").length;
    await setValue("#tax-name", "Operacion auditoria");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Crear").click());
    await page.waitForFunction(() => [...document.querySelectorAll("tbody tr")].some((row) => row.textContent.includes("Operacion auditoria")));
    const rowButton = (name, danger) => page.evaluateHandle((wanted, isDanger) => [...document.querySelectorAll(".taxonomy-list-card tbody tr")].find((row) => row.textContent.includes(wanted)).querySelector(isDanger ? "button.admin-btn--danger" : "button:not(.admin-btn--danger)"), name, danger);
    let handle = await rowButton("Operacion auditoria", false);
    await handle.asElement().focus();
    await page.keyboard.press("Tab");
    const focusDanger = await page.evaluate(() => { const node = document.activeElement; const style = getComputedStyle(node); return { text: node.textContent.trim(), outline: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor }; });
    result.keyboard.push({ step: "tab-eliminar", ...focusDanger });
    if (focusDanger.text !== "Eliminar" || focusDanger.outline === "none" || focusDanger.width < 2) issue("foco-eliminar", JSON.stringify(focusDanger));
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    const focusEdit = await page.evaluate(() => ({ text: document.activeElement.textContent.trim(), outline: getComputedStyle(document.activeElement).outlineStyle }));
    result.keyboard.push({ step: "shift-tab-editar", ...focusEdit });
    if (focusEdit.text !== "Editar" || focusEdit.outline === "none") issue("foco-editar", JSON.stringify(focusEdit));
    const kept = patchesBefore();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.body.innerText.includes("Actualizar"));
    await setValue("#tax-name", "Operacion cancelada");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Cancelar").focus());
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.body.innerText.includes("Nuevo"));
    if (patchesBefore() !== kept) issue("cancelar-patch", "cancelar envió PATCH");
    if (!(await page.evaluate(() => [...document.querySelectorAll("tbody tr")].some((row) => row.textContent.includes("Operacion auditoria"))))) issue("cancelar-dato", "el registro cambió al cancelar");
    handle = await rowButton("Operacion auditoria", false);
    await handle.asElement().focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.body.innerText.includes("Actualizar"));
    await setValue("#tax-name", "Operacion guardada");
    await page.focus("button[type='submit']");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => [...document.querySelectorAll("tbody tr")].some((row) => row.textContent.includes("Operacion guardada")));
    handle = await rowButton("Operacion guardada", true);
    await handle.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await handle.asElement().focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".admin-confirm");
    const dialog = await page.evaluate(() => { const node = document.querySelector(".admin-confirm"); const rect = node.getBoundingClientRect(); const cancel = document.activeElement; return { label: node.getAttribute("aria-labelledby"), described: node.getAttribute("aria-describedby"), modal: node.getAttribute("aria-modal"), title: document.getElementById(node.getAttribute("aria-labelledby"))?.textContent, active: cancel.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, inertMain: document.querySelector(".admin-main")?.inert === true }; });
    result.keyboard.push({ step: "dialogo", ...dialog });
    if (dialog.active !== "Cancelar" || dialog.modal !== "true" || dialog.left < 0 || dialog.right > dialog.width || dialog.bottom > dialog.height) issue("dialogo", JSON.stringify(dialog));
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement.textContent.trim())) !== "Eliminar") issue("dialogo-tab", "Tab no llega a Eliminar");
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    if ((await page.evaluate(() => document.activeElement.textContent.trim())) !== "Cancelar") issue("dialogo-shift", "Shift+Tab no vuelve a Cancelar");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".admin-confirm"));
    const returned = await page.evaluate(() => ({ text: document.activeElement.textContent.trim(), overflow: document.body.style.overflow }));
    result.keyboard.push({ step: "retorno", ...returned });
    if (returned.text !== "Eliminar" || returned.overflow === "hidden") issue("retorno", JSON.stringify(returned));
    if (!(await page.evaluate(() => [...document.querySelectorAll("tbody tr")].some((row) => row.textContent.includes("Operacion guardada"))))) issue("escape-borro", "Escape eliminó el registro");
    handle = await rowButton("Operacion guardada", true);
    await handle.asElement().focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".admin-confirm");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => ![...document.querySelectorAll("tbody tr")].some((row) => row.textContent.includes("Operacion guardada")));
    const listing = await fixture.api("GET", "/api/admin/catalog/categories", { cookie: ctx.superCookie });
    if (listing.json.items.some((item) => item.name === "Operacion guardada")) issue("delete-api", "el registro sigue en la API");
    if (!listing.json.items.some((item) => item.name.startsWith("Nombre artesanal"))) issue("delete-ajeno", "se borró un registro que no era el de la operación");
    await page.evaluate(() => [...document.querySelectorAll(".taxonomy-tabs button")].find((button) => button.textContent.trim() === "Colores").focus());
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.search.includes("tab=colors"));
    const pressed = await page.evaluate(() => [...document.querySelectorAll(".taxonomy-tabs button")].map((button) => ({ label: button.textContent.trim(), pressed: button.getAttribute("aria-pressed") })));
    result.keyboard.push({ step: "pestanas", pressed });
    if (!pressed.find((tab) => tab.label === "Colores" && tab.pressed === "true")) issue("pestana-colores", JSON.stringify(pressed));
    await page.evaluate(() => [...document.querySelectorAll(".taxonomy-tabs button")].find((button) => button.textContent.trim() === "Categorías").focus());
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.search.includes("tab=categories"));
    await page.waitForFunction(() => document.body.innerText.includes("Nombre artesanal extenso"));
    for (const width of [1440, 1024, 390]) {
      await page.setViewport({ width, height: 900 });
      await sleep(80);
      await page.evaluate(() => { document.querySelector(".admin-table-wrap").scrollLeft = 0; document.querySelector(".taxonomy-list-card tbody tr")?.scrollIntoView({ block: "center" }); });
      const data = await measure();
      if (data.buttons.some((button) => button.clippedBy.length || !button.textInside)) issue("despues-de-operar-" + width, JSON.stringify(data.buttons));
    }
    failCatalog = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Fallo de auditoria") || document.body.innerText.includes("No se pudo cargar el catálogo"), { timeout: 15000 });
    result.loadError = await page.evaluate(() => document.querySelector(".admin-form-error")?.textContent || "");
    await page.screenshot({ path: path.join(shots, "error-carga-1024.png") });
    failCatalog = false;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Nombre artesanal extenso"));
    if ((await page.evaluate(() => document.querySelector(".admin-form-error")?.textContent || "")) !== "") issue("recuperacion", "el error permanece tras recargar");
    const mutation = await page.addStyleTag({ content: "@media(min-width:900px) and (max-width:1100px){.admin-shell .taxonomy-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)!important}.admin-shell .taxonomy-grid .admin-table{min-width:640px!important}}" });
    await page.setViewport({ width: 1024, height: 900 });
    await sleep(120);
    await page.evaluate(() => { const wrap = document.querySelector(".admin-table-wrap"); wrap.scrollLeft = 0; wrap.scrollIntoView({ block: "center" }); });
    const broken = await measure();
    result.reproducedDefect = { document: broken.document, width: broken.width, tracks: broken.tracks, tableMin: broken.tableMin, wrap: broken.wrap, clipped: broken.buttons.filter((button) => button.clippedBy.length || !button.textInside).map((button) => button.label) };
    await page.screenshot({ path: path.join(shots, "defecto-reproducido-1024.png") });
    if (broken.document !== 1024) issue("defecto-documento", JSON.stringify(result.reproducedDefect));
    if (!broken.buttons.some((button) => button.clippedBy.length || !button.textInside)) issue("defecto-no-reproducido", JSON.stringify(broken.buttons));
    await mutation.evaluate((node) => node.remove());
    await sleep(80);
    await page.evaluate(() => { document.querySelector(".admin-table-wrap").scrollLeft = 0; document.querySelector("tbody tr").scrollIntoView({ block: "center" }); });
    const restored = await measure();
    if (restored.tracks !== 1 || restored.buttons.some((button) => button.clippedBy.length || !button.textInside) || restored.wrap.scroll > restored.wrap.client + 1) issue("restauracion", JSON.stringify({ tracks: restored.tracks, wrap: restored.wrap, buttons: restored.buttons }));
    await page.screenshot({ path: path.join(shots, "restaurado-1024.png") });
    await page.setViewport({ width: 1024, height: 900 });
    await page.goto(origin + "/admin/usuarios", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".admin-grid-2");
    const users1024 = await page.evaluate(() => getComputedStyle(document.querySelector(".admin-grid-2")).gridTemplateColumns.split(/\s+/).length);
    await page.setViewport({ width: 1101, height: 900 });
    await sleep(80);
    const users1101 = await page.evaluate(() => getComputedStyle(document.querySelector(".admin-grid-2")).gridTemplateColumns.split(/\s+/).length);
    result.sharedGrid = { users1024, users1101 };
    if (users1024 !== 1 || users1101 !== 2) issue("admin-grid-2", JSON.stringify(result.sharedGrid));
    const vendorPost = await fixture.api("POST", "/api/admin/catalog/categories", { cookie: ctx.vendorCookie, body: { name: "No debe crearse" } });
    const vendorPatch = await fixture.api("PATCH", "/api/admin/catalog/categories/000000000000000000000000", { cookie: ctx.vendorCookie, body: { name: "No" } });
    const vendorDelete = await fixture.api("DELETE", "/api/admin/catalog/categories/000000000000000000000000", { cookie: ctx.vendorCookie });
    const adminPost = await fixture.api("POST", "/api/admin/catalog/styles", { cookie: ctx.adminCookie, body: { name: "Estilo del administrador", description: "Temporal", sortOrder: 1, isActive: true } });
    result.roles.http = { vendorPost: vendorPost.status, vendorPatch: vendorPatch.status, vendorDelete: vendorDelete.status, adminPost: adminPost.status };
    if (vendorPost.status !== 403 || vendorPatch.status !== 403 || vendorDelete.status !== 403) issue("vendedor-http", JSON.stringify(result.roles.http));
    if (adminPost.status !== 201) issue("admin-http", JSON.stringify(result.roles.http));
    await cookie("vendedor");
    await page.setViewport({ width: 390, height: 900 });
    await page.goto(origin + "/admin/catalogo", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.pathname === "/cuenta", { timeout: 15000 });
    result.roles.vendorPage = page.url();
    await page.screenshot({ path: path.join(shots, "vendedor-catalogo-390.png") });
    if (!page.url().includes("/cuenta")) issue("vendedor-ui", page.url());
    await cookie("admin");
    await page.setViewport({ width: 1024, height: 900 });
    await page.goto(origin + "/admin/catalogo?tab=categories", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Editar"));
    await page.evaluate(() => document.querySelector("tbody tr")?.scrollIntoView({ block: "center" }));
    const adminView = await measure();
    result.roles.adminTracks = adminView.tracks;
    if (adminView.tracks !== 1 || adminView.buttons.some((button) => button.clippedBy.length)) issue("admin-vista", JSON.stringify(adminView.buttons));
    await page.screenshot({ path: path.join(shots, "admin-categories-1024.png") });
    const contrast = await page.evaluate(() => {
      const lum = (value) => { const [r, g, b] = value.match(/\d+/g).slice(0, 3).map(Number).map((channel) => { const scaled = channel / 255; return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const left = lum(a), right = lum(b); return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05); };
      return [...document.querySelectorAll(".taxonomy-list-card .admin-btn, .taxonomy-tabs button")].slice(0, 8).map((node) => { const style = getComputedStyle(node); return { text: node.textContent.trim(), color: style.color, background: style.backgroundColor, ratio: Math.round(ratio(style.color, style.backgroundColor) * 100) / 100, height: node.getBoundingClientRect().height }; });
    });
    result.contrast = contrast;
    if (contrast.some((item) => item.ratio < 4.5)) issue("contraste", JSON.stringify(contrast));
    if (result.pageErrors.length || result.hydrationErrors.length || result.externalRequests.length) issue("pagina", JSON.stringify({ pageErrors: result.pageErrors, hydrationErrors: result.hydrationErrors, externalRequests: result.externalRequests }));
    result.passed = result.issues.length === 0;
  } catch (error) {
    result.passed = false;
    result.crash = error.stack;
    console.error(error.stack);
    if (page) { try { await page.screenshot({ path: path.join(shots, "fallo.png"), fullPage: true }); } catch {} }
  } finally {
    fs.writeFileSync(path.join(out, "revalidacion.json"), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(out, "servidor.txt"), serverLog);
    if (browser) await browser.close();
    if (nextServer) { nextServer.kill(); await new Promise((resolve) => { if (nextServer.exitCode !== null) return resolve(); nextServer.once("exit", resolve); setTimeout(resolve, 5000); }); }
    if (ready) await fixture.close();
    const junction = path.join(stage, "node_modules");
    if (fs.existsSync(junction)) { if (!fs.lstatSync(junction).isSymbolicLink()) throw new Error("node_modules del temporal no es un enlace"); fs.unlinkSync(junction); }
    const target = fs.realpathSync(stage);
    if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith("dizor-reval6-next-")) throw new Error("temporal inesperado");
    fs.rmSync(target, { recursive: true, force: true });
    console.log(JSON.stringify({ passed: result.passed, issues: result.issues.length, measurements: result.measurements.length, reproduced: result.reproducedDefect || null }, null, 2));
    if (!result.passed) process.exitCode = 1;
  }
})();
