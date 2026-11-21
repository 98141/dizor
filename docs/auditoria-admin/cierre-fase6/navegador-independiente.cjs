"use strict";
// Recorrido independiente de Fase 6. No modifica la aplicación.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const front = path.join(root, "frontend");
const out = __dirname;
const shots = path.join(out, "capturas");
fs.mkdirSync(shots, { recursive: true });
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const tempRoot = fs.realpathSync(os.tmpdir());
const stage = fs.mkdtempSync(path.join(tempRoot, "dizor-fase6-next-"));
const result = { checks: [], pageErrors: [], hydrationErrors: [], externalRequests: [] };
let browser, nextServer, fixture, ready = false, serverLog = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TITLE = "Promoción artesanal de temporada";
const TEXT = "Descubre nuestros productos elaborados en palma de iraca.";
const LONG = "Solicitud de palma de iraca con un relato operativo muy extenso para comprobar el reflow móvil. ".repeat(4);
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
function cookies(raw, url) {
  return raw.split("; ").filter((pair) => pair.includes("=")).map((pair) => {
    const index = pair.indexOf("=");
    return { name: pair.slice(0, index), value: pair.slice(index + 1), url, httpOnly: true, sameSite: "Lax" };
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
    const Cart = require(path.join(root, "backend/src/models/abandonedCart"));
    const readStored = async () => {
      const doc = await Marketing.findOne({ key: "default" }).lean();
      return { title: doc?.popup?.title ?? null, enabled: doc?.popup?.enabled ?? null };
    };
    const prepared = await fixture.api("PATCH", "/api/admin/marketing/settings", {
      cookie: ctx.superCookie,
      body: { popup: { title: TITLE, text: TEXT, enabled: true, variant: "info", ctaLabel: "Ver colección", ctaHref: "/catalogo" } },
    });
    if (prepared.status !== 200) throw new Error("No se preparó marketing: " + prepared.status);
    const longEmail = `${"cliente.largo".repeat(8)}@example.test`;
    await Cart.create({ email: longEmail, name: "Cliente de auditoría", items: [{ productName: "Sombrero ".repeat(12), quantity: 1, unitPrice: 987654321, lineTotal: 987654321 }], subtotal: 987654321, itemCount: 1, remindersSent: 0 });
    const banner = await fixture.api("POST", "/api/admin/content/banners", { cookie: ctx.superCookie, body: { title: "Banner de auditoría", placement: "home_mid" } });
    if (banner.status !== 201) throw new Error("No se creó el banner: " + banner.status);
    const { product } = await fixture.makeProduct(6);
    const checkout = await fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, product.variants[0]._id, { paymentMethod: "contra_entrega" }) });
    if (checkout.status !== 201) throw new Error("No se creó el pedido: " + checkout.status);
    const orderId = checkout.json.order.id;
    fs.cpSync(front, stage, { recursive: true, filter: (file) => !["node_modules", ".next", ".git", "test"].includes(path.basename(file)) && !path.basename(file).startsWith(".env") });
    fs.symlinkSync(path.join(front, "node_modules"), path.join(stage, "node_modules"), "junction");
    const env = {};
    for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"]) if (process.env[name]) env[name] = process.env[name];
    Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_URL: ctx.base + "/api", NEXT_PUBLIC_SITE_URL: origin });
    const nextBin = path.join(front, "node_modules/next/dist/bin/next");
    const built = await command([nextBin, "build", "--webpack"], env);
    fs.writeFileSync(path.join(out, "build-independiente.txt"), built.log);
    if (built.code !== 0) throw new Error(built.log.slice(-2500));
    nextServer = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: stage, env, windowsHide: true });
    nextServer.stdout.on("data", (d) => { serverLog += d; });
    nextServer.stderr.on("data", (d) => { serverLog += d; });
    for (let attempt = 0; attempt < 80; attempt++) {
      try { if ((await fetch(origin + "/admin")).status === 200) break; } catch { /* espera */ }
      await sleep(250);
      if (attempt === 79) throw new Error(serverLog.slice(-1500));
    }
    browser = await puppeteer.launch({ executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--disable-background-networking", "--disable-sync", "--no-first-run"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on("pageerror", (e) => result.pageErrors.push(e.message));
    page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error #4\d\d/i.test(m.text())) result.hydrationErrors.push(m.text()); });
    let marketingMode = null, pqrMode = null, financeHuge = false, patchCount = 0;
    const held = [];
    const headersFor = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Content-Type": "application/json" };
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const url = new URL(request.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) {
        result.externalRequests.push(url.origin + url.pathname);
        return request.abort();
      }
      const marketing = url.pathname.endsWith("/admin/marketing/settings");
      if (marketing && request.method() === "PATCH") patchCount += 1;
      if (marketing && request.method() === "GET" && marketingMode) {
        if (marketingMode === "hold") { held.push(request); return; }
        if (marketingMode === "500") return request.respond({ status: 500, headers: headersFor, body: JSON.stringify({ status: "error" }) });
        if (marketingMode === "invalid") return request.respond({ status: 200, headers: headersFor, body: "{no es json" });
        if (marketingMode === "incomplete") return request.respond({ status: 200, headers: headersFor, body: JSON.stringify({ status: "success", settings: { key: "default", popup: { title: "" } } }) });
        if (marketingMode === "offline") return request.abort("failed");
      }
      if (url.pathname === "/api/admin/pqr" && request.method() === "GET" && pqrMode === "500") return request.respond({ status: 500, headers: headersFor, body: JSON.stringify({ message: "Fallo PQR de auditoría" }) });
      if (url.pathname === "/api/admin/pqr" && request.method() === "GET" && pqrMode === "long") {
        return request.respond({ status: 200, headers: headersFor, body: JSON.stringify({ total: 1, requests: [{ id: "i6", radicado: "PQR-I6-" + "LARGO".repeat(12), receivedAt: new Date().toISOString(), category: "consumo", type: LONG, status: "radicada" }] }) });
      }
      if (url.pathname.endsWith("/admin/finance/report") && financeHuge) {
        return request.respond({ status: 200, headers: headersFor, body: JSON.stringify({
          status: "success", period: { label: "Auditoría" }, notes: ["Cifra de prueba"],
          sales: { ordersCount: 1, totalCollected: 987654321098, productRevenue: 987654321098, unitsSold: 3, cogs: 123456789012, grossProfit: 864197532086, grossMarginPct: 87.5, averageOrderValue: 987654321098, shippingCollected: 0, taxCollected: 0, discountsGiven: 0, itemsMissingCost: 0, topByRevenue: [{ name: "Sombrero de iraca " + "grande ".repeat(8), revenue: 987654321098, profit: 864197532086 }], topByProfit: [] },
          pending: { ordersCount: 2, amount: 555555555555 },
          inventory: { investmentAtCost: 444444444444, potentialRetail: 888888888888, potentialProfit: 333333333333, potentialMarginPct: 40, unitsInStock: 12, productsMissingCost: 0, lowMarginProducts: [], catalogSummary: [] },
          paymentMethods: [{ method: "contra_entrega", count: 1, total: 987654321098 }],
          monthlyTrend: [{ month: "2026-11", productRevenue: 987654321098, grossProfit: 864197532086 }],
        }) });
      }
      return request.continue();
    });
    await page.setCookie(...cookies(ctx.superCookie, origin));
    const check = (id, ok, detail = {}) => result.checks.push({ id, ok: Boolean(ok), ...detail });
    const clickText = (label) => page.evaluate((label) => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === label && !item.disabled);
      if (!button) throw new Error("No está el botón " + label);
      button.click();
    }, label);
    const measure = () => page.evaluate(() => {
      const outside = [...document.querySelectorAll("button,a,input,select,textarea")].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
      }).slice(0, 8).map((el) => ({ text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60), right: Math.round(el.getBoundingClientRect().right) }));
      return { overflow: document.documentElement.scrollWidth - innerWidth, outside, width: innerWidth };
    });
    const shot = (name) => page.screenshot({ path: path.join(shots, name), fullPage: false });

    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction((title) => document.querySelector("input[name=popupTitle]")?.value === title, { timeout: 20000 }, TITLE);
    await shot("popup-1440.png");
    check("carga-popup", (await readStored()).title === TITLE, { stored: await readStored() });
    const beforeFail = await readStored();
    for (const mode of ["500", "offline", "invalid", "incomplete"]) {
      marketingMode = mode;
      patchCount = 0;
      await clickText(/configuración de marketing/.test("Actualizar configuración de marketing") ? "Actualizar configuración de marketing" : "Reintentar configuración de marketing").catch(async () => {
        await page.evaluate(() => [...document.querySelectorAll("button")].find((item) => /configuración de marketing/.test(item.textContent) && !item.disabled).click());
      });
      await page.waitForFunction(() => document.body.innerText.includes("Error al cargar"), { timeout: 20000 });
      await page.evaluate(() => { const form = document.querySelector("form.admin-form"); if (!form) return; try { form.requestSubmit(); } catch { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); } });
      await sleep(350);
      const stored = await readStored();
      const enabled = await page.$$eval("button", (nodes) => nodes.some((b) => b.textContent.includes("Guardar configuración") && !b.disabled));
      check("marketing-" + mode, !enabled && patchCount === 0 && stored.title === beforeFail.title && stored.enabled === true, { enabled, patchCount, stored });
    }
    marketingMode = null;
    await page.evaluate(() => [...document.querySelectorAll("button")].find((item) => /configuración de marketing/.test(item.textContent) && !item.disabled).click());
    await page.waitForFunction((title) => document.querySelector("input[name=popupTitle]")?.value === title, { timeout: 20000 }, TITLE);
    check("marketing-reintento", (await readStored()).title === TITLE, { stored: await readStored() });

    marketingMode = "hold";
    await page.evaluate(() => [...document.querySelectorAll("button")].find((item) => /configuración de marketing/.test(item.textContent) && !item.disabled).click());
    await sleep(250);
    const reloadLocked = await page.$$eval("button", (nodes) => nodes.some((item) => /configuración de marketing/.test(item.textContent) && item.disabled));
    await page.goto(origin + "/admin", { waitUntil: "domcontentloaded" });
    const stale = { status: "success", settings: { key: "default", popup: { title: "Respuesta vieja", text: TEXT, ctaLabel: "Ver colección", ctaHref: "/catalogo", imageUrl: "", variant: "info", couponCode: "", enabled: false, showNewsletterForm: false, delaySeconds: 4 }, newsletter: { footerTitle: "", footerText: "", successMessage: "" }, abandonedCart: { emailSubject: "", enabled: false, featureEnabled: false, delayHours: 4, maxReminders: 1 } } };
    held.splice(0).forEach((request) => request.respond({ status: 200, headers: headersFor, body: JSON.stringify(stale) }).catch(() => {}));
    marketingMode = null;
    await sleep(400);
    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction((title) => document.querySelector("input[name=popupTitle]")?.value === title, { timeout: 20000 }, TITLE);
    check("marketing-respuesta-tardia", reloadLocked && (await readStored()).title === TITLE, { reloadLocked, stored: await readStored() });

    await page.$eval("input[name=popupTitle]", (element, value) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }, "Edición de auditoría");
    patchCount = 0;
    await page.evaluate(() => { const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Guardar configuración"); button.click(); button.click(); });
    await page.waitForFunction(() => /guardados/i.test(document.body.innerText), { timeout: 20000 });
    check("marketing-doble-clic", patchCount === 1 && (await readStored()).title === "Edición de auditoría", { patchCount, stored: await readStored() });

    await page.setViewport({ width: 360, height: 800 });
    pqrMode = "500";
    await page.goto(origin + "/admin/pqr", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Fallo PQR de auditoría"), { timeout: 20000 });
    pqrMode = null;
    await clickText("Reintentar PQR");
    await page.waitForFunction(() => document.body.innerText.includes("Sin solicitudes"), { timeout: 20000 });
    check("pqr-error-recuperacion", !(await page.evaluate(() => document.body.innerText.includes("Fallo PQR de auditoría"))));

    pqrMode = "long";
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Solicitud de palma"), { timeout: 20000 });
    const pqrMeasure = await measure();
    await shot("pqr-largo-360.png");
    check("pqr-largo-360", pqrMeasure.overflow <= 1 && pqrMeasure.outside.length === 0, pqrMeasure);
    pqrMode = null;

    await page.goto(origin + "/admin/marketing?tab=carritos", { waitUntil: "domcontentloaded" });
    await page.waitForFunction((email) => document.body.innerText.includes(email.slice(0, 24)), { timeout: 20000 }, longEmail);
    const cartMeasure = await measure();
    await shot("carritos-largo-360.png");
    const remindersDisabled = await page.$$eval("button", (nodes) => nodes.some((b) => b.textContent.includes("Enviar recordatorios") && b.disabled));
    check("carritos-largo-360", cartMeasure.overflow <= 1 && cartMeasure.outside.length === 0 && remindersDisabled, { ...cartMeasure, remindersDisabled });

    financeHuge = true;
    await page.goto(origin + "/admin/finanzas", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /654[\.\s\u00a0]?321/.test(document.body.innerText), { timeout: 20000 });
    const finance360 = await measure();
    await shot("finanzas-cifra-grande-360.png");
    await page.setViewport({ width: 1024, height: 800 });
    await sleep(300);
    const finance1024 = await measure();
    await shot("finanzas-cifra-grande-1024.png");
    check("finanzas-cifras-grandes", finance360.overflow <= 1 && finance1024.overflow <= 1 && finance360.outside.length === 0 && finance1024.outside.length === 0, { finance360, finance1024 });
    financeHuge = false;

    await page.setViewport({ width: 360, height: 800 });
    await page.goto(origin + "/admin/contenido?tab=banners", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Eliminar"), { timeout: 20000 });
    let modalOk = true;
    const modalNotes = [];
    for (let turn = 0; turn < 3; turn++) {
      await clickText("Eliminar");
      await page.waitForSelector(".admin-confirm");
      const focused = await page.evaluate(() => document.activeElement.textContent.trim());
      await page.keyboard.press("Tab");
      const next = await page.evaluate(() => document.activeElement.textContent.trim());
      await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
      const back = await page.evaluate(() => document.activeElement.textContent.trim());
      const box = await page.$eval(".admin-confirm", (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".admin-confirm"));
      const overflow = await page.evaluate(() => document.body.style.overflow);
      modalNotes.push({ focused, next, back, box, overflow });
      modalOk = modalOk && focused === "Cancelar" && next === "Eliminar" && back === "Cancelar" && box.left >= -1 && box.right <= box.width + 1 && box.top >= -1 && box.bottom <= box.height + 1 && overflow !== "hidden";
    }
    await clickText("Eliminar");
    await page.waitForSelector(".admin-confirm");
    await page.goto(origin + "/admin/alertas", { waitUntil: "domcontentloaded" });
    await sleep(400);
    const afterLeave = await page.evaluate(() => ({ dialog: Boolean(document.querySelector(".admin-confirm")), overflow: document.body.style.overflow }));
    check("modal-teclado-360", modalOk && !afterLeave.dialog && afterLeave.overflow !== "hidden", { modalNotes, afterLeave });
    await shot("modal-no-persiste.png");

    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const motion = await page.evaluate(() => ({ matches: matchMedia("(prefers-reduced-motion: reduce)").matches, duration: getComputedStyle(document.querySelector(".admin-shell button, .admin-shell a") || document.body).transitionDuration }));
    check("movimiento-reducido", motion.matches && (motion.duration === "0s" || motion.duration === "0s, 0s"), motion);

    await page.setViewport({ width: 720, height: 900 });
    await page.goto(origin + "/admin/marketing?tab=popup", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("input[name=popupTitle]"));
    const zoom = await page.evaluate(() => { const before = parseFloat(getComputedStyle(document.documentElement).fontSize); document.documentElement.style.fontSize = (before * 2) + "px"; return { before, after: parseFloat(getComputedStyle(document.documentElement).fontSize), overflow: document.documentElement.scrollWidth - innerWidth }; });
    await shot("texto-200.png");
    check("texto-200", zoom.after === zoom.before * 2 && zoom.overflow <= 1, zoom);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(origin + "/admin", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".alert-bell__badge");
    const contrast = await page.evaluate(() => {
      const parts = (value) => (value.match(/\d+(\.\d+)?/g) || []).map(Number);
      const lum = (value) => { const n = parts(value); if (n.length < 3 || n[3] === 0) return null; const c = n.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      return [...document.querySelectorAll(".alert-bell__badge,.dash-badge,.status-badge,.finance-badge,.stock-badge,.request-badge")].map((el) => {
        const style = getComputedStyle(el);
        const fg = lum(style.color), bg = lum(style.backgroundColor);
        return { className: String(el.className), text: el.textContent.trim().slice(0, 40), color: style.color, background: style.backgroundColor, fontSize: style.fontSize, ratio: fg == null || bg == null ? null : Math.round(((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)) * 100) / 100 };
      }).filter((item) => item.ratio != null);
    });
    check("contraste-insignias", contrast.every((item) => item.ratio >= 4.5), { contrast });

    await page.goto(origin + `/admin/pedidos/${orderId}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Comenzar preparación"), { timeout: 20000 });
    await fixture.api("PATCH", `/api/admin/orders/${orderId}/status`, { cookie: ctx.superCookie, body: { orderStatus: "en_preparacion" } });
    await clickText("Comenzar preparación");
    await page.waitForFunction(() => document.body.innerText.includes("No se registró una nueva transición"), { timeout: 20000 });
    const historyCount = (await fixture.context.Order.findById(orderId).lean()).statusHistory.length;
    check("pedido-idempotente", historyCount === 1, { historyCount });

    const vendor = await browser.newPage();
    await vendor.setViewport({ width: 390, height: 844 });
    await vendor.setCookie(...cookies(ctx.vendorCookie, origin));
    await vendor.goto(origin + "/admin/finanzas", { waitUntil: "domcontentloaded" });
    await vendor.waitForFunction(() => location.pathname === "/cuenta" || document.body.innerText.includes("Control financiero"), { timeout: 20000 });
    const vendorFinance = await vendor.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 400), hasFinanceNav: [...document.querySelectorAll("a")].some((a) => a.textContent.trim() === "Finanzas") }));
    await vendor.screenshot({ path: path.join(shots, "vendedor-finanzas-390.png") });
    check("vendedor-finanzas", !vendorFinance.hasFinanceNav && !vendorFinance.text.includes("Control financiero"), vendorFinance);

    result.passed = result.checks.every((item) => item.ok) && result.pageErrors.length === 0 && result.hydrationErrors.length === 0 && result.externalRequests.length === 0;
  } finally {
    fs.writeFileSync(path.join(out, "navegador-independiente.json"), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(out, "navegador-independiente-servidor.txt"), serverLog);
    if (browser) await browser.close();
    if (nextServer) nextServer.kill();
    if (ready) await fixture.close();
    const junction = path.join(stage, "node_modules");
    if (fs.existsSync(junction)) fs.unlinkSync(junction);
    try { const target = fs.realpathSync(stage); if (path.dirname(target) === tempRoot && path.basename(target).startsWith("dizor-fase6-next-")) fs.rmSync(target, { recursive: true, force: true }); } catch { /* temporal ya retirado */ }
  }
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks.map((item) => ({ id: item.id, ok: item.ok })) }, null, 2));
  if (!result.passed) process.exitCode = 1;
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
