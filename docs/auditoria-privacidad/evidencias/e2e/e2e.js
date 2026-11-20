// E2E con navegador real (Chromium de Playwright, caché local) contra el
// entorno AISLADO: frontend 127.0.0.1:3100, API 127.0.0.1:5100, control :5199.
// Cualquier petición fuera de 127.0.0.1 se aborta y se registra.
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH);

const FE = "http://127.0.0.1:3100";
const API = "http://127.0.0.1:5100";
const CTRL = "http://127.0.0.1:5199";
const SHOTS = path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const externalAttempts = [];
const consoleErrors = [];

const ctrl = async (method, p, body) => {
  const r = await fetch(`${CTRL}${p}`, {
    method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};

const REJECTED = JSON.stringify({ statistics: false, analytics: false, marketing: false, timestamp: new Date().toISOString(), version: "3" });

async function newContext(browser, { viewport = { width: 1366, height: 900 }, preset = null } = {}) {
  const context = await browser.newContext({ viewport, locale: "es-CO" });
  if (preset === "rejected") {
    await context.addInitScript((rec) => {
      try {
        if (!localStorage.getItem("dizor_cookie_preferences")) localStorage.setItem("dizor_cookie_preferences", rec);
      } catch { /* about:blank */ }
    }, REJECTED);
  }
  const net = [];
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1" && u.protocol !== "data:" && u.protocol !== "blob:") {
      externalAttempts.push(u.href);
      return route.abort();
    }
    return route.continue();
  });
  context.on("request", (r) => net.push({ method: r.method(), url: r.url(), post: r.postData() || "" }));
  context.on("page", (p) => attachConsole(p));
  return { context, net };
}

