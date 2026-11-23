"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");

module.exports = async ({ page, fixture, ctx, origin, out, result, goto, click, check, sleep }) => {
  const fixed = result.mode === "fixed";
  const { product, variantId } = await fixture.makeProduct(50, 180000);
  await ctx.Product.updateOne({ _id: product._id }, { $set: { name: "Sombrero prueba contraentrega", mainImage: "/favicon-dizor.png" } });
  await require("../../../backend/src/models/marketingSettings").findOneAndUpdate({ key: "default" }, { $set: { "popup.enabled": false } }, { upsert: true });
  const item = { productId: String(product._id), variantId: String(variantId), quantity: 1, unitPrice: 180000, maxStock: 50,
    productName: "Sombrero prueba contraentrega", productSlug: product.slug, productImage: "/favicon-dizor.png", sizeName: "U", colorName: "Natural" };
  result.http = []; result.hitTests = []; result.checkout404s = []; result.createRequests = 0;
  let created;
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (!["127.0.0.1", "localhost"].includes(u.hostname) && !req.url().startsWith("data:")) { result.externalRequests.push(u.origin + u.pathname); return req.abort(); }
    if (req.method() === "POST" && u.pathname === "/api/checkout/orders") result.createRequests++;
    return req.continue();
  });
  page.on("response", async (response) => {
    const u = new URL(response.url()), req = response.request();
    const relevant = u.pathname === "/carrito" || u.pathname === "/checkout" || u.pathname.startsWith("/pedido/") || u.pathname.startsWith("/api/checkout/");
    if (!relevant) return;
    const entry = { method: req.method(), url: response.url(), status: response.status(), resource: req.resourceType(), rsc: req.headers().rsc === "1" };
    result.http.push(entry);
    if (response.status() === 404) result.checkout404s.push(entry);
    if (req.method() === "POST" && u.pathname === "/api/checkout/orders" && response.status() === 201) {
      created = (await response.json()).order;
    }
  });
  // Seed only the cart page. Confirmation reloads never seed a new cart/order.
  await page.evaluateOnNewDocument((item, origin) => {
    if (location.origin === origin && location.pathname === "/carrito") localStorage.setItem("dizor_cart_v1", JSON.stringify([item]));
  }, item, origin);
  const fill = async (id, value) => { await page.click(id); await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control"); await page.type(id, value); };
  const prepare = async (width, height) => {
    await page.setViewport({ width, height, hasTouch: true });
    await goto("/carrito", "Ir a checkout");
    const reject = await page.$eval("body", (body) => [...body.querySelectorAll("button")].some((b) => b.textContent.trim() === "Rechazar"));
    if (reject) await click("Rechazar");
    await click("Ir a checkout");
    await page.waitForSelector(".checkout-layout");
    for (const [id, value] of Object.entries({ name: "Invitado Auditoría", email: "invitado-auditoria@example.test", phone: "3000000000", address: "Calle local 10" })) await fill("#" + id, value);
    await fill("#municipality", "sandona"); await page.click("#municipality-option-52683");
    await page.waitForSelector('.checkout-final button:not(:disabled)');
    assert(await page.$eval('input[value="contra_entrega"]', (e) => e.checked));
  };
  const sample = (delta, pause) => page.evaluate(({ delta, pause }) => {
    const button = document.querySelector('.checkout-final button');
    const wa = document.querySelector('.whatsapp-float');
    const style = getComputedStyle(wa);
    const targetY = innerHeight - parseFloat(style.bottom) - (parseFloat(style.height) || wa.offsetHeight) / 2 + delta;
    const absoluteCenter = scrollY + button.getBoundingClientRect().top + button.offsetHeight / 2;
    scrollTo(0, absoluteCenter - targetY);
    const r = button.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const points = [r.left + 8, (r.left + r.right) / 2, r.right - 8].map((x) => {
      const hit = document.elementFromPoint(x, y);
      return { x, y, visible: x >= 0 && x < innerWidth && y >= 115 && y < innerHeight, ok: hit === button || button.contains(hit), waIntercepts: Boolean(hit?.closest(".whatsapp-float")), hit: hit?.tagName + "." + (typeof hit?.className === "string" ? hit.className : hit?.className?.baseVal || "") };
    });
    const data = { width: innerWidth, height: innerHeight, scrollY, delta, points,
      wa: { className: wa.className, display: getComputedStyle(wa).display, opacity: getComputedStyle(wa).opacity, pointerEvents: getComputedStyle(wa).pointerEvents },
      button: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } };
    if (pause) { debugger; }
    return data;
  }, { delta, pause });

  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [768, 1024], [1440, 900]]) {
    await prepare(width, height);
    // Returning from the footer tests the reverse direction, not just scrolling down.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(400);
    let immediate;
    if (!fixed && [375, 768].includes(width)) {
      const cdp = await page.createCDPSession(); await cdp.send("Debugger.enable");
      const paused = new Promise((resolve) => cdp.once("Debugger.paused", resolve));
      const pending = sample(0, true); await paused;
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      fs.writeFileSync(path.join(out, `whatsapp-${width}-immediate.png`), Buffer.from(shot.data, "base64"));
      await cdp.send("Debugger.resume"); immediate = await pending; await cdp.detach();
    } else immediate = await sample(0, false);
    result.hitTests.push({ phase: "footer-to-button-immediate", ...immediate });
    await sleep(300);
    const settled = await sample(0, false);
    result.hitTests.push({ phase: "settled", ...settled });
    if ([375, 768].includes(width)) await page.screenshot({ path: path.join(out, `whatsapp-${width}.png`) });
    if (fixed) {
      const help = await page.$('.checkout-secondary-actions a[href*="wa.me"]');
      assert(help, 'Ayuda de WhatsApp disponible dentro del flujo');
      assert(await help.evaluate((element) => element.getBoundingClientRect().height >= 44));
    }
    for (const delta of [-220, -140, -70, 0, 70, 0, -70, -140]) {
      const data = { phase: "scroll", ...await sample(delta, false) };
      result.hitTests.push(data);
      if (fixed) assert(data.points.filter((p) => p.visible).every((p) => p.ok), JSON.stringify(data));
      await sleep(25);
    }
    if (fixed) assert(immediate.points.filter((p) => p.visible).every((p) => p.ok), JSON.stringify(immediate));
    check(`${width}x${height}: centro y extremos interiores durante scroll en ambos sentidos`);
  }

  // One new guest COD order, via the real cart and checkout, then reload.
  await prepare(375, 667);
  await page.click("#consent-order_processing"); await page.click("#consent-terms");
  const countBefore = await ctx.Order.countDocuments(); assert.equal(countBefore, 0);
  if (fixed) {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
    const hit = await sample(0, false); const right = hit.points[2];
    assert(right.ok); await page.touchscreen.tap(right.x, right.y);
  } else await page.click('.checkout-final button');
  await page.waitForFunction(() => location.pathname === "/pedido/confirmacion", { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes("¡Gracias por tu compra!"), { timeout: 30000 });
  assert(created);
  const reference = created.orderNumber;
  assert(await page.$eval("body", (e, reference) => e.innerText.includes(reference), reference));
  const beforeReloadCount = await ctx.Order.countDocuments(); assert.equal(beforeReloadCount, 1);
  const finalUrl = page.url();
  const documentResponse = await fetch(finalUrl); assert.equal(documentResponse.status, 200);
  const reload = await page.reload({ waitUntil: "domcontentloaded" }); assert.equal(reload.status(), 200);
  await page.waitForFunction((reference) => document.body.innerText.includes(reference) && document.body.innerText.includes("¡Gracias por tu compra!"), {}, reference);
  const afterReloadCount = await ctx.Order.countDocuments(); assert.equal(afterReloadCount, 1);
  const order = await ctx.Order.findOne().lean();
  assert.equal(order.paymentMethod, "contra_entrega"); assert.equal(order.paymentStatus, "pendiente"); assert.equal(order.orderStatus, "pendiente");
  const access = await page.evaluate(() => { const data = JSON.parse(sessionStorage.getItem("dizor_order_access")); return { reference: data?.orderNumber, hasToken: Boolean(data?.token) }; });
  assert.equal(access.reference, reference); assert(access.hasToken);
  assert.equal(result.createRequests, 1);
  if (fixed) assert.equal(await page.$eval('.whatsapp-float', (e) => getComputedStyle(e).display), 'flex', 'El flotante vuelve al salir del checkout');
  await page.screenshot({ path: path.join(out, "confirmacion-reloaded.png"), fullPage: true });
  const unauthorized = await fixture.api("POST", "/api/checkout/orders/lookup", { body: { orderNumber: reference, accessToken: "invalid-test-token" } });
  assert.equal(unauthorized.status, 404);
  result.confirmation = { finalUrl, reference, documentStatus: documentResponse.status, reloadStatus: reload.status(), visibleReference: true,
    countBefore, beforeReloadCount, afterReloadCount, createRequests: result.createRequests, access, invalidTokenLookupStatus: unauthorized.status,
    order: { id: String(order._id), orderNumber: order.orderNumber, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus, carrier: order.carrier } };
  assert.deepEqual(result.checkout404s, []);
  check("Contraentrega: carrito → confirmación visible, documento HTTP 200, reload 200 y un solo pedido; token de invitado conservado");
  result.firstFailingCheckoutRequest = result.http.find((entry) => entry.status >= 400) || null;
  result.passed = true;
  fs.writeFileSync(path.join(out, "evidence.json"), JSON.stringify(result, null, 2));
};
