"use strict";
// Mobile section/tray picker (AdminSectionPicker) in Productos, Existencias, Configuración del
// catálogo and Pedidos (admin and seller), plus the Productos top bar colour. Real Next + Express
// + MongoDB (section-picker-next-browser.cjs). Fictitious data only.
const assert = require("node:assert/strict"), path = require("node:path");

module.exports = async function flow(t) {
  const { page, fixture, out, result, cookie, text, goto, check, sleep } = t;
  await fixture.makeProduct(5);
  const vp = (width, height) => page.setViewport({ width, height });
  const shot = async (name) => { await page.screenshot({ path: path.join(out, name + ".png") }); result.screenshots.push(name + ".png"); };
  const state = (scope) => page.evaluate((scope) => {
    const root = document.querySelector(scope), panel = root?.querySelector(".sp__panel"), r = panel?.getBoundingClientRect();
    return { visible: !!root && root.getClientRects().length > 0, expanded: root?.querySelector(".sp__button").getAttribute("aria-expanded"),
      current: root?.querySelector(".sp__current")?.textContent, panel: r && panel.getClientRects().length ? { left: r.left, right: r.right, bottom: r.bottom } : null,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, width: innerWidth, tabs: [...document.querySelectorAll(".op-trays")].some((n) => n.getClientRects().length > 0) };
  }, scope);
  const topbar = () => page.$eval(".admin-topbar", (e) => ({ bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e.querySelector(".admin-location [aria-current], .admin-location span:last-child") || e).color }));

  const pages = [
    ["admin", "/admin/productos", ".op-section-select", "Productos", "Existencias", "view=stock", "productos"],
    ["admin", "/admin/productos?view=stock", ".op-section-select", "Existencias", "Movimientos", "view=movements", "existencias"],
    ["admin", "/admin/pedidos", ".op-tray-select", "Todos", "Por preparar", "tray=prepare", "pedidos"],
    ["vendedor", "/vendedor/pedidos", ".op-tray-select", "Todos", "Por preparar", "tray=prepare", "pedidos-vendedor"],
  ];
  for (const [w, h] of [[390, 844], [360, 800]]) {
    await vp(w, h);
    for (const [role, url, scope, current, target, param, name] of pages) {
      await cookie(role); await goto(url, current); await page.waitForSelector(scope);
      let s = await state(scope);
      assert.equal(s.visible, true, `${name} ${w}: selector visible`); assert.equal(s.tabs, false, `${name} ${w}: pestañas de escritorio ocultas`);
      assert.equal(s.current, current, `${name} ${w}: sección actual`); assert.equal(s.expanded, "false"); assert.equal(s.overflow, false, `${name} ${w}`);
      await page.click(`${scope} .sp__button`); s = await state(scope);
      assert.equal(s.expanded, "true"); assert.ok(s.panel && s.panel.left >= 0 && s.panel.right <= s.width, `${name} ${w}: panel dentro de la pantalla ${JSON.stringify(s.panel)}`);
      assert.equal(s.overflow, false, `${name} ${w}: sin desborde con el panel abierto`);
      if (w === 390) { await sleep(300); await shot(`${name}-abierto-${w}`); }
      // Keyboard: Escape closes and returns focus; ArrowDown walks the options.
      await page.keyboard.press("Escape"); assert.equal((await state(scope)).expanded, "false");
      assert.equal(await page.evaluate((scope) => document.activeElement === document.querySelector(`${scope} .sp__button`), scope), true);
      await page.keyboard.press("Enter"); assert.equal((await state(scope)).expanded, "true");
      await page.keyboard.press("Tab"); await page.keyboard.press("ArrowDown");
      assert.ok(await page.evaluate((scope) => document.activeElement.classList.contains("sp__option") && document.querySelector(scope).contains(document.activeElement), scope));
      const title = await page.$eval("main h1", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; }); await page.mouse.click(title.x, title.y); await sleep(80); assert.equal((await state(scope)).expanded, "false", "clic fuera cierra");
      // Navigation by link: URL and current section update.
      await page.click(`${scope} .sp__button`);
      await page.waitForSelector(`${scope} .sp__panel:not([hidden])`); const option = await page.evaluateHandle((scope, target) => [...document.querySelectorAll(`${scope} .sp__option`)].find((a) => a.querySelector(".sp__option-label").textContent === target), scope, target); await option.asElement().click();
      await page.waitForFunction((param) => location.search.includes(param), {}, param); await text(target);
      await page.waitForFunction((scope, target) => document.querySelector(`${scope} .sp__current`)?.textContent === target, {}, scope, target);
      result.measurements.push({ name: `${name}-${w}`, ok: true });
    }
  }
  check("M01", "selector de sección/bandeja: visible solo en móvil, panel dentro de la pantalla a 390 y 360, sin desbordes");
  check("M02", "selector operable con teclado (Enter, flechas, Escape con retorno de foco) y clic fuera");
  check("M03", "cada opción es un enlace: cambia la URL y la sección actual (Productos, Existencias, Pedidos admin y vendedor)");

  // Configuración del catálogo is reached from the picker in Productos.
  await vp(390, 844); await cookie("admin"); await goto("/admin/productos", "Productos");
  await page.click(".op-section-select .sp__button");
  await page.evaluate(() => [...document.querySelectorAll(".op-section-select .sp__option")].find((a) => a.textContent.includes("Configuración del catálogo")).click());
  await page.waitForFunction(() => location.pathname === "/admin/catalogo");
  check("M04", "«Configuración del catálogo» abre /admin/catalogo desde el selector");

  // Top bar: graphite with white text on phones in Productos and Catálogo, like the rest of the panel.
  for (const url of ["/admin/productos", "/admin/catalogo", "/admin/pedidos"]) {
    await goto(url, ""); await page.waitForSelector(".admin-topbar"); await sleep(150);
    const bar = await topbar();
    assert.equal(bar.bg, "rgb(37, 39, 37)", `${url}: barra grafito (${bar.bg})`); assert.equal(bar.color, "rgb(255, 255, 255)", `${url}: texto blanco (${bar.color})`);
  }
  await goto("/admin/productos", "Productos"); await shot("productos-barra-390");
  check("M05", "barra superior grafito con texto blanco en Productos, Catálogo y Pedidos (390 px)");
};
