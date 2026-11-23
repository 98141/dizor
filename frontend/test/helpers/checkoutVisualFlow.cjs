"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");

module.exports = async ({ page, fixture, ctx, origin, out, result, goto, check, sleep }) => {
  const before = result.mode === "before";
  const { product, variantId } = await fixture.makeProduct(50, 180000);
  await ctx.Product.updateOne({ _id: product._id }, { $set: { name: "Sombrero de iraca Sandoná", mainImage: "/favicon-dizor.png" } });
  await ctx.mongoose.model("Category").updateMany({}, { $set: { name: "Sombreros", slug: "sombreros" } });
  await ctx.mongoose.model("Size").updateMany({}, { $set: { name: "Única" } });
  await ctx.mongoose.model("Color").updateMany({}, { $set: { name: "Natural" } });
  await require("../../../backend/src/models/marketingSettings").findOneAndUpdate({ key: "default" }, { $set: { "popup.enabled": false } }, { upsert: true });
  const item = { productId: String(product._id), variantId: String(variantId), quantity: 1, unitPrice: 180000,
    productName: "Sombrero de iraca Sandoná", sizeName: "Única", colorName: "Natural" };
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (["127.0.0.1", "localhost"].includes(u.hostname) || req.url().startsWith("data:")) return req.continue();
    result.externalRequests.push(u.origin + u.pathname); req.abort();
  });
  await page.evaluateOnNewDocument((item, origin) => { if (location.origin === origin) localStorage.setItem("dizor_cart_v1", JSON.stringify([item])); }, item, origin);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const fill = async (id, value) => { await page.click(id); await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control"); await page.type(id, value); };
  const scroll = async (selector, top) => { await page.$eval(selector, (e, top) => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - top), top); await sleep(120); };
  const prepare = async (width, height) => {
    await page.setViewport({ width, height, hasTouch: true });
    await goto("/checkout", "Datos de contacto");
    await page.waitForSelector('.checkout-layout button[type="submit"]:not(:disabled)');
    const reject = await page.$eval("body", (body) => [...body.querySelectorAll("button")].some((b) => b.textContent.trim() === "Rechazar"));
    if (reject) await page.locator(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Rechazar")).click();
    for (const [id, value] of Object.entries({ name: "María Martínez", email: "maria@example.test", phone: "3000000000", address: "Calle de prueba 10" })) await fill("#" + id, value);
    await fill("#municipality", "sandona"); await page.click("#municipality-option-52683");
    await page.waitForSelector('.checkout-layout button[type="submit"]:not(:disabled)');
    await page.evaluate(() => scrollTo(0, 0)); await sleep(120);
  };
  const snapshot = async (name, fullPage = false) => page.screenshot({ path: path.join(out, name + ".png"), fullPage });
  const measure = () => page.evaluate(() => {
    const rect = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const headers = [...document.querySelectorAll(".site-header, .site-header-compact")].filter((e) => getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().bottom > 0).map(rect);
    const wa = document.querySelector(".whatsapp-float"), waRect = wa && rect(wa), waVisible = wa && getComputedStyle(wa).opacity !== "0" && getComputedStyle(wa).display !== "none";
    const targets = [...document.querySelectorAll(".checkout-layout .auth-field__input, .checkout-payment-option, .checkout-consents label, .checkout-total, .checkout-final button")].map((e) => ({ id: e.id || e.className, ...rect(e) }));
    return { scroll: scrollY, width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, headers,
      wa: { visible: Boolean(waVisible), rect: waRect }, waOverlaps: waVisible ? targets.filter((r) => hit(r, waRect) && r.bottom > 0 && r.top < innerHeight) : [] };
  });
  result.visualMeasurements = [];
  for (const [width, height] of [[1440, 1000], [375, 667]]) {
    await prepare(width, height);
    await snapshot(`checkout-${width}-top`);
    await snapshot(`checkout-${width}-full`, true);
    await scroll("#municipality", 180);
    await fill("#municipality", "sandona"); await sleep(120);
    await snapshot(`checkout-${width}-suggestions`);
    assert.equal(await page.$eval("#municipality-option-52683", (e) => e.textContent.trim()), "Sandoná — Nariño");
    await page.click("#municipality-option-52683");
    await page.waitForSelector('.checkout-layout button[type="submit"]:not(:disabled)');
    // Comparable closing position: total near the upper third of the viewport.
    await scroll(".checkout-total", width < 800 ? 240 : 300);
    await snapshot(`checkout-${width}-total`);
    result.visualMeasurements.push({ width, position: "total", ...await measure() });
    // Intentionally align the checkout button with the floating contact button.
    await page.$eval('.checkout-final button', (e) => scrollTo(0, e.getBoundingClientRect().bottom + scrollY - (innerHeight - 25)));
    await sleep(160);
    await snapshot(`checkout-${width}-wa-check`);
    const collision = { width, position: "wa-check", ...await measure() };
    result.visualMeasurements.push(collision);
    if (!before) assert.equal(collision.waOverlaps.length, 0, JSON.stringify(collision));
    if (!before) {
      const styles = await page.evaluate(() => {
        const card = document.querySelector('.checkout-card');
        const input = document.querySelector('#municipality');
        const payment = document.querySelector('.checkout-payment-option--active');
        const total = document.querySelector('.checkout-total');
        const main = document.querySelector('.checkout-final button');
        return { cardRadius: getComputedStyle(card).borderRadius, fieldRadius: getComputedStyle(input).borderRadius,
          fieldHeight: input.getBoundingClientRect().height, buttonHeight: main.getBoundingClientRect().height,
          checked: Boolean(payment.querySelector('input:checked')), totalBackground: getComputedStyle(total).backgroundColor,
          cardBackground: getComputedStyle(card).backgroundColor, summaryPosition: getComputedStyle(document.querySelector('.checkout-summary')).position };
      });
      assert.equal(styles.cardRadius, '16px'); assert.equal(styles.fieldRadius, '10px');
      assert(styles.fieldHeight >= 44 && styles.buttonHeight >= 44, JSON.stringify(styles));
      assert(styles.checked); assert.notEqual(styles.totalBackground, styles.cardBackground);
      assert.equal(styles.summaryPosition, 'static');
    }
    // Scroll the actual viewport, checking where the navigation is painted.
    for (const selector of ["#name", "#municipality", ".checkout-consents", ".checkout-total"]) {
      await scroll(selector, 180);
      const data = { width, position: selector, ...await measure() };
      result.visualMeasurements.push(data);
      assert(data.headers.every((header) => header.top <= 1), JSON.stringify(data));
      if (!before) assert.equal(data.waOverlaps.length, 0, JSON.stringify(data));
    }
    check(`${width}px: capturas comparables y navegación real al desplazar campos/autorizaciones/total`);
  }
  if (!before) {
    for (const [width, height] of [[320, 568], [375, 320], [1440, 550]]) {
      await prepare(width, height);
      await scroll("#municipality", width < 800 ? 125 : 160);
      await fill("#municipality", "san"); await sleep(180);
      const bounds = await page.evaluate(() => {
        const list = document.querySelector(".municipality-combobox__list").getBoundingClientRect();
        const input = document.querySelector("#municipality").getBoundingClientRect();
        return { list: { top: list.top, bottom: list.bottom, left: list.left, right: list.right }, input: { top: input.top, bottom: input.bottom }, viewport: innerHeight, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(bounds.overflow, false, JSON.stringify(bounds));
      assert(bounds.list.right <= width && bounds.list.left >= 0, JSON.stringify(bounds));
      assert(bounds.list.bottom <= height + 1, JSON.stringify(bounds));
      assert(bounds.list.top >= bounds.input.bottom, JSON.stringify(bounds));
      await fill("#municipality", "archipielago"); await sleep(100);
      await snapshot(`checkout-${width}x${height}-long-name`);
      // Search by municipality yields the very long department name.
      await fill("#municipality", "providencia"); await sleep(100);
      await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
      assert((await page.$eval("#municipality", (e) => e.value)).includes("Providencia"));
      check(`${width}x${height}: sugerencias largas, viewport corto y elección con teclado`);
    }
    await prepare(375, 667);
    // Click the edge of each payment label, not its radio or text.
    const label = await page.$('.checkout-payment-option:has(input[value="wompi"])');
    await label.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(120);
    const box = await label.boundingBox(); await page.mouse.click(box.x + box.width - 8, box.y + 8);
    assert(await page.$eval('input[value="wompi"]', (e) => e.checked));
    await page.click('label.checkout-payment-option:has(input[value="contra_entrega"])');
    await page.click("#consent-order_processing"); await page.click("#consent-terms");
    await page.evaluate(() => { const form = document.querySelector(".checkout-layout"); form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => location.pathname.includes("confirmacion"));
    assert.equal(await ctx.Order.countDocuments(), 1);
    const order = await ctx.Order.findOne();
    assert.equal(order.carrier, ""); assert.equal(order.shippingAddress.city, "Sandoná");
    assert.equal(order.paymentStatus, "pendiente");
    check("Tarjeta completa seleccionable, autorizaciones intactas y doble envío crea una sola compra");
  }
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.hydrationErrors, []);
  assert.deepEqual(result.externalRequests, []);
  result.passed = true;
  fs.writeFileSync(path.join(out, "visual.json"), JSON.stringify(result, null, 2));
};
