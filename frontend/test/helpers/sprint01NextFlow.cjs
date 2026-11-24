"use strict";
// Sprint 01 flow on real Next (production build) + real Express + ephemeral MongoDB.
// Data are fictitious and inserted only in the temporary database of this run.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
module.exports = async ({ page, fixture, ctx, origin, out, result, cookie, text, goto, check, sleep }) => {
  const { Order, Product, mongoose } = ctx;
  fs.mkdirSync(out, { recursive: true });
  // The harness enables interception; loopback continues, any external destination is blocked and recorded.
  page.on("request", (r) => { const u = new URL(r.url()); if (!["127.0.0.1", "localhost"].includes(u.hostname) && !["data:", "blob:"].includes(u.protocol)) { result.externalRequests.push(u.origin + u.pathname); r.abort(); } else r.continue(); });
  // ── Fictitious catalogue and 34 days of orders ────────────────────────────
  const names = ["Sombrero Aguadeño clásico", "Sombrero Fedora iraca natural", "Bolso tejido Sandoná", "Sombrero Panamá fino", "Cartera de mano en iraca", "Sombrero playero ala ancha", "Llavero mini sombrero", "Individuales tejidos (juego de 4)"];
  const stocks = [14, 0, 3, 22, 9, 2, 40, 11], products = [];
  for (let i = 0; i < names.length; i++) { const { product } = await fixture.makeProduct(stocks[i], [189000, 245000, 156000, 312000, 98000, 135000, 18000, 76000][i]); products.push(product); }
  for (let i = 0; i < products.length; i++) await Product.collection.updateOne({ _id: products[i]._id }, { $set: { name: names[i], slug: `s01-${i}` }, $unset: { mainImage: "", images: "" } });
  await Product.collection.updateOne({ _id: products[3]._id }, { $push: { variants: { _id: new mongoose.Types.ObjectId(), sku: "PAN-FINO-L", stock: 1, isActive: true } } });
  const day = 86400000, now = Date.now(), rnd = (i) => (i * 9301 + 49297) % 233280 / 233280;
  const plan = (i) => { const r = rnd(i);
    if (r < 0.62) return { orderStatus: ["entregado", "enviado", "en_preparacion", "pagado"][i % 4], paymentStatus: "pagado", paymentMethod: i % 3 ? "wompi" : "contra_entrega" };
    if (r < 0.74) return { orderStatus: "pendiente", paymentStatus: "pendiente", paymentMethod: "contra_entrega" };
    if (r < 0.84) return { orderStatus: "pago_pendiente", paymentStatus: "pendiente", paymentMethod: "wompi" };
    if (r < 0.93) return { orderStatus: "cancelado", paymentStatus: "rechazado", paymentMethod: "wompi" };
    return { orderStatus: "entregado", paymentStatus: "pendiente", paymentMethod: "contra_entrega" }; };
  const docs = [];
  for (let i = 0; i < 70; i++) {
    const p = products[Math.floor(rnd(i + 7) * 7)], q = 1 + (i % 3 === 0 ? 1 : 0), unit = [189000, 245000, 156000, 312000, 98000, 135000, 18000, 76000][products.indexOf(p)];
    const createdAt = new Date(now - Math.floor(rnd(i + 3) * 34 * day) - (i % 5) * 3600000);
    docs.push({ orderNumber: `DIZ-${new Date(+createdAt - 5 * 3600000).toISOString().slice(0, 10).replace(/-/g, "")}-${(i * 7919 + 104729).toString(16).toUpperCase().padStart(20, "A")}`,
      buyer: { name: ["María Fernanda Ortiz", "Juan Camilo Rosero", "Laura Benavides", "Andrés Guerrero", "Daniela Cabrera", "Santiago Insuasty"][i % 6], email: `s01-${i}@example.test`, phone: "3000000000" },
      items: [{ _id: new mongoose.Types.ObjectId(), product: p._id, variantId: p.variants[0]._id, productName: names[products.indexOf(p)], quantity: q, unitPrice: unit, lineTotal: unit * q, sku: p.variants[0].sku }],
      subtotal: unit * q, total: unit * q, ...plan(i), stockDeducted: true, checkoutState: "ready", requiresReview: i === 5, incidents: i === 5 ? [{ code: "payment_amount_or_currency_mismatch", resolvedAt: null }] : [],
      statusHistory: [], createdAt, updatedAt: createdAt, source: "web" });
  }
  await Order.collection.insertMany(docs);
  check("S01-N0 datos ficticios: 8 productos, 70 pedidos en 34 días, estados mixtos");
  const shots = async (name, url, ready) => { for (const width of [1440, 1024, 820, 390, 360]) { await page.setViewport({ width, height: 900 }); await goto(url, ready); await sleep(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(overflow, false, `${name} ${width}`);
    await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true }); } check(`${name}: capturas reales en cinco anchos sin desbordamiento`); };
  const fetchApi = (p) => page.evaluate(async (u) => { const r = await fetch(u, { credentials: "include" }); return { status: r.status, body: r.status === 200 ? await r.json() : null }; }, `${ctx.base}/api${p}`);

  // ── Superadministrador: datos reales del backend en pantalla ───────────────
  await cookie("superadmin");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin", "Ventas conciliadas");
  const api = await fetchApi("/admin/dashboard/analytics?period=30d"); assert.equal(api.status, 200);
  const a = api.body.analytics, cop = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  const kpis = await page.$$eval(".dz-kpis .dz-metric__value", (e) => e.map((x) => x.textContent.trim()));
  const plain = (s) => s.replace(/\s/g, " ");
  assert.deepEqual(kpis.map(plain), [cop(a.sales.reconciledSales), new Intl.NumberFormat("es-CO").format(a.sales.ordersRegistered), a.sales.averageTicket == null ? "Sin ventas conciliadas" : cop(a.sales.averageTicket), new Intl.NumberFormat("es-CO").format(a.sales.unitsSold)].map(plain));
  assert.ok(a.sales.reconciledSales > 0 && a.products.top.length > 0 && a.inventory.outVariants >= 1);
  const fin = await fetchApi(`/admin/finance/report?from=${a.period.from}&to=${a.period.to}`); assert.equal(fin.status, 200);
  assert.equal(fin.body.sales.totalCollected, a.sales.reconciledSales); assert.equal(fin.body.sales.ordersCount, a.sales.reconciledOrders);
  check("S01-N1 indicadores en pantalla = API analítica = reporte de Finanzas (mismo rango)");
  result.analyticsSample = { period: a.period, sales: a.sales, top: a.products.top.map((p) => [p.name, p.units, p.sales]), inventory: { out: a.inventory.outVariants, low: a.inventory.lowVariants, review: a.inventory.reviewVariants } };
  await shots("inicio", "/admin?periodo=30d", "Ventas conciliadas");
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin?periodo=7d", "Últimos 7 días"); await page.screenshot({ path: path.join(out, "inicio-7d-1440.png"), fullPage: true });
  await goto("/admin?periodo=hoy", "Hoy ·"); await page.screenshot({ path: path.join(out, "inicio-hoy-1440.png"), fullPage: true });
  await goto("/admin?periodo=personalizado&desde=2024-01-01&hasta=2024-12-31", "Rango personalizado"); await text("Sin ventas conciliadas"); await page.screenshot({ path: path.join(out, "inicio-sin-datos-1440.png"), fullPage: true });
  check("S01-N2 periodos hoy/7 días/rango sin datos con agrupación y estado vacío reales");
  await shots("alertas", "/admin/alertas", "Centro de alertas");
  check("S01-N3 centro de alertas con datos reales");

  // ── Teclado: enlace de salto, foco y periodo por URL ───────────────────────
  await page.setViewport({ width: 1440, height: 900 }); await goto("/admin", "Requieren atención");
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(); return { cls: e.className, top: r.top, visible: r.bottom > 0 && r.top < innerHeight }; });
  assert.equal(skip.cls, "admin-skip-link"); assert.ok(skip.visible, "El enlace de salto se muestra al recibir foco");
  await page.keyboard.press("Enter"); await sleep(150);
  assert.equal(await page.evaluate(() => document.activeElement.id || document.activeElement.closest("#admin-workspace")?.id), "admin-workspace");
  const hiddenSkip = await page.evaluate(() => { document.activeElement.blur(); const r = document.querySelector(".admin-skip-link").getBoundingClientRect(); return r.bottom <= 0; });
  assert.ok(hiddenSkip, "Sin foco no ocupa espacio visible");
  check("S01-N4 'Ir al contenido' aparece con foco, lleva al contenido y no ocupa espacio en reposo");

  // ── Texto al 200 % y axe ───────────────────────────────────────────────────
  for (const [url, ready, name] of [["/admin", "Ventas conciliadas", "inicio"], ["/admin/alertas", "Centro de alertas", "alertas"]]) {
    for (const width of [1280, 390]) {
      await page.setViewport({ width, height: 900 }); await goto(url, ready); await page.addStyleTag({ content: "html{font-size:200% !important}" }); await sleep(500);
      const audit = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, offenders: [...document.querySelectorAll("main .dz-page *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 5).map((e) => e.className) }));
      result.textZoom = [...(result.textZoom || []), { name, width, ...audit }];
      await page.screenshot({ path: path.join(out, `${name}-texto200-${width}.png`), fullPage: false });
    }
  }
  assert.deepEqual(result.textZoom.filter((z) => z.overflow || z.offenders.length), [], "Texto al 200 % sin desbordamiento en el contenido rediseñado");
  check("S01-N5 texto al 200 % en 1280 y 390 px sin desbordamiento del contenido");
  result.axe = [];
  for (const [url, ready, name] of [["/admin", "Ventas conciliadas", "inicio"], ["/admin/alertas", "Centro de alertas", "alertas"]]) for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 900 }); await goto(url, ready); await sleep(300);
    if (!await page.evaluate(() => !!globalThis.axe)) await page.addScriptTag({ content: fs.readFileSync(require.resolve("../../node_modules/axe-core/axe.min.js"), "utf8") });
    const r = await page.evaluate(async () => { const x = await globalThis.axe.run(document.querySelector(".admin-shell"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return { violations: x.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) })), passes: x.passes.length }; });
    result.axe.push({ name, width, ...r });
  }
  fs.writeFileSync(path.join(out, "axe-sprint01.json"), JSON.stringify(result.axe, null, 2));
  const dzViolations = result.axe.flatMap((x) => x.violations.filter((v) => v.nodes.some((n) => /dz-|admin-workspace|main/.test(n))));
  assert.deepEqual(dzViolations, [], "Sin violaciones axe en el contenido rediseñado");
  check("S01-N6 axe WCAG 2.2 AA sin violaciones en Inicio y Centro de alertas (1440 y 390)");

  // ── Roles ──────────────────────────────────────────────────────────────────
  await cookie("admin"); await page.setViewport({ width: 1440, height: 900 }); await goto("/admin", "Ventas conciliadas");
  assert.equal((await fetchApi("/admin/finance/report")).status, 403, "Administrador sigue sin Finanzas");
  check("S01-N7 administrador ve ventas conciliadas (ya visibles antes en Inicio) pero no Finanzas ni costos");
  await cookie("vendedor"); await goto("/vendedor", "Panel vendedor"); await text("Listos para preparar");
  assert.ok(await page.evaluate(() => !/Ventas conciliadas|Ticket promedio|Unidades vendidas/.test(document.body.innerText)));
  assert.equal((await fetchApi("/admin/dashboard/analytics")).status, 403);
  await page.screenshot({ path: path.join(out, "vendedor-1440.png"), fullPage: true }); await page.setViewport({ width: 390, height: 900 }); await goto("/vendedor", "Panel vendedor"); await page.screenshot({ path: path.join(out, "vendedor-390.png"), fullPage: true });
  check("S01-N8 vendedor sin indicadores comerciales; la API responde 403");
  assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.hydrationErrors, []); assert.deepEqual(result.externalRequests, []);
  result.passed = true;
};