function attachConsole(page) {
  page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${page.url()} ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[console] ${page.url()} ${m.text().slice(0, 200)}`);
  });
}

async function step(id, title, fn) {
  const t0 = Date.now();
  try {
    const notes = await fn();
    results.push({ id, title, status: "PASS", ms: Date.now() - t0, notes: notes || "" });
    console.log(`PASS ${id} ${title}`);
  } catch (e) {
    results.push({ id, title, status: "FAIL", ms: Date.now() - t0, notes: String(e.message || e).slice(0, 500) });
    console.log(`FAIL ${id} ${title}: ${String(e.message || e).slice(0, 300)}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const injectCart = async (page, fx, qty = 1) => {
  await page.evaluate(([f, q]) => {
    localStorage.setItem("dizor_cart_v1", JSON.stringify([{
      productId: f.productId, variantId: f.variantId, quantity: q, productName: "Sombrero Fixture E2E",
      productSlug: f.slug, unitPrice: f.price, productImage: "/favicon-dizor-192.png", maxStock: 20,
      sizeName: "M", colorName: "Natural",
    }]));
  }, [fx, qty]);
};

const storage = (page) => page.evaluate(() => ({
  prefs: localStorage.getItem("dizor_cookie_preferences"),
  lastVisit: localStorage.getItem("dizor_last_visit_day"),
  legacy: localStorage.getItem("dizor_analytics_consent"),
  keys: Object.keys(localStorage),
}));

const apiCookie = async (context, name) => (await context.cookies(API)).find((c) => c.name === name);

async function checkout(page, buyer, { fillBuyer = true } = {}) {
  await page.goto(`${FE}/checkout`);
  await page.waitForSelector("text=Datos del cliente");
  if (fillBuyer) {
    await page.fill('input[name="name"]', buyer.name);
    await page.fill('input[name="email"]', buyer.email);
  }
  await page.fill('input[name="phone"]', buyer.phone);
  await page.click("button:has-text('Continuar')");
  await page.fill('input[name="address"]', "Calle Fixture 123");
  await page.fill('input[name="city"]', "Pasto");
  await page.click("button:has-text('Continuar')");
  await page.click("button:has-text('Continuar')");
  await page.click("button:has-text('Continuar')");
  await page.waitForSelector("text=Revisión y confirmación");
}

(async () => {
  const browser = await chromium.launch();
  const fx = await ctrl("GET", "/fixture");
  await ctrl("POST", "/reset-limits");

  // ── CONSENTIMIENTO ───────────────────────────────────────────────────────
  {
    const { context, net } = await newContext(browser);
    const page = await context.newPage();

    await step("C-01", "Primera visita: banner visible y sin almacenamiento ni peticiones opcionales", async () => {
      await page.goto(FE + "/");
      await page.waitForSelector(".cookie-banner", { timeout: 15000 });
      await page.waitForTimeout(1500);
      const s = await storage(page);
      const reg = net.filter((r) => r.url.includes("/visits/register"));
      const cookie = await apiCookie(context, "dizor_visit_day");
      await page.screenshot({ path: path.join(SHOTS, "C-01-primera-visita.png") });
      assert(reg.length === 0, `registro de visita sin permiso: ${reg.length}`);
      assert(!cookie, "cookie de conteo antes de decidir");
      assert(!s.lastVisit && !s.prefs, "almacenamiento opcional antes de decidir");
      const bannerText = await page.textContent(".cookie-banner");
      assert(/contador de visitas propio/.test(bannerText), "el banner no menciona el contador");
      assert(!/Google Analytics/.test(bannerText), "el banner anuncia GA estando apagado");
      return `Banner: "${bannerText.trim().slice(0, 140)}…"`;
    });

    await step("C-02", "Aceptar: se activa solo lo aceptado (registro de visita + cookie + clave)", async () => {
      await page.click(".cookie-banner >> text=Aceptar");
      await page.waitForResponse((r) => r.url().includes("/visits/register"), { timeout: 10000 });
      await page.waitForTimeout(500);
      const s = await storage(page);
      const cookie = await apiCookie(context, "dizor_visit_day");
      const rec = JSON.parse(s.prefs);
      assert(rec.version === "3" && rec.statistics === true && rec.analytics === false, `registro: ${s.prefs}`);
      assert(cookie, "falta cookie dizor_visit_day");
      assert(s.lastVisit, "falta dizor_last_visit_day");
      assert(!(await page.isVisible(".cookie-banner")), "banner sigue visible");
      return `prefs=${s.prefs}`;
    });

    await step("C-03", "Recarga y navegación interna: decisión recordada, sin doble conteo", async () => {
      const before = net.filter((r) => r.url.includes("/visits/register")).length;
      await page.reload();
      await page.waitForTimeout(1200);
      await page.click("footer >> text=Catálogo");
      await page.waitForURL(/\/catalogo/);
      await page.waitForTimeout(1200);
      const after = net.filter((r) => r.url.includes("/visits/register")).length;
      assert(!(await page.isVisible(".cookie-banner")), "banner reaparece");
      assert(after === before, `conteos extra: ${after - before}`);
    });

    await step("C-04", "Retirada desde 'Configurar cookies' → Rechazar todo: se detiene el conteo y se borra lo guardado", async () => {
      await page.click("footer >> text=Configurar cookies");
      await page.waitForSelector(".cookie-panel");
      await page.screenshot({ path: path.join(SHOTS, "C-04-panel.png") });
      const statsChecked = await page.isChecked('input[data-category="statistics"]');
      const analyticsDisabled = await page.isDisabled('input[data-category="analytics"]');
      assert(statsChecked, "el panel no refleja la decisión guardada");
      assert(analyticsDisabled, "analítica seleccionable estando apagada");
      const forgetWait = page.waitForResponse((r) => r.url().includes("/visits/forget"), { timeout: 10000 });
      await page.click(".cookie-panel >> text=Rechazar todo");
      await forgetWait;
      await page.waitForTimeout(500);
      const s = await storage(page);
      const cookie = await apiCookie(context, "dizor_visit_day");
      assert(!s.lastVisit, "dizor_last_visit_day no se borró");
      assert(!cookie, "cookie dizor_visit_day no se borró");
      assert(JSON.parse(s.prefs).statistics === false, "decisión no guardada como rechazo");
      // Tras retirar: nuevas visitas no registran.
      await page.evaluate(() => localStorage.removeItem("dizor_last_visit_day"));
      const before = net.filter((r) => r.url.includes("/visits/register")).length;
      await page.reload();
      await page.waitForTimeout(1500);
      const after = net.filter((r) => r.url.includes("/visits/register")).length;
      assert(after === before, "sigue registrando visitas tras retirar el permiso");
      assert(!(await page.isVisible(".cookie-banner")), "banner reaparece tras decidir");
    });
    await context.close();
  }

  {
    const { context, net } = await newContext(browser);
    const page = await context.newPage();
    await step("C-05", "Rechazar en la primera visita: nada opcional y la tienda funciona", async () => {
      await page.goto(FE + "/");
      await page.waitForSelector(".cookie-banner");
      await page.click(".cookie-banner >> text=Rechazar");
      await page.waitForTimeout(800);
      await page.goto(FE + "/catalogo");
      await page.waitForSelector("text=Sombrero Fixture E2E", { timeout: 15000 });
      await injectCart(page, fx);
      await page.goto(FE + "/carrito");
      await page.waitForSelector("text=Sombrero Fixture E2E");
      const reg = net.filter((r) => r.url.includes("/visits/register"));
      const cookie = await apiCookie(context, "dizor_visit_day");
      const s = await storage(page);
      assert(reg.length === 0 && !cookie && !s.lastVisit, "almacenamiento/petición opcional tras rechazar");
      assert(s.keys.includes("dizor_cart_v1"), "carrito no conservado");
    });
    await context.close();
  }

  {
    const { context, net } = await newContext(browser);
    const page = await context.newPage();
    await step("C-06", "Elección parcial desde 'Configurar': solo estadísticas", async () => {
      await page.goto(FE + "/");
      await page.waitForSelector(".cookie-banner");
      await page.click(".cookie-banner >> text=Configurar");
      await page.waitForSelector(".cookie-panel");
      assert(!(await page.isChecked('input[data-category="statistics"]')), "estadísticas premarcadas");
      assert(await page.isDisabled('input[data-category="marketing"]'), "marketing seleccionable");
      // El usuario pulsa el interruptor visual (el <input> queda debajo).
      await page.locator("label.cookie-toggle", { has: page.locator('input[data-category="statistics"]') }).click();
      assert(await page.isChecked('input[data-category="statistics"]'), "no se marcó");
      const regWait = page.waitForResponse((r) => r.url().includes("/visits/register"), { timeout: 10000 });
      await page.click(".cookie-panel >> text=Guardar preferencias");
      await regWait;
      const rec = JSON.parse((await storage(page)).prefs);
      assert(rec.statistics === true && rec.analytics === false, JSON.stringify(rec));
    });
    await context.close();
  }

  // ── REGISTRO SIN SUSCRIPCIÓN AUTOMÁTICA ──────────────────────────────────
  const userA = { name: "Cliente A E2E", email: "cliente-a@example.test", password: "ClienteA12345", phone: "3001112233" };
  {
    const { context, net } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("R-01", "Registro con autorización obligatoria y sin inscripción comercial", async () => {
      await page.goto(FE + "/register");
      await page.fill('input[name="name"]', userA.name);
      await page.fill('input[name="email"]', userA.email);
      await page.fill('input[name="password"]', userA.password);
      const btn = page.locator("button:has-text('Registrarme')");
      await page.waitForSelector("#consent-account");
      assert(await btn.isDisabled(), "registro posible sin autorización");
      assert(!(await page.isChecked("#consent-account")), "casilla premarcada");
      await page.check("#consent-account");
      await btn.click();
      await page.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 15000 });
      await injectCart(page, fx);
      const syncWait = page.waitForResponse((r) => r.url().includes("/cart/sync"), { timeout: 10000 });
      await page.reload();
      await syncWait;
      const carts = await ctrl("POST", "/db/carts", { email: userA.email });
      const subs = await ctrl("POST", "/db/subscribers", { email: userA.email });
      const consent = await ctrl("POST", "/db/consent", { subjectEmail: userA.email, purpose: "account" });
      assert(carts.length === 0, "quedó inscrito en recordatorios");
      assert(subs.length === 0, "quedó suscrito a la newsletter");
      assert(consent.length === 1 && consent[0].textStatus === "published" && consent[0].textVersion === "2", "sin evidencia de autorización");
      return "0 AbandonedCart, 0 suscripciones, 1 ConsentRecord(account, published v2)";
    });
    await context.close();
  }

  // ── CHECKOUT INVITADO ────────────────────────────────────────────────────
  const guest = { name: "Invitado E2E", email: "invitado@example.test", phone: "3009998877" };
  let guestOrder = null;
  {
    await ctrl("POST", "/reset-limits");
    const { context, net } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("K-01", "Checkout invitado: resumen con precio unitario, autorización y confirmación sin datos en la URL", async () => {
      await page.goto(FE + "/");
      await injectCart(page, fx, 2);
      await checkout(page, guest);
      const table = await page.textContent(".checkout-summary-table");
      assert(/Sombrero Fixture E2E/.test(table) && /Precio unitario/.test(table), "resumen sin líneas");
      assert(/120\.000/.test(table) && /240\.000/.test(table), `importes: ${table}`);
      const review = await page.textContent(".checkout-card");
      assert(/Envío\s*Incluido en el precio/.test(review), "envío no aparece como incluido");
      assert(!/Gratis|gratis/.test(review), "anuncia envío gratis");
      assert(/Total\s*\$\s?240\.000/.test(review), `total sin cargo de envío: ${review.slice(-200)}`);
      assert(!/Texto en revisión|PLACEHOLDER|borrador/i.test(review), "marcas internas visibles");
      assert(/COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS/.test(review), "autorización sin responsable");
      const confirmBtn = page.locator("button:has-text('Confirmar pedido')");
      assert(await confirmBtn.isDisabled(), "confirmable sin autorización");
      assert(!(await page.isChecked("#consent-terms")), "términos premarcados");
      await page.screenshot({ path: path.join(SHOTS, "K-01-resumen.png"), fullPage: true });
      await page.check("#consent-order_processing");
      assert(await confirmBtn.isDisabled(), "confirmable sin aceptar términos");
      await page.check("#consent-terms");
      await confirmBtn.click();
      await page.waitForURL(/\/pedido\/confirmacion\?order=/, { timeout: 20000 });
      const url = new URL(page.url());
      guestOrder = url.searchParams.get("order");
      assert([...url.searchParams.keys()].join(",") === "order", `parámetros: ${url.search}`);
      // Se espera el contenido semántico (número y estado del pago), no un
      // texto de diseño que el propietario está modificando.
      await page.waitForSelector(".order-view__title", { timeout: 15000 });
      await page.waitForFunction((o) => document.body.innerText.includes(o), guestOrder, { timeout: 15000 });
      const body = await page.textContent("body");
      assert(body.includes(guestOrder), "número de pedido no visible");
      assert(!/Pago aprobado|¡Pedido confirmado!/.test(body), "presenta como pagado");
      assert(/Pendiente/.test(body), "no muestra el estado pendiente del pago");
      await page.screenshot({ path: path.join(SHOTS, "K-01-confirmacion.png"), fullPage: true });
      const leaks = net.filter((r) => r.url.includes("invitado%40") || r.url.includes("invitado@") || r.url.includes("Invitado"));
      assert(leaks.length === 0, `datos personales en URL: ${leaks.map((l) => l.url).join(" ")}`);
      const mail = (await ctrl("GET", "/mail")).filter((m) => m.fn === "orderReceipt" && m.arg.to === guest.email);
      assert(mail.length === 1, `acuses al comprador: ${mail.length}`);
      assert(/Pago pendiente/.test(mail[0].arg.html), "acuse sin estado de pago pendiente");
      assert(/Incluido en el precio/.test(mail[0].arg.html) && /901\.027\.825-5/.test(mail[0].arg.html), "acuse sin envío incluido o sin NIT");
      const [ord] = await ctrl("POST", "/db/orders", { orderNumber: guestOrder });
      assert(ord.paymentStatus === "pendiente" && ord.legal.termsVersion === "1" && ord.shippingIncluded === true && ord.total === 240000,
        `pedido: ${ord.paymentStatus} ${ord.legal.termsVersion} ${ord.shippingIncluded} ${ord.total}`);
      const body2 = await page.textContent("body");
      assert(/Incluido en el precio/.test(body2) && !/Gratis/.test(body2), "confirmación: envío");
      const ss = await page.evaluate(() => Object.keys(sessionStorage));
      assert(!ss.includes("dizor_guest_email") && ss.includes("dizor_order_access"), `sessionStorage: ${ss}`);
      return `pedido ${guestOrder}; 1 acuse; sessionStorage=${ss.join(",")}`;
    });

    await step("K-02", "Otra pestaña sin token: modo limitado, sin datos del pedido", async () => {
      const p2 = await context.newPage();
      await p2.goto(`${FE}/pedido/confirmacion?order=${guestOrder}`);
      await p2.waitForSelector("text=Por seguridad", { timeout: 15000 });
      const body = await p2.textContent("body");
      assert(!body.includes("Sombrero Fixture E2E") && !body.includes(guest.email), "muestra datos sin token");
      await p2.close();
    });

    await step("K-03", "Enlace antiguo con correo y nombre: URL limpiada y sin exponer datos", async () => {
      await page.goto(`${FE}/pedido/confirmacion?order=${guestOrder}&email=invitado%40example.test&name=Invitado&total=1`);
      await page.waitForFunction(() => /Pendiente/.test(document.body.innerText), null, { timeout: 15000 });
      await page.waitForTimeout(500);
      const u = new URL(page.url());
      assert([...u.searchParams.keys()].join(",") === "order", `URL no limpiada: ${u.search}`);
    });

    await step("K-04", "Seguimiento: enlace antiguo con correo se limpia; consulta por POST", async () => {
      await page.goto(`${FE}/seguimiento?order=${guestOrder}&email=invitado%40example.test`);
      await page.waitForTimeout(800);
      const u = new URL(page.url());
      assert(!u.searchParams.has("email"), `correo en URL: ${u.search}`);
      assert((await page.inputValue('input[name="orderNumber"]')) === guestOrder, "número no prellenado");
      assert((await page.inputValue('input[name="email"]')) === "", "correo prellenado desde la URL");
      await page.fill('input[name="email"]', guest.email);
      const tr = page.waitForRequest((r) => r.url().includes("/checkout/track"));
      await page.click("button:has-text('Consultar')");
      const r = await tr;
      assert(r.method() === "POST" && !r.url().includes("email"), `${r.method()} ${r.url()}`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SHOTS, "K-04-seguimiento.png"), fullPage: true });
    });
    await context.close();
  }

  // ── COMPRADOR AUTENTICADO Y ACCESO CRUZADO ───────────────────────────────
  let ownerOrder = null;
  {
    await ctrl("POST", "/reset-limits");
    const { context } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("A-01", "Comprador autenticado: acceso a su pedido aun sin token en la pestaña", async () => {
      await page.goto(FE + "/login");
      await page.fill('input[name="email"]', userA.email);
      await page.fill('input[name="password"]', userA.password);
      await page.click("button:has-text('Entrar')");
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
      await injectCart(page, fx);
      await checkout(page, { phone: userA.phone }, { fillBuyer: false });
      await page.check("#consent-order_processing");
      await page.check("#consent-terms");
      await page.click("button:has-text('Confirmar pedido')");
      await page.waitForURL(/\/pedido\/confirmacion\?order=/, { timeout: 20000 });
      ownerOrder = new URL(page.url()).searchParams.get("order");
      await page.waitForFunction(() => /Pendiente/.test(document.body.innerText), null, { timeout: 15000 });
      await page.evaluate(() => sessionStorage.clear());
      await page.reload();
      await page.waitForFunction((o) => document.body.innerText.includes(o) && /Pendiente/.test(document.body.innerText), ownerOrder, { timeout: 15000 });
      return `pedido ${ownerOrder} visible tras borrar el token (sesión de dueño)`;
    });
    await context.close();
  }
  {
    await ctrl("POST", "/reset-limits");
    const { context } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("A-02", "Otro usuario autenticado no ve el pedido ajeno", async () => {
      await page.goto(FE + "/register");
      await page.fill('input[name="name"]', "Cliente B E2E");
      await page.fill('input[name="email"]', "cliente-b@example.test");
      await page.fill('input[name="password"]', "ClienteB12345");
      await page.check("#consent-account");
      await page.click("button:has-text('Registrarme')");
      await page.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 15000 });
      await page.goto(`${FE}/pedido/confirmacion?order=${ownerOrder}`);
      await page.waitForSelector("text=Por seguridad", { timeout: 15000 });
      const body = await page.textContent("body");
      assert(!body.includes(userA.email) && !body.includes("Sombrero Fixture E2E"), "expone datos ajenos");
    });
    await context.close();
  }

  // ── NEWSLETTER, BAJA Y COLA ──────────────────────────────────────────────
  {
    const { context } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("M-01", "Newsletter: casilla opcional obligatoria para este formulario, evidencia y baja sin sesión", async () => {
      await page.goto(FE + "/");
      // La sección se carga de forma diferida: esperar a que esté montada.
      await page.waitForSelector("#consent-newsletter-home", { timeout: 15000 });
      await page.locator("#consent-newsletter-home").scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const input = page.locator(".home-newsletter input[type=email]");
      await input.fill("news-e2e@example.test");
      const btn = page.locator(".home-newsletter button:has-text('Suscribirme')");
      assert(await btn.isDisabled(), "suscripción sin casilla");
      assert(!(await page.isChecked("#consent-newsletter-home")), "casilla premarcada");
      await page.check("#consent-newsletter-home");
      await btn.click();
      await page.waitForSelector(".home-newsletter .newsletter__feedback", { timeout: 10000 });
      const subs = await ctrl("POST", "/db/subscribers", { email: "news-e2e@example.test" });
      assert(subs.length === 1 && subs[0].lastConsentRecord, "sin evidencia");
      const { url } = await ctrl("POST", "/newsletter-unsubscribe-url", { email: "news-e2e@example.test" });
      await page.goto(url);
      await page.waitForSelector("button:has-text('Confirmar baja')");
      assert(new URL(page.url()).search === "", "token sigue en la barra de direcciones");
      await page.click("button:has-text('Confirmar baja')");
      await page.waitForSelector("text=Tu baja quedó registrada");
      await page.screenshot({ path: path.join(SHOTS, "M-01-baja.png") });
      const sup = await ctrl("POST", "/db/suppression", { email: "news-e2e@example.test" });
      assert(sup.length === 1, "sin supresión");
    });

    await step("M-02", "Recordatorio de carrito DESACTIVADO: no se ofrece, el API lo rechaza y no hay envíos", async () => {
      await injectCart(page, fx);
      await page.goto(FE + "/carrito");
      await page.waitForSelector(".cart-summary__row--total");
      await page.waitForTimeout(1500);
      assert(await page.locator(".abandoned-cart-capture").count() === 0, "se ofrece el recordatorio");
      const summary = await page.textContent(".cart-summary");
      assert(/Incluido en el precio/.test(summary) && !/Gratis/.test(summary), `carrito: ${summary}`);
      const direct = await page.evaluate(async ([api, f]) => {
        const r = await fetch(`${api}/api/marketing/abandoned-cart`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ email: "carro-e2e@example.test", items: [{ productId: f.productId, variantId: f.variantId, quantity: 1 }], marketingConsent: true }),
        });
        return r.status;
      }, [API, fx]);
      assert(direct === 503, `POST directo → ${direct}`);
      const carts = await ctrl("POST", "/db/carts", { email: "carro-e2e@example.test" });
      assert(carts.length === 0, "se guardó un carrito");
      const r1 = await ctrl("POST", "/reminders", { now: "2026-11-17T15:00:00Z" });
      assert(r1.reason === "feature_disabled", JSON.stringify(r1));
      await page.screenshot({ path: path.join(SHOTS, "M-02-carrito.png"), fullPage: true });
      return "sin formulario; API 503; envío: feature_disabled";
    });

    await step("X-01", "Cliente antiguo/manipulado: Nequi directo y transferencia manual rechazados por el backend", async () => {
      await page.goto(FE + "/checkout");
      await page.waitForSelector("text=Datos del cliente");
      const statuses = await page.evaluate(async ([api, f]) => {
        const out = [];
        for (const pm of ["nequi_api", "nequi_manual"]) {
          const r = await fetch(`${api}/api/checkout/orders`, {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({
              items: [{ productId: f.productId, variantId: f.variantId, quantity: 1 }],
              buyer: { name: "Antiguo", email: "antiguo@example.test", phone: "3000000000" },
              shippingAddress: { address: "Calle 1", city: "Pasto", department: "Nariño" },
              paymentMethod: pm, nequiPhone: "3001234567", carrier: "interrapidisimo",
              privacyAuthorization: true, termsAccepted: true, idempotencyKey: crypto.randomUUID(),
            }),
          });
          out.push(r.status);
        }
        for (const ep of ["/api/payments/nequi/webhook", "/api/payments/nequi/create"]) {
          const r = await fetch(`${api}${ep}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          out.push(r.status);
        }
        return out;
      }, [API, fx]);
      assert(JSON.stringify(statuses) === JSON.stringify([400, 400, 410, 410]), `estados: ${statuses}`);
      const orders = await ctrl("POST", "/db/orders", { "buyer.email": "antiguo@example.test" });
      assert(orders.length === 0, "se creó un pedido");
      // Opciones visibles en el paso de pago.
      await page.fill('input[name="name"]', "Opciones");
      await page.fill('input[name="email"]', "opciones@example.test");
      await page.fill('input[name="phone"]', "3000000001");
      await page.click("button:has-text('Continuar')");
      await page.fill('input[name="address"]', "Calle 2");
      await page.fill('input[name="city"]', "Pasto");
      await page.click("button:has-text('Continuar')");
      const carriers = await page.locator(".checkout-payment-option__title").allTextContents();
      assert(JSON.stringify(carriers) === JSON.stringify(["Inter Rapidísimo", "Servientrega"]), `transportadoras: ${carriers}`);
      await page.click("button:has-text('Continuar')");
      const methods = await page.locator(".checkout-payment-option__title").allTextContents();
      assert(methods.length === 2 && /Wompi/.test(methods[0]) && /contra entrega/i.test(methods[1]) && !methods.some((m) => /Nequi/.test(m)),
        `medios: ${methods}`);
      await page.screenshot({ path: path.join(SHOTS, "X-01-medios-pago.png"), fullPage: true });
      return `estados ${statuses.join(",")}; medios: ${methods.join(" | ")}`;
    });
    await context.close();
  }

  // ── PQR ──────────────────────────────────────────────────────────────────
  let pqr = null;
  {
    await ctrl("POST", "/reset-limits");
    const { context } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("P-01", "PQR: radicado con fecha y hora solo tras persistir; constancia", async () => {
      await page.goto(FE + "/pqr");
      await page.selectOption("#pqr-category", "consumo");
      await page.selectOption("#pqr-type", "reclamo");
      await page.fill('input[name="name"]', "Reclamante E2E");
      await page.fill('input[name="email"]', "pqr-e2e@example.test");
      await page.fill("#pqr-description", "Reclamo de prueba E2E con datos sintéticos");
      const btn = page.locator("button:has-text('Radicar solicitud')");
      assert(await btn.isDisabled(), "radicable sin autorización");
      await page.check("#consent-customer_request");
      await btn.click();
      await page.waitForSelector("text=Solicitud radicada", { timeout: 15000 });
      const text = await page.textContent("body");
      const radicado = (text.match(/PQR-\d{8}-[0-9A-F]{8}/) || [])[0];
      const code = await page.textContent("code");
      assert(radicado && code && code.length >= 32, "radicado o código ausente");
      const db = await ctrl("POST", "/db/pqr", { radicado });
      assert(db.length === 1, "no persistida");
      const mail = (await ctrl("GET", "/mail")).filter((m) => m.fn === "pqrReceipt" && m.arg.html.includes(radicado));
      assert(mail.length === 1, "sin constancia");
      pqr = { radicado, code };
      await page.screenshot({ path: path.join(SHOTS, "P-01-radicado.png"), fullPage: true });
      return radicado;
    });
    await step("P-02", "PQR: seguimiento con código; código incorrecto no muestra nada", async () => {
      await page.goto(FE + "/pqr/seguimiento");
      await page.fill('input[name="radicado"]', pqr.radicado);
      await page.fill('input[name="accessCode"]', "0".repeat(64));
      await page.click("button:has-text('Consultar')");
      await page.waitForSelector("text=Solicitud no encontrada");
      await page.fill('input[name="accessCode"]', pqr.code);
      await page.click("button:has-text('Consultar')");
      await page.waitForSelector("text=Historial");
      const body = await page.textContent("body");
      assert(!body.includes("pqr-e2e@example.test"), "expone el correo");
    });
    await context.close();
  }
  {
    await ctrl("POST", "/reset-limits");
    const { context } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("P-03", "Admin PQR: gestiona estado; nota pública visible y nota interna oculta", async () => {
      await page.goto(FE + "/login");
      await page.fill('input[name="email"]', "admin-e2e@example.test");
      await page.fill('input[name="password"]', "AdminE2E12345");
      await page.click("button:has-text('Entrar')");
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
      await page.goto(FE + "/admin/pqr");
      await page.waitForSelector(`text=${pqr.radicado}`, { timeout: 15000 });
      await page.locator("tr", { hasText: pqr.radicado }).locator("button:has-text('Ver')").click();
      await page.waitForSelector("text=Actualizar estado");
      await page.locator("section select").selectOption("en_tramite");
      await page.fill("textarea[placeholder^='Nota visible']", "Estamos revisando tu caso (E2E)");
      await page.fill("textarea[placeholder^='Nota interna']", "nota-interna-e2e");
      await page.click("button:has-text('Guardar cambio de estado')");
      await page.waitForSelector("text=Nota al solicitante: Estamos revisando tu caso (E2E)");
      await page.screenshot({ path: path.join(SHOTS, "P-03-admin.png"), fullPage: true });
      const pub = await fetch(`${API}/api/pqr/track`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radicado: pqr.radicado, accessCode: pqr.code }),
      }).then((r) => r.text());
      assert(pub.includes("Estamos revisando") && !pub.includes("nota-interna-e2e"), "notas mal expuestas");
    });
    await context.close();
  }
  {
    await ctrl("POST", "/reset-limits");
    const { context } = await newContext(browser, { preset: "rejected" });
    const page = await context.newPage();
    await step("P-04", "Cliente sin rol de administrador no accede a /admin/pqr", async () => {
      await page.goto(FE + "/login");
      await page.fill('input[name="email"]', userA.email);
      await page.fill('input[name="password"]', userA.password);
      await page.click("button:has-text('Entrar')");
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
      await page.goto(FE + "/admin/pqr");
      await page.waitForTimeout(2500);
      const body = await page.textContent("body");
      assert(!body.includes(pqr.radicado), "cliente ve PQR");
      return `URL final: ${new URL(page.url()).pathname}`;
    });
    await context.close();
  }

  // ── ENLACES Y PÁGINAS LEGALES (escritorio y móvil) ───────────────────────
  for (const [label, viewport] of [["escritorio", { width: 1366, height: 900 }], ["movil", { width: 390, height: 844 }]]) {
    const { context } = await newContext(browser, { viewport });
    const page = await context.newPage();
    await step(`L-${label}`, `Pie de página y páginas legales (${label})`, async () => {
      await page.goto(FE + "/");
      await page.waitForSelector(".cookie-banner");
      await page.screenshot({ path: path.join(SHOTS, `L-${label}-banner.png`) });
      // El banner no debe tapar sus propios botones.
      for (const b of ["Configurar", "Rechazar", "Aceptar"]) {
        assert(await page.locator(`.cookie-banner >> text=${b}`).isVisible(), `botón ${b} no visible`);
      }
      const bannerBox = await page.locator(".cookie-banner").boundingBox();
      assert(bannerBox.height <= viewport.height * 0.35, `banner ocupa ${Math.round(bannerBox.height)}px de ${viewport.height}px`);
      await page.click(".cookie-banner >> text=Rechazar");
      const footer = page.locator("footer.site-footer");
      const sic = footer.locator("a[href='https://www.sic.gov.co/']");
      assert(await sic.count() === 1, "sin enlace a la SIC");
      assert((await sic.getAttribute("target")) === "_blank", "SIC sin nueva pestaña");
      assert(await footer.locator("a[href='/pqr']").count() === 1, "sin enlace PQR");
      await footer.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, `L-${label}-footer.png`), fullPage: false });
      const footerText = await footer.textContent();
      assert(/COMERCIALIZADORA DE ARTESANIAS SANDONEÑA PARRA S SAS/.test(footerText) && /901\.027\.825-5/.test(footerText), "pie sin identificación del vendedor");
      for (const href of ["/terminos-y-condiciones", "/garantias-y-devoluciones", "/pagina/envios"]) {
        assert(await footer.locator(`a[href='${href}']`).count() === 1, `pie sin ${href}`);
      }
      const pages = ["/politica-de-privacidad", "/politica-de-cookies", "/terminos-y-condiciones", "/garantias-y-devoluciones", "/pagina/envios", "/pqr", "/pqr/seguimiento", "/baja", "/seguimiento"];
      const out = [];
      for (const p of pages) {
        const resp = await page.goto(FE + p);
        out.push(`${p}:${resp.status()}`);
        assert(resp.status() === 200, `${p} → ${resp.status()}`);
      }
      await page.goto(FE + "/politica-de-cookies");
      const t = await page.textContent("body");
      assert(t.includes("Estadísticas propias") && t.includes("dizor_visit_day"), "política sin inventario actualizado");
      const MARKS = /PLACEHOLDER|Texto en revisi[oó]n|pendiente de (revisi[oó]n|abogado)|NO PUBLICAR|\bborrador\b|\[PENDIENTE/i;
      for (const p of ["/politica-de-privacidad", "/politica-de-cookies", "/terminos-y-condiciones", "/garantias-y-devoluciones", "/pagina/envios"]) {
        await page.goto(FE + p);
        const main = await page.textContent("article.content-page");
        assert(!MARKS.test(main), `${p}: marca interna "${(main.match(MARKS) || [])[0]}"`);
        assert(/Versión \d/.test(main), `${p}: sin versión`);
        assert(!/Vigente desde/.test(main), `${p}: fecha de vigencia sin definir en el despliegue`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(overflow <= 1, `${p}: desborde horizontal ${overflow}px`);
        await page.screenshot({ path: path.join(SHOTS, `L-${label}${p.replace(/\//g, "_")}.png`), fullPage: true });
      }
      await page.goto(FE + "/pagina/envios");
      assert((await page.textContent("h1")).trim() === "Envíos y entregas", "título de envíos");
      const env = await page.textContent("article.content-page");
      assert(/Inter Rapidísimo o Servientrega/.test(env) && /incluido en el precio/.test(env) && !/gratis|Coordinadora|Envía y/i.test(env), "contenido de envíos");
      assert(!/días hábiles/.test(env), "publica un plazo de entrega aún no definido");
      await page.goto(FE + "/garantias-y-devoluciones");
      const g = await page.textContent("article.content-page");
      for (const needle of ["Garantía legal", "Derecho de retracto", "Reversión del pago", "Cambios voluntarios", "no exigimos video"]) {
        assert(g.includes(needle), `garantías sin "${needle}"`);
      }
      assert(!/5 días hábiles posteriores a la entrega si recibes/.test(g), "texto antiguo de cambios");
      await page.goto(FE + "/pagina/cambios");
      assert(new URL(page.url()).pathname === "/garantias-y-devoluciones", `redirección de cambios → ${page.url()}`);
      // Regresión visual de los cambios recientes del propietario.
      const tallas = await page.goto(FE + "/guia-de-tallas");
      assert(tallas.status() === 200, `guía de tallas → ${tallas.status()}`);
      await page.screenshot({ path: path.join(SHOTS, `R-${label}-guia-tallas.png`), fullPage: true });
      const cat = await page.goto(FE + "/catalogo");
      assert(cat.status() === 200, `catálogo → ${cat.status()}`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `R-${label}-catalogo.png`), fullPage: false });
      await page.goto(FE + "/");
      await page.click("footer >> text=Configurar cookies");
      await page.waitForSelector(".cookie-panel");
      await page.screenshot({ path: path.join(SHOTS, `L-${label}-panel.png`) });
      const box = await page.locator(".cookie-panel__panel").boundingBox();
      assert(box && box.width <= viewport.width, "panel desborda la pantalla");
      return out.join(" ");
    });
    await context.close();
  }

  await browser.close();

  const blockedBackend = await ctrl("GET", "/blocked");
  const report = {
    date: new Date().toISOString(),
    browser: "Chromium (Playwright 1.61.1, caché local)",
    results,
    externalAttemptsFromBrowser: externalAttempts,
    externalAttemptsFromBackend: blockedBackend,
    consoleErrors,
  };
  fs.writeFileSync(path.join(__dirname, "e2e-results.json"), JSON.stringify(report, null, 2));
  const pass = results.filter((r) => r.status === "PASS").length;
  console.log(`\nRESUMEN: ${pass}/${results.length} PASS; peticiones externas navegador=${externalAttempts.length} backend=${blockedBackend.length}; errores consola=${consoleErrors.length}`);
})().catch((e) => {
  console.error("E2E abortado:", e);
  process.exit(1);
});
