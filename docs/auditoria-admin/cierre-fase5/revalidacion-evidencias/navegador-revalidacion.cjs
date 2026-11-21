"use strict";
// Recorrido independiente de la corrección F5-A01. No modifica la aplicación.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../../../..");
const front = path.join(root, "frontend");
const out = __dirname;
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const tempRoot = fs.realpathSync(os.tmpdir());
const stage = fs.mkdtempSync(path.join(tempRoot, "dizor-reval5-next-"));
const result = { checks: [], http: [], pageErrors: [], hydrationErrors: [], externalRequests: [] };
let page, browser, nextServer, fixture, ready = false, serverLog = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TITLE = "Promoción artesanal de temporada";
const TEXT = "Descubre nuestros productos elaborados en palma de iraca.";
function command(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: stage, env, windowsHide: true });
    const timer = setTimeout(() => child.kill(), 240000);
    let log = "";
    child.stdout.on("data", (d) => { log += d; });
    child.stderr.on("data", (d) => { log += d; });
    child.once("error", reject);
    child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal, log }); });
  });
}
(async () => {
  try {
    const port = await new Promise((resolve) => {
      const probe = http.createServer();
      probe.listen(0, "127.0.0.1", () => { const p = probe.address().port; probe.close(() => resolve(p)); });
    });
    fixture = require(path.join(root, "backend/test/helpers/phase2Fixture.cjs"));
    process.env.CLIENT_URL = `http://127.0.0.1:${port}`;
    process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
    process.env.MARKETING_CART_REMINDERS_ENABLED = "false";
    await fixture.setup();
    ready = true;
    const ctx = fixture.context;
    const origin = `http://127.0.0.1:${port}`;
    const Marketing = require(path.join(root, "backend/src/models/marketingSettings"));
    const readStored = async () => {
      const doc = await Marketing.findOne({ key: "default" }).lean();
      return { title: doc?.popup?.title ?? null, text: doc?.popup?.text ?? null, enabled: doc?.popup?.enabled ?? null };
    };
    const prepared = await fixture.api("PATCH", "/api/admin/marketing/settings", {
      cookie: ctx.adminCookie,
      body: { popup: { title: TITLE, text: TEXT, enabled: true, variant: "info", ctaLabel: "Ver colección", ctaHref: "/catalogo" } },
    });
    if (prepared.status !== 200) throw new Error("No se preparó marketing: " + prepared.status + " " + prepared.text);
    fs.cpSync(front, stage, { recursive: true, filter: (file) => !["node_modules", ".next", ".git", "test"].includes(path.basename(file)) && !path.basename(file).startsWith(".env") });
    fs.symlinkSync(path.join(front, "node_modules"), path.join(stage, "node_modules"), "junction");
    const env = {};
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"]) if (process.env[name]) env[name] = process.env[name];
    Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_URL: ctx.base + "/api", NEXT_PUBLIC_SITE_URL: origin });
    const nextBin = path.join(front, "node_modules/next/dist/bin/next");
    const built = await command([nextBin, "build", "--webpack"], env);
    fs.writeFileSync(path.join(out, "build-revalidacion.txt"), built.log);
    if (built.code !== 0) throw new Error(built.log.slice(-3000));
    nextServer = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: stage, env, windowsHide: true });
    nextServer.stdout.on("data", (d) => { serverLog += d; });
    nextServer.stderr.on("data", (d) => { serverLog += d; });
    for (let attempt = 0; attempt < 80; attempt++) {
      try { if ((await fetch(origin + "/admin")).status === 200) break; } catch { /* espera */ }
      await sleep(250);
      if (attempt === 79) throw new Error(serverLog);
    }
    browser = await puppeteer.launch({ executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-background-networking", "--disable-sync", "--no-first-run"] });
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on("pageerror", (e) => result.pageErrors.push(e.message));
    page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text())) result.hydrationErrors.push(m.text()); });
    let failure = null;
    const held = [];
    let patchCount = 0;
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const url = new URL(request.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) {
        result.externalRequests.push(url.origin + url.pathname);
        return request.abort();
      }
      const marketing = url.pathname.endsWith("/admin/marketing/settings");
      if (marketing && request.method() === "PATCH") patchCount += 1;
      if (marketing && request.method() === "GET" && failure) {
        const mode = failure;
        if (mode === "hold") { held.push(request); return; }
        const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json" };
        if (mode === "500") return request.respond({ status: 500, headers, body: JSON.stringify({ status: "error", message: "fallo controlado" }) });
        if (mode === "invalid") return request.respond({ status: 200, headers, body: "{no es json" });
        if (mode === "incomplete") return request.respond({ status: 200, headers, body: JSON.stringify({ status: "success", settings: { key: "default", popup: { title: "" } } }) });
        if (mode === "offline") return request.abort("failed");
        if (mode === "abort") return request.abort("aborted");
      }
      if (marketing && request.method() === "PATCH" && failure === "save-500") {
        return request.respond({ status: 500, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json" }, body: JSON.stringify({ status: "error" }) });
      }
      return request.continue();
    });
    const raw = ctx.adminCookie;
    await page.setCookie(...raw.split("; ").filter((pair) => pair.includes("=")).map((pair) => {
      const index = pair.indexOf("=");
      return { name: pair.slice(0, index), value: pair.slice(index + 1), url: origin, httpOnly: true, sameSite: "Lax" };
    }));
    const clickText = (label) => page.evaluate((label) => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === label && !item.disabled);
      if (!button) throw new Error("No está el botón " + label);
      button.click();
    }, label);
    const check = (id, ok, detail) => result.checks.push({ id, ok, ...detail });
    const titleValue = () => page.$eval("input[name=popupTitle]", (e) => e.value).catch(() => null);
    const saveEnabled = () => page.$$eval("button", (nodes) => nodes.some((b) => b.textContent.includes("Guardar configuración") && !b.disabled));
    const alertText = () => page.$eval("[role=alert]", (e) => e.textContent).catch(() => "");
    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction((title) => document.querySelector("input[name=popupTitle]")?.value === title, { timeout: 20000 }, TITLE);
    check("carga", (await titleValue()) === TITLE, { title: await titleValue(), stored: await readStored() });
    await page.screenshot({ path: path.join(out, "popup-cargado.png"), fullPage: false });

    const beforeFail = await readStored();
    for (const mode of ["500", "offline", "abort", "invalid", "incomplete"]) {
      failure = mode;
      patchCount = 0;
      await page.evaluate(() => {
        const button = [...document.querySelectorAll("button")].find((item) => /configuración de marketing/.test(item.textContent) && !item.disabled);
        if (!button) throw new Error("No está el control de recarga");
        button.click();
      });
      await page.waitForFunction(() => document.body.innerText.includes("Error al cargar"), { timeout: 20000 });
      const enabled = await saveEnabled();
      await page.evaluate(() => {
        const form = document.querySelector("form.admin-form");
        if (!form) return;
        try { form.requestSubmit(); } catch { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
      });
      await sleep(400);
      const stored = await readStored();
      check("fallo-" + mode, !enabled && patchCount === 0 && stored.title === beforeFail.title && stored.enabled === true, { enabled, patchCount, alert: await alertText(), stored });
    }
    failure = null;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction((title) => (document.querySelector("input[name=popupTitle]") || {}).value === title, { timeout: 20000 }, TITLE);
    check("recarga-tras-error", (await titleValue()) === TITLE && (await readStored()).title === TITLE, { title: await titleValue() });

    failure = "500";
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Error al cargar"), { timeout: 20000 });
    failure = null;
    await clickText("Reintentar configuración de marketing");
    await page.waitForFunction((title) => (document.querySelector("input[name=popupTitle]") || {}).value === title, { timeout: 20000 }, TITLE);
    check("reintento", (await titleValue()) === TITLE, { stored: await readStored() });

    failure = "hold";
    await clickText("Actualizar configuración de marketing");
    await sleep(200);
    await page.click("a[href='/admin/marketing?tab=newsletter']");
    await page.waitForFunction(() => location.search.includes("newsletter"));
    held.splice(0).forEach((request) => request.respond({ status: 200, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json" }, body: JSON.stringify({ status: "success", settings: { key: "default", popup: { title: "Respuesta vieja", enabled: false } } }) }).catch(() => {}));
    failure = null;
    await page.click("a[href='/admin/marketing?tab=popup']");
    await page.waitForFunction((title) => (document.querySelector("input[name=popupTitle]") || {}).value === title, { timeout: 20000 }, TITLE);
    check("pestaña-pendiente", (await readStored()).title === TITLE && (await titleValue()) === TITLE && (await saveEnabled()) === false, { title: await titleValue(), stored: await readStored(), saveEnabled: await saveEnabled() });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => /configuración de marketing/.test(item.textContent) && !item.disabled);
      button.click();
    });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((item) => item.textContent.trim() === "Guardar configuración" && !item.disabled), { timeout: 20000 });

    await page.$eval("input[name=popupTitle]", (element, value) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, "Edición válida de temporada");
    await page.waitForFunction(() => document.querySelector("input[name=popupTitle]")?.value === "Edición válida de temporada");
    patchCount = 0;
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Guardar configuración");
      button.click();
      button.click();
    });
    await page.waitForFunction(() => /guardados/i.test(document.body.innerText), { timeout: 20000 });
    await sleep(300);
    check("doble-clic", patchCount === 1 && (await readStored()).title === "Edición válida de temporada", { patchCount, stored: await readStored(), success: !(await alertText()).includes("no está confirmado") });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (document.querySelector("input[name=popupTitle]") || {}).value === "Edición válida de temporada");
    check("persistencia", (await readStored()).title === "Edición válida de temporada", { stored: await readStored() });

    failure = "save-500";
    patchCount = 0;
    const persisted = await readStored();
    await page.$eval("input[name=popupTitle]", (element, value) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, "No debe anunciarse como éxito");
    await clickText("Guardar configuración");
    await page.waitForFunction(() => /no está confirmado|No se pudieron guardar|Error/i.test(document.body.innerText), { timeout: 20000 });
    const body = await page.evaluate(() => document.body.innerText);
    failure = null;
    check("guardado-ambiguo", !/Cambios guardados correctamente/.test(body) && (await readStored()).title === persisted.title, { body: body.slice(0, 500), stored: await readStored(), patchCount });

    await page.goto(origin + "/admin/marketing?tab=newsletter", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("suscriptores"));
    await page.goto(origin + "/admin/contenido?tab=appearance", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("apariencia") || document.body.innerText.includes("Apariencia"));
    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction((title) => (document.querySelector("input[name=popupTitle]") || {}).value === title, { timeout: 20000 }, persisted.title);
    check("otras-secciones", (await readStored()).title === persisted.title, { title: await titleValue() });

    const current = await page.$$eval("a[aria-current]", (nodes) => nodes.map((e) => ({ text: e.textContent.trim(), value: e.getAttribute("aria-current") })));
    check("aria-current", current.some((item) => item.value === "page") && current.every((item) => ["page", "location"].includes(item.value)), { current });

    for (const item of [
      { url: "/admin/contenido?tab=exports", heading: "Exportaciones", active: "Exportaciones históricas", buttons: ["Exportar pedidos (CSV)", "Exportar newsletter (CSV)", "Exportar carritos (CSV)"] },
      { url: "/admin/contenido?tab=exports&scope=orders", heading: "Exportaciones de pedidos", active: "Exportar pedidos (CSV)", buttons: ["Exportar pedidos (CSV)"] },
      { url: "/admin/contenido?tab=exports&scope=newsletter", heading: "Exportaciones", active: "Newsletter", buttons: ["Exportar newsletter (CSV)"] },
      { url: "/admin/contenido?tab=exports&scope=carts", heading: "Exportaciones", active: "Carritos", buttons: ["Exportar carritos (CSV)"] },
    ]) {
      await page.goto(origin + item.url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((text) => document.body.innerText.toLowerCase().includes(text.toLowerCase()), { timeout: 20000 }, item.heading);
      const active = await page.$$eval("[aria-current=page]", (nodes) => nodes.map((e) => e.textContent.trim()));
      const buttons = await page.$$eval("button", (nodes) => nodes.map((e) => e.textContent.trim()).filter((text) => text.startsWith("Exportar ")));
      const title = await page.$eval("h2", (e) => e.textContent.trim());
      check("export-" + item.url, title === item.heading && active.includes(item.active) && buttons.join("|") === item.buttons.join("|"), { active, buttons, title, url: item.url });
    }

    await page.setViewport({ width: 390, height: 844 });
    failure = "500";
    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Error al cargar"));
    await page.screenshot({ path: path.join(out, "error-movil-390.png"), fullPage: false });
    check("movil", (await saveEnabled()) === false && (await readStored()).title === persisted.title, { stored: await readStored() });
    result.passed = result.checks.every((item) => item.ok) && result.pageErrors.length === 0 && result.hydrationErrors.length === 0 && result.externalRequests.length === 0;
  } finally {
    fs.writeFileSync(path.join(out, "navegador-revalidacion.json"), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(out, "navegador-revalidacion-servidor.txt"), serverLog);
    if (browser) await browser.close();
    if (nextServer) nextServer.kill();
    if (ready) await fixture.close();
    const junction = path.join(stage, "node_modules");
    if (fs.existsSync(junction)) fs.unlinkSync(junction);
    try {
      const target = fs.realpathSync(stage);
      if (path.dirname(target) === tempRoot && path.basename(target).startsWith("dizor-reval5-next-")) fs.rmSync(target, { recursive: true, force: true });
    } catch { /* temporal ya retirado */ }
  }
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks }, null, 2));
  if (!result.passed) process.exitCode = 1;
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
