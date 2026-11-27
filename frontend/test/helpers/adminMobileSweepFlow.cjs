"use strict";
// Full mobile sweep of the admin and seller panels on real Next + Express + MongoDB
// (section-picker-next-browser.cjs with DIZOR_NEXT_FLOW). For every route at 390 and 360 px:
// no horizontal overflow, every visible single <select> uses the customizable select
// (appearance: base-select, list drawn inside the page and anchored to its control), and
// a full-page capture at 390. Representative selects are opened and captured.
// DIZOR_CAPTURE_PREFIX names the captures. Fictitious data only.
const assert = require("node:assert/strict"), path = require("node:path");
const SpecialRequest = require("../../../backend/src/models/specialRequest");

module.exports = async function flow(t) {
  const { page, fixture, ctx, out, result, cookie, goto, check, sleep } = t;
  const prefix = process.env.DIZOR_CAPTURE_PREFIX || "barrido";
  const { product, variantId } = await fixture.makeProduct(6);
  const order = await fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, variantId) });
  const orderId = order.json?.order?._id || order.json?.order?.id || order.json?.orderId || (await ctx.Order.findOne().lean())?._id;
  const request = await SpecialRequest.create({ requestNumber: "MOV-001", type: "wholesale", status: "pendiente", contact: { name: "Taller ficticio", email: "taller@example.test", phone: "3000000000" }, estimatedQuantity: 12 });
  for (const [code, value] of [["IRACA10", 10], ["VUELTIAO15", 15]]) await fixture.api("POST", "/api/admin/coupons", { cookie: ctx.superCookie, body: { code, description: `Cupón ficticio ${code}`, type: "percentage", value } });
  const pid = String(product._id || product.id), vid = String(variantId);

  const routes = [
    ["superadmin", "inicio", "/admin", ""], ["superadmin", "alertas", "/admin/alertas", "Alertas"],
    ["superadmin", "pedidos", "/admin/pedidos", "Pedidos"], ["superadmin", "pedido", `/admin/pedidos/${orderId}`, ""],
    ["superadmin", "productos", "/admin/productos", "Productos"], ["superadmin", "existencias", `/admin/productos?view=stock&productId=${pid}&variantId=${vid}`, "Existencias"],
    ["superadmin", "movimientos", "/admin/productos?view=movements", "Movimientos"], ["superadmin", "producto-nuevo", "/admin/productos/nuevo", "Información general"],
    ["superadmin", "producto-editar", `/admin/productos/${pid}/editar`, "Información general"], ["superadmin", "catalogo", "/admin/catalogo", ""],
    ["superadmin", "solicitudes", "/admin/solicitudes", "MOV-001"], ["superadmin", "solicitud", `/admin/solicitudes/${request.id}`, "Taller ficticio"], ["superadmin", "pqr", "/admin/pqr", "PQR"],
    ...["home", "imagenes", "banners", "pages", "resenas", "appearance"].map((tab) => ["superadmin", `tienda-${tab}`, `/admin/contenido?tab=${tab}`, "Tienda online"]),
    ...["popup", "newsletter", "carritos"].map((tab) => ["superadmin", `marketing-${tab}`, `/admin/marketing?tab=${tab}`, "Marketing"]),
    ["superadmin", "exportaciones", "/admin/marketing?tab=exports", "Exportaciones"], ["superadmin", "cupones", "/admin/cupones", "IRACA10"],
    ["superadmin", "finanzas-panel", "/admin/finanzas", "Finanzas"], ["superadmin", "finanzas-costos", "/admin/finanzas?tab=costos", "Finanzas"], ["superadmin", "finanzas-historial", "/admin/finanzas?tab=historial", "Finanzas"],
    ["superadmin", "configuracion", "/admin/configuracion", "Configuración de tienda"], ["superadmin", "usuarios", "/admin/usuarios", "Usuarios del equipo"], ["superadmin", "auditoria", "/admin/auditoria", "Historial de auditoría"],
    ["vendedor", "vendedor-inicio", "/vendedor", ""], ["vendedor", "vendedor-pedidos", "/vendedor/pedidos", "Pedidos"], ["vendedor", "vendedor-pedido", `/vendedor/pedidos/${orderId}`, ""], ["vendedor", "vendedor-solicitudes", "/admin/solicitudes", "MOV-001"],
  ];
  const audit = () => page.evaluate(() => {
    const selects = [...document.querySelectorAll("main select:not([multiple]):not([size])")].filter((s) => s.getClientRects().length);
    const offenders = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest("[style*='overflow'], .finance-period-tabs, .fn-chips, .admin-table-wrap, .op-trays"); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`);
    // Section menus must use one row on phones (segmented control) or be replaced by the picker.
    const menus = [...document.querySelectorAll("main :is(.admin-context-nav, .cms-tabs, .fn-tabs, .taxonomy-tabs)")].filter((n) => n.getClientRects().length);
    const multiRow = menus.filter((n) => { const tops = [...n.children].filter((c) => c.getClientRects().length).map((c) => Math.round(c.getBoundingClientRect().top)); return new Set(tops).size > 1; }).map((n) => n.getAttribute("aria-label") || n.className);
    const pickers = [...document.querySelectorAll("main .sp")].filter((n) => n.getClientRects().length).map((n) => n.querySelector(".sp__label")?.textContent);
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, selects: selects.length, native: selects.filter((s) => getComputedStyle(s).appearance !== "base-select").map((s) => s.id || s.name || s.getAttribute("aria-label")), offenders, multiRow, pickers, height: document.documentElement.scrollHeight };
  });
  let role = null; const issues = []; result.issues = issues;
  for (const [w, h] of [[390, 844], [360, 800]]) {
    await page.setViewport({ width: w, height: h });
    for (const [who, name, url, wait] of routes) {
      if (who !== role) { await cookie(who); role = who; }
      await goto(url, wait); await sleep(600);
      const a = await audit();
      result.measurements.push({ name: `${name}-${w}`, ...a });
      if (a.overflow) issues.push(`${name} ${w}: desborde horizontal ${JSON.stringify(a.offenders)}`);
      if (a.native.length) issues.push(`${name} ${w}: selectores sin el estilo del panel ${JSON.stringify(a.native)}`);
      if (a.multiRow.length) issues.push(`${name} ${w}: menú de secciones en varias filas ${JSON.stringify(a.multiRow)}`);
      if (/^(catalogo|tienda-)/.test(name) && !a.pickers.length) issues.push(`${name} ${w}: falta el selector de sección`);
      if (w === 390) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(out, `${prefix}-${name}.png`), fullPage: true }); result.screenshots.push(`${prefix}-${name}.png`); }
    }
  }
  assert.deepEqual(issues, [], "barrido móvil");
  const selects = result.measurements.reduce((n, m) => n + (m.name.endsWith("-390") ? m.selects : 0), 0);
  check("B01", `${routes.length} rutas del panel (admin y vendedor) a 390 y 360 px sin desborde horizontal`);
  check("B02", `${selects} selectores visibles a 390 px, todos con el selector del panel (lista dentro de la página)`);
  check("B04", "menús de sección en una sola fila o con el selector compartido (Productos, Pedidos, Catálogo, Tienda online)");

  // Open representative selects: the list must be drawn in the page, as wide as the control.
  await cookie("superadmin"); await page.setViewport({ width: 390, height: 844 });
  const openSelect = async (url, wait, selector, name, before) => {
    await goto(url, wait); await sleep(500); if (before) await before();
    const handle = await page.waitForSelector(selector, { visible: true }); await handle.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await handle.click(); await sleep(250);
    const open = await handle.evaluate((e) => e.matches(":open"));
    assert.equal(open, true, `${name}: la lista se abre`);
    await page.screenshot({ path: path.join(out, `${prefix}-select-${name}.png`) }); result.screenshots.push(`${prefix}-select-${name}.png`);
    await page.keyboard.press("Escape"); await sleep(150);
    assert.equal(await handle.evaluate((e) => e.matches(":open")), false, `${name}: Escape cierra`);
  };
  await openSelect(`/admin/productos?view=stock&productId=${pid}&variantId=${vid}`, "Existencias", 'section[aria-label^="Ajustar"] select', "ajuste-existencias", async () => {
    const button = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Ajustar existencias") && b.getClientRects().length));
    await button.asElement().click(); await page.waitForSelector('section[aria-label^="Ajustar"]');
  });
  await openSelect("/admin/productos/nuevo", "Información general", "#category", "categoria-producto");
  await openSelect("/admin/cupones", "IRACA10", "#type", "tipo-cupon", async () => { await page.click('button[aria-controls="mk-coupon-form"]'); await page.waitForSelector("#type", { visible: true }); });
  await openSelect("/admin/auditoria", "Historial de auditoría", "#cf-audit-module", "modulo-auditoria", async () => { await page.click("#cf-audit-filters-toggle"); });
  check("B03", "selectores abiertos (ajuste de existencias, categoría, tipo de cupón, módulo de auditoría): lista dentro de la página y Escape la cierra");
};
