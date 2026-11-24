"use strict";
// Recorridos independientes de Fase 5. No altera la aplicación ni el arnés de Codex.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const front = path.join(root, "frontend");
const out = __dirname;
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const tempRoot = fs.realpathSync(os.tmpdir());
const stage = fs.mkdtempSync(path.join(tempRoot, "dizor-cierre5-next-"));
const result = { checks: [], findings: [], pageErrors: [], hydrationErrors: [], externalRequests: [] };
let page, browser, nextServer, fixture, ready = false, serverLog = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    const marked = await fixture.api("PATCH", "/api/admin/marketing/settings", {
      cookie: ctx.adminCookie,
      body: { popup: { title: "Titulo real de auditoria", text: "No debe desaparecer", enabled: true } },
    });
    if (marked.status !== 200) throw new Error("No se pudo preparar marketing: " + marked.status);
    result.preparedTitle = marked.json?.settings?.popup?.title ?? null;
    fs.cpSync(front, stage, { recursive: true, filter: (file) => !["node_modules", ".next", ".git", "test"].includes(path.basename(file)) && !path.basename(file).startsWith(".env") });
    fs.symlinkSync(path.join(front, "node_modules"), path.join(stage, "node_modules"), "junction");
    const env = {};
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"]) if (process.env[name]) env[name] = process.env[name];
    Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_URL: ctx.base + "/api", NEXT_PUBLIC_SITE_URL: origin });
    const nextBin = path.join(front, "node_modules/next/dist/bin/next");
    const built = await command([nextBin, "build", "--webpack"], env);
    fs.writeFileSync(path.join(out, "build-independiente.txt"), built.log);
    if (built.code !== 0) throw new Error(built.log.slice(-4000));
    nextServer = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: stage, env, windowsHide: true });
    nextServer.stdout.on("data", (d) => { serverLog += d; });
    nextServer.stderr.on("data", (d) => { serverLog += d; });
    for (let attempt = 0; attempt < 80; attempt++) {
      try { const r = await fetch(origin + "/admin"); if (r.status === 200) break; } catch { /* espera */ }
      await sleep(250);
      if (attempt === 79) throw new Error(serverLog);
    }
    browser = await puppeteer.launch({ executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-background-networking", "--disable-sync", "--no-first-run"] });
    page = await browser.newPage();
    page.on("pageerror", (e) => result.pageErrors.push(e.message));
    page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text())) result.hydrationErrors.push(m.text()); });
    const cookie = async (role) => {
      const cookies = await page.cookies();
      if (cookies.length) await page.deleteCookie(...cookies);
      const raw = role === "superadmin" ? ctx.superCookie : role === "vendedor" ? ctx.vendorCookie : ctx.adminCookie;
      await page.setCookie(...raw.split("; ").filter((pair) => pair.includes("=")).map((pair) => {
        const index = pair.indexOf("=");
        return { name: pair.slice(0, index), value: pair.slice(index + 1), url: origin, httpOnly: true, sameSite: "Lax" };
      }));
    };
    const labels = () => page.$$eval(".admin-sidebar .admin-nav-row > a, [role=dialog] .admin-nav-row > a", (nodes) => nodes.map((e) => e.textContent.trim()));
    await page.setViewport({ width: 1440, height: 900 });
    await page.setRequestInterception(true);
    let failMarketing = false;
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["127.0.0.1", "localhost"].includes(u.hostname) && !["data:", "blob:"].includes(u.protocol)) {
        result.externalRequests.push(u.origin + u.pathname);
        r.abort();
        return;
      }
      if (failMarketing && u.pathname.endsWith("/admin/marketing/settings") && r.method() === "GET") r.abort();
      else r.continue();
    });

    await cookie("superadmin");
    await page.goto(origin + "/admin", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Resumen de pedidos"));
    const superLabels = await labels();
    result.checks.push({ id: "B-I01", ok: superLabels.includes("Finanzas") && superLabels.includes("Configuración"), labels: superLabels });
    await cookie("vendedor");
    await page.goto(origin + "/admin/solicitudes?q=directa&page=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Solicitudes"));
    const vendorLabels = await labels();
    result.checks.push({ id: "B-I02", ok: vendorLabels.join("|") === "Inicio|Pedidos|Solicitudes", labels: vendorLabels });
    await page.goto(origin + "/admin/finanzas", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.pathname === "/cuenta" || location.pathname === "/login", { timeout: 15000 });
    const financeText = await page.evaluate(() => document.body.innerText.includes("Valor inventario"));
    result.checks.push({ id: "B-I03", ok: new URL(page.url()).pathname === "/cuenta" && !financeText, url: page.url() });

    await cookie("admin");
    await page.goto(origin + "/admin/contenido?tab=resenas&term=auditoria&page=2", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Escribir reseña") || document.body.innerText.includes("Reseñas"));
    const reviewUrl = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.search.includes("tab=resenas") && location.search.includes("term=auditoria"));
    result.checks.push({ id: "B-I04", ok: page.url().includes("tab=resenas") && page.url().includes("term=auditoria"), url: page.url(), before: reviewUrl });
    await page.goto(origin + "/admin/marketing?tab=newsletter", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("suscriptores"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.search.includes("tab=newsletter"));
    const active = await page.$eval(".admin-sidebar a[aria-current=page]", (e) => e.textContent.trim());
    result.checks.push({ id: "B-I05", ok: active === "Newsletter", active, url: page.url() });
    await page.goto(origin + "/admin/contenido?tab=exports&scope=orders&tray=prepare", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((e) => e.textContent.includes("Exportar pedidos")));
    const exportButtons = await page.$$eval("button", (nodes) => nodes.map((e) => e.textContent.trim()).filter((t) => t.startsWith("Exportar")));
    result.checks.push({ id: "B-I06", ok: exportButtons.length === 1 && exportButtons[0].includes("pedidos"), exportButtons, url: page.url() });
    await page.goto(origin + "/admin/contenido?tab=no-existe&scope=finance", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Página de inicio") || document.body.innerText.includes("Tienda online"));
    const financeExport = await page.$$eval("button", (nodes) => nodes.some((e) => /finanzas|costo/i.test(e.textContent)));
    result.checks.push({ id: "B-I07", ok: !financeExport, url: page.url() });

    await page.setViewport({ width: 390, height: 844 });
    await page.goto(origin + "/admin", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Resumen de pedidos"));
    for (let i = 0; i < 4; i++) {
      await page.click("button[aria-label=Menú]");
      await page.waitForSelector("[role=dialog]");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("[role=dialog]"));
    }
    const inert = await page.$eval(".admin-main", (e) => e.inert);
    const focus = await page.$eval("button[aria-label=Menú]", (e) => e === document.activeElement);
    result.checks.push({ id: "B-I08", ok: inert === false && focus, inert, focus });
    await page.click("button[aria-label=Menú]");
    await page.waitForSelector("[role=dialog]");
    await page.setViewport({ width: 1440, height: 900 });
    await page.waitForFunction(() => !document.querySelector("[role=dialog]"), { timeout: 5000 });
    const inertDesktop = await page.$eval(".admin-main", (e) => e.inert);
    result.checks.push({ id: "B-I09", ok: inertDesktop === false, inertDesktop });

    await page.goto(origin + "/admin/contenido?tab=home", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Tienda online"));
    await page.goto(origin + "/admin/contenido?tab=resenas", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.search.includes("resenas"));
    await page.goto(origin + "/admin/marketing?tab=carritos", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Recordatorios desactivados"));
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.search.includes("resenas"));
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => location.search.includes("tab=home") || location.pathname === "/admin/contenido");
    result.checks.push({ id: "B-I10", ok: page.url().includes("contenido"), url: page.url() });

    failMarketing = true;
    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Popup") || document.body.innerText.includes("Error"), { timeout: 20000 });
    await sleep(800);
    const marketingState = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 1500),
      title: document.querySelector("input[name=popupTitle]")?.value ?? null,
      saveEnabled: [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Guardar") && !b.disabled),
      errorVisible: /error|no se pudo/i.test(document.body.innerText),
    }));
    result.findings.push({ id: "F5-M01", marketingState });
    if (marketingState.saveEnabled && marketingState.title === "") {
      await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Guardar"))?.click());
      await sleep(1200);
    }
    failMarketing = false;
    const after = await fixture.api("GET", "/api/admin/marketing/settings", { cookie: ctx.adminCookie });
    result.findings[0].storedTitle = after.json?.settings?.popup?.title ?? null;
    result.findings[0].storedEnabled = after.json?.settings?.popup?.enabled ?? null;
    await page.screenshot({ path: path.join(out, "marketing-error-carga.png"), fullPage: true });
    result.passed = result.checks.every((c) => c.ok) && result.pageErrors.length === 0 && result.hydrationErrors.length === 0 && result.externalRequests.length === 0;
  } finally {
    fs.writeFileSync(path.join(out, "navegador-independiente.json"), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(out, "navegador-independiente-servidor.txt"), serverLog);
    if (browser) await browser.close();
    if (nextServer) nextServer.kill();
    if (ready) await fixture.close();
    const junction = path.join(stage, "node_modules");
    if (fs.existsSync(junction)) fs.unlinkSync(junction);
    const target = fs.realpathSync(stage);
    if (path.dirname(target) === tempRoot && path.basename(target).startsWith("dizor-cierre5-next-")) fs.rmSync(target, { recursive: true, force: true });
  }
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
