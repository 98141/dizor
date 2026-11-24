"use strict";
// Sprint 01 · read-only commercial analytics of the admin home.
// Real Express app + ephemeral MongoDB replica set from the shared fixture. Orders are fictitious
// and inserted with explicit dates/states to probe the criteria; nothing reaches a real provider.
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const fixture = require("./helpers/phase2Fixture.cjs");
const Notification = require("../src/models/notification"), Adjustment = require("../src/models/stockAdjustment");
const { variantStatus } = require("../src/services/inventoryCriteria");
const { financePeriodKey } = require("../src/utils/financePeriod");
const analytics = require("../src/services/dashboardAnalytics");
const ctx = () => fixture.context, api = (...a) => fixture.api(...a);
const get = (query = "", cookie = ctx().adminCookie) => api("GET", `/api/admin/dashboard/analytics${query}`, { cookie });
let seq = 0;
const order = (over = {}) => {
  const items = over.items || [{ product: over.product?._id || new (ctx().mongoose.Types.ObjectId)(), variantId: new (ctx().mongoose.Types.ObjectId)(), productName: over.product?.name || "Producto histórico", quantity: 1, unitPrice: 100000, lineTotal: 100000 }];
  const doc = { orderNumber: `DIZ-S01-${++seq}-${crypto.randomBytes(4).toString("hex")}`, buyer: { name: "Cliente ficticio", phone: "3000000000", email: "s01@example.test" },
    items, subtotal: 0, total: 100000, paymentMethod: "wompi", paymentStatus: "pagado", orderStatus: "pagado", stockDeducted: true, checkoutState: "ready",
    requiresReview: false, incidents: [], statusHistory: [], createdAt: new Date("2026-11-10T15:00:00Z"), updatedAt: new Date(), ...over };
  delete doc.product; return doc;
};
const insert = (...docs) => ctx().Order.collection.insertMany(docs.flat());
const line = (product, quantity, lineTotal, extra = {}) => ({ product: product._id, variantId: product.variants[0]._id, productName: product.name, quantity, unitPrice: lineTotal / quantity, lineTotal, ...extra });
const snapshot = async () => Promise.all([ctx().Order.find().sort({ _id: 1 }).lean(), ctx().Product.find().sort({ _id: 1 }).lean(), ctx().ProductHistory.find().lean(), Notification.find().lean(), Adjustment.find().lean()]);

test.before(async () => { await fixture.setup(); await Notification.init(); await Adjustment.init(); });
test.beforeEach(async () => { for (const m of [ctx().Order, ctx().Product, ctx().ProductHistory, Notification, Adjustment]) await m.deleteMany({}); });
test.after(async () => { try { assert.deepEqual(ctx().blocked, []); } finally { await fixture.close(); } });

test("S01 sólo administrador y superadministrador; vendedor, cliente y anónimo no reciben ventas ni costos", async () => {
  await fixture.makeProduct(3);
  for (const cookie of [ctx().adminCookie, ctx().superCookie]) { const r = await get("", cookie); assert.equal(r.status, 200, r.text); assert.ok(r.json.analytics.sales); assert.doesNotMatch(r.text, /internalCost|424242|"cost"|margin|profit|cogs/i); }
  assert.equal((await get("", ctx().vendorCookie)).status, 403);
  assert.equal((await get("", ctx().clientCookie)).status, 403);
  assert.equal((await api("GET", "/api/admin/dashboard/analytics")).status, 401);
});

test("S02 ventas, pedidos, ticket y unidades coinciden con el reporte de Finanzas para el mismo rango", async () => {
  const { product: a } = await fixture.makeProduct(10), { product: b } = await fixture.makeProduct(10);
  await insert(
    order({ total: 215000, items: [line(a, 2, 180000), line(b, 1, 25000)], createdAt: new Date("2026-11-03T14:00:00Z") }),
    order({ total: 98000, paymentMethod: "contra_entrega", orderStatus: "entregado", items: [line(b, 3, 90000)], createdAt: new Date("2026-11-05T22:00:00Z") }),
    order({ total: 310000, orderStatus: "enviado", items: [line(a, 1, 300000)], createdAt: new Date("2026-11-07T04:30:00Z") }),
    order({ total: 50000, orderStatus: "cancelado", paymentStatus: "pagado", createdAt: new Date("2026-11-04T15:00:00Z") }),
  );
  const r = await get("?period=custom&from=2026-11-01&to=2026-11-07"); assert.equal(r.status, 200, r.text);
  const f = await api("GET", "/api/admin/finance/report?from=2026-11-01&to=2026-11-07", { cookie: ctx().superCookie }); assert.equal(f.status, 200, f.text);
  const s = r.json.analytics.sales, fs = f.json.report?.sales || f.json.sales || f.json.data?.sales;
  assert.ok(fs, `Forma del reporte: ${Object.keys(f.json)}`);
  assert.equal(s.reconciledSales, fs.totalCollected); assert.equal(s.reconciledOrders, fs.ordersCount);
  assert.equal(s.unitsSold, fs.unitsSold); assert.equal(s.averageTicket, fs.averageOrderValue);
  assert.deepEqual([s.reconciledSales, s.reconciledOrders, s.unitsSold, s.averageTicket, s.ordersRegistered], [623000, 3, 7, 207667, 4]);
});

test("S03 excluye cancelados, devueltos, rechazados, reembolsados, pagos pendientes, revisión e incidencias activas", async () => {
  const at = new Date("2026-11-12T16:00:00Z");
  await insert(
    order({ total: 100000, createdAt: at }),
    order({ total: 700001, orderStatus: "cancelado", createdAt: at }),
    order({ total: 700002, orderStatus: "devuelto", createdAt: at }),
    order({ total: 700003, orderStatus: "rechazado", createdAt: at }),
    order({ total: 700004, paymentStatus: "reembolsado", createdAt: at }),
    order({ total: 700005, paymentStatus: "pendiente", orderStatus: "pago_pendiente", createdAt: at }),
    order({ total: 700006, requiresReview: true, createdAt: at }),
    order({ total: 700007, incidents: [{ code: "payment_amount_or_currency_mismatch", resolvedAt: null }], createdAt: at }),
    order({ total: 200000, incidents: [{ code: "coupon_reconciliation", resolvedAt: new Date("2026-11-13T00:00:00Z") }], createdAt: at }),
  );
  const s = (await get("?period=custom&from=2026-11-12&to=2026-11-12")).json.analytics.sales;
  assert.equal(s.reconciledSales, 300000); assert.equal(s.reconciledOrders, 2); assert.equal(s.ordersRegistered, 9);
});

test("S04 límites civiles de Colombia, independientes del huso del servidor", async () => {
  await insert(
    order({ total: 111111, createdAt: new Date("2026-11-20T04:59:59.999Z") }), // 19/11 23:59:59 Bogotá
    order({ total: 222222, createdAt: new Date("2026-11-20T05:00:00.000Z") }), // 20/11 00:00 Bogotá
    order({ total: 333333, createdAt: new Date("2026-11-21T04:59:59.999Z") }), // 20/11 23:59:59 Bogotá
    order({ total: 444444, createdAt: new Date("2026-11-21T05:00:00.000Z") }), // 21/11 00:00 Bogotá
  );
  const a = (await get("?period=custom&from=2026-11-20&to=2026-11-20")).json.analytics;
  assert.equal(a.sales.reconciledSales, 555555); assert.equal(a.period.granularity, "hour");
  assert.equal(a.period.start, "2026-11-20T05:00:00.000Z"); assert.equal(a.period.end, "2026-11-21T05:00:00.000Z");
  assert.equal(a.series.length, 24); assert.equal(a.series[0].key, "2026-11-20T00"); assert.equal(a.series[0].sales, 222222); assert.equal(a.series[23].key, "2026-11-20T23"); assert.equal(a.series[23].sales, 333333);
  const priorTZ = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    for (const tz of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
      process.env.TZ = tz;
      const p = analytics.resolvePeriod({ period: "custom", from: "2026-11-20", to: "2026-11-20" }, new Date("2026-11-24T12:00:00Z"));
      assert.deepEqual([p.start.toISOString(), analytics.bucketKey(new Date("2026-11-20T05:00:00Z"), "hour"), analytics.buckets(p)[23].key], ["2026-11-20T05:00:00.000Z", "2026-11-20T00", "2026-11-20T23"], tz);
    }
  } finally { process.env.TZ = priorTZ; }
  const today = analytics.resolvePeriod({ period: "today" }, new Date("2026-11-25T03:30:00Z")); // 24/11 22:30 Bogotá
  assert.equal(today.from, "2026-11-24"); assert.equal(analytics.buckets(today).length, 23);
});

test("S05 evolución: cubos diarios, semanales ISO y mensuales iguales al cálculo de Finanzas; huecos son ceros", async () => {
  const dates = ["2026-08-30T20:00:00Z", "2026-08-31T05:30:00Z", "2026-09-06T23:00:00Z", "2026-09-07T05:00:00Z", "2026-10-15T12:00:00Z", "2026-11-02T03:00:00Z"];
  await insert(dates.map((d, i) => order({ total: (i + 1) * 10000, createdAt: new Date(d) })));
  const weekly = (await get("?period=custom&from=2026-08-01&to=2026-11-15")).json.analytics;
  assert.equal(weekly.period.granularity, "week");
  for (const d of dates) { const key = financePeriodKey(new Date(d), "week"); assert.ok(weekly.series.find((p) => p.key === key && p.sales > 0), `semana ${key}`); }
  assert.equal(weekly.series.reduce((s, p) => s + p.sales, 0), weekly.sales.reconciledSales);
  assert.equal(new Set(weekly.series.map((p) => p.key)).size, weekly.series.length);
  const daily = (await get("?period=custom&from=2026-08-30&to=2026-09-08")).json.analytics;
  assert.equal(daily.period.granularity, "day"); assert.equal(daily.series.length, 10);
  assert.deepEqual(daily.series.filter((p) => p.sales).map((p) => p.key), ["2026-08-30", "2026-08-31", "2026-09-06", "2026-09-07"]);
  assert.equal(daily.series.find((p) => p.key === "2026-09-01").sales, 0);
  const monthly = (await get("?period=custom&from=2025-06-01&to=2026-11-15")).json.analytics;
  assert.equal(monthly.period.granularity, "month"); assert.equal(monthly.series.at(-1).key, "2026-11"); assert.equal(monthly.series.find((p) => p.key === "2026-11").sales, 60000);
});

test("S06 más vendidos agrupa variantes por producto, usa snapshots históricos y excluye ventas no conciliadas", async () => {
  const ps = []; for (let i = 0; i < 7; i++) ps.push((await fixture.makeProduct(10)).product);
  const deletedId = new (ctx().mongoose.Types.ObjectId)();
  await insert(
    order({ total: 0, items: [line(ps[0], 2, 200000), { ...line(ps[0], 3, 270000), variantId: new (ctx().mongoose.Types.ObjectId)(), sku: "OTRA-VAR" }] }),
    order({ total: 0, items: [line(ps[1], 4, 160000), { product: deletedId, variantId: deletedId, productName: "Sombrero retirado", productImage: "https://example.test/old.jpg", quantity: 6, unitPrice: 50000, lineTotal: 300000 }] }),
    order({ total: 0, items: [line(ps[2], 1, 90000), line(ps[3], 1, 80000), line(ps[4], 1, 70000), { ...line(ps[5], 1, 0), lineTotal: undefined, unitPrice: 65000 }] }),
    order({ total: 0, orderStatus: "cancelado", items: [line(ps[6], 50, 5000000)] }),
  );
  const top = (await get("?period=custom&from=2026-11-01&to=2026-11-15")).json.analytics.products.top;
  assert.equal(top.length, 5);
  assert.deepEqual(top.map((p) => [p.name, p.units, p.sales]).slice(0, 3), [["Sombrero retirado", 6, 300000], [ps[0].name, 5, 470000], [ps[1].name, 4, 160000]]);
  assert.equal(top[0].exists, false); assert.equal(top[0].image, "https://example.test/old.jpg"); assert.equal(top[1].exists, true);
  assert.ok(!top.some((p) => p.id === String(ps[6]._id)), "Cancelado no cuenta como venta");
  assert.deepEqual(top.slice(2).map((p) => p.units), [4, 1, 1]);
});

test("S07 productos sin ventas: sólo publicados, sin ventas conciliadas en el periodo, con conteo real", async () => {
  const ps = []; for (const s of [12, 30, 4, 8]) ps.push((await fixture.makeProduct(s)).product);
  const { product: hidden } = await fixture.makeProduct(50); hidden.isActive = false; await hidden.save();
  await insert(order({ items: [line(ps[0], 1, 100000)] }), order({ orderStatus: "cancelado", items: [line(ps[1], 1, 100000)] }),
    order({ items: [line(ps[2], 1, 100000)], createdAt: new Date("2026-10-01T15:00:00Z") }));
  const w = (await get("?period=custom&from=2026-11-01&to=2026-11-15")).json.analytics.products.withoutSales;
  assert.equal(w.count, 3);
  assert.deepEqual(w.items.map((p) => [p.id, p.availableStock]), [[String(ps[1]._id), 30], [String(ps[3]._id), 8], [String(ps[2]._id), 4]]);
  assert.ok(!w.items.some((p) => p.id === String(hidden._id)));
});

test("S08 inventario por variante coincide con variantStatus y el umbral central, sin normalizar stock", async () => {
  const { Product } = ctx();
  const { product: p } = await fixture.makeProduct(0);
  p.variants.push({ sku: "S01-LOW5", stock: 5 }, { sku: "S01-OK6", stock: 6 }, { sku: "S01-LOW1", stock: 1 }, { sku: "S01-INACT", stock: 0, isActive: false }, { sku: "S01-FRAC", stock: 2 }, { sku: "S01-NULL", stock: 3 }); await p.save();
  await Product.collection.updateOne({ _id: p._id }, { $set: { "variants.5.stock": 1.5, "variants.6.stock": null } });
  const { product: neg } = await fixture.makeProduct(1); await Product.collection.updateOne({ _id: neg._id }, { $set: { "variants.0.stock": -2 } });
  const { product: off } = await fixture.makeProduct(0); off.isActive = false; await off.save();
  const before = await Product.find().sort({ _id: 1 }).lean();
  const inv = (await get()).json.analytics.inventory;
  const statuses = before.filter((x) => x.isActive).flatMap((x) => x.variants.filter((v) => v.isActive !== false).map(variantStatus));
  assert.deepEqual([inv.outVariants, inv.lowVariants, inv.reviewVariants], ["out", "low", "review"].map((s) => statuses.filter((x) => x === s).length));
  assert.deepEqual([inv.outVariants, inv.lowVariants, inv.reviewVariants], [1, 2, 3]);
  assert.equal(inv.threshold, 5);
  assert.deepEqual(inv.items.map((i) => i.status), ["out", "review", "review", "review", "low", "low"]);
  assert.ok(inv.items.filter((i) => i.status === "review").every((i) => i.stock === null), "Stock inválido no se presenta como cifra");
  assert.ok(inv.items[0].size && inv.items[0].color && inv.items[0].variantId && inv.items[0].productId);
  assert.deepEqual(await Product.find().sort({ _id: 1 }).lean(), before);
});

test("S09 distribución por estado exclusiva y revisión como indicador superpuesto de la bandeja", async () => {
  const at = new Date("2026-11-09T15:00:00Z");
  await insert(
    order({ orderStatus: "pendiente", paymentMethod: "contra_entrega", paymentStatus: "pendiente", createdAt: at }),
    order({ orderStatus: "pago_pendiente", paymentStatus: "pendiente", createdAt: at }),
    order({ orderStatus: "en_preparacion", requiresReview: true, createdAt: at }),
    order({ orderStatus: "enviado", createdAt: at }), order({ orderStatus: "entregado", createdAt: at }),
    order({ orderStatus: "cancelado", createdAt: at }), order({ orderStatus: "rechazado", paymentStatus: "rechazado", createdAt: at }), order({ orderStatus: "devuelto", createdAt: at }),
  );
  const d = (await get("?period=custom&from=2026-11-09&to=2026-11-09")).json.analytics.distribution;
  assert.equal(d.total, 8); assert.equal(d.statuses.reduce((s, x) => s + x.count, 0), 8);
  assert.deepEqual(Object.fromEntries(d.statuses.map((s) => [s.key, s.count])), { pending: 2, preparing: 1, shipped: 1, delivered: 1, cancelled: 2, returned: 1 });
  const tray = await ctx().Order.countDocuments({ createdAt: { $gte: new Date("2026-11-09T05:00:00Z"), $lt: new Date("2026-11-10T05:00:00Z") }, ...require("../src/services/orderWorkspace").trayFilter("review") });
  assert.equal(d.review, tray); assert.equal(d.review, 1);
});

test("S10 comparación sólo con periodo anterior equivalente e historial suficiente", async () => {
  await insert(order({ total: 70000, createdAt: new Date("2026-10-01T15:00:00Z") }), order({ total: 100000, createdAt: new Date("2026-11-03T15:00:00Z") }), order({ total: 300000, createdAt: new Date("2026-11-10T15:00:00Z") }), order({ total: 50000, orderStatus: "cancelado", createdAt: new Date("2026-11-04T15:00:00Z") }));
  const a = (await get("?period=custom&from=2026-11-08&to=2026-11-14")).json.analytics.sales;
  assert.equal(a.comparison.available, true); assert.equal(a.comparison.previousFrom, "2026-11-01"); assert.equal(a.comparison.previousTo, "2026-11-07");
  assert.deepEqual(a.comparison.metrics.reconciledSales, { previous: 100000, deltaPct: 200 });
  assert.deepEqual(a.comparison.metrics.ordersRegistered, { previous: 2, deltaPct: -50 });
  const b = (await get("?period=custom&from=2026-10-01&to=2026-10-07")).json.analytics;
  assert.equal(b.sales.comparison.available, false); assert.match(b.sales.comparison.reason, /historial suficiente/);
  assert.equal(b.history.firstOrderAt, "2026-10-01T15:00:00.000Z");
  const month = analytics.resolvePeriod({ period: "month" }, new Date("2026-03-31T20:00:00Z"));
  assert.equal(analytics.previousWindow(month, new Date("2020-01-01")).available, false);
  const ok = analytics.resolvePeriod({ period: "month" }, new Date("2026-03-15T20:00:00Z")), w = analytics.previousWindow(ok, new Date("2020-01-01"));
  assert.deepEqual([w.available, w.previousFrom, w.previousTo, +w.end - +w.start], [true, "2026-02-01", "2026-02-15", +ok.effectiveEnd - +ok.start]);
  const zero = analytics.resolvePeriod({ period: "custom", from: "2026-11-08", to: "2026-11-14" }, new Date("2026-11-24T12:00:00Z"));
  assert.equal(analytics.previousWindow(zero, null).available, false);
});

test("S11 parámetros inválidos responden 400 sin consultar ni escribir", async () => {
  for (const q of ["?period=year", "?period=custom", "?period=custom&from=2026-02-30&to=2026-03-01", "?period=custom&from=2026-11-10&to=2026-11-01",
    "?period=custom&from=2099-01-01&to=2099-01-02", "?period=custom&from=2020-01-01&to=2026-01-01", "?period=", "?period=hoy", "?period=custom&from=2026-11-01T00:00:00Z&to=2026-11-02"]) {
    const r = await get(q); assert.equal(r.status, 400, `${q}: ${r.text}`);
  }
});

test("S12 estado vacío: ceros reales, ticket nulo, sin comparación ni productos inventados", async () => {
  await fixture.makeProduct(8);
  const a = (await get("?period=7d")).json.analytics;
  assert.deepEqual([a.sales.reconciledSales, a.sales.reconciledOrders, a.sales.ordersRegistered, a.sales.unitsSold, a.sales.averageTicket], [0, 0, 0, 0, null]);
  assert.equal(a.sales.comparison.available, false); assert.equal(a.series.length, 7); assert.ok(a.series.every((p) => p.sales === 0));
  assert.deepEqual(a.products.top, []); assert.equal(a.products.withoutSales.count, 1); assert.equal(a.distribution.total, 0); assert.equal(a.history.firstOrderAt, null);
});

test("S13 lecturas concurrentes con compra y ajuste: resultados estables y ninguna escritura analítica", async () => {
  const { product } = await fixture.makeProduct(9);
  await insert(order({ items: [line(product, 2, 200000)], total: 200000, createdAt: new Date(Date.now() - 60000) }));
  const before = await snapshot();
  const reads = await Promise.all(Array.from({ length: 6 }, (_, i) => get(i % 2 ? "?period=30d" : "?period=today")));
  assert.ok(reads.every((r) => r.status === 200)); assert.deepEqual(await snapshot(), before, "Las lecturas no modifican pedidos, productos, historial, avisos ni ajustes");
  const [checkout, adjust, ...more] = await Promise.all([
    api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, product.variants[0]._id, { paymentMethod: "contra_entrega" }), cookie: ctx().clientCookie }),
    api("POST", `/api/admin/catalog/products/${product._id}/stock`, { cookie: ctx().adminCookie, body: { variantId: String(product.variants[0]._id), delta: 3, operationKey: crypto.randomUUID(), reason: "S01 conteo ficticio" } }),
    get("?period=today"), get("?period=7d"), get(),
  ]);
  assert.equal(checkout.status, 201, checkout.text); assert.equal(adjust.status, 200, adjust.text); assert.ok(more.every((r) => r.status === 200));
  assert.equal(await fixture.stockOf(product, product.variants[0]._id), 11, "Venta (-1) y ajuste (+3) aplicados una vez; las lecturas no alteran inventario");
  const after = (await get("?period=today")).json.analytics.sales; assert.equal(after.ordersRegistered, 2);
});

test("S14 el dashboard operativo conserva su contrato y la analítica no cambia contadores de tareas", async () => {
  const { product } = await fixture.makeProduct(5);
  await api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, product.variants[0]._id, { paymentMethod: "contra_entrega" }), cookie: ctx().clientCookie });
  const d1 = (await api("GET", "/api/admin/dashboard", { cookie: ctx().adminCookie })).json.dashboard;
  for (const q of ["?period=today", "?period=month", "?period=custom&from=2025-01-01&to=2025-01-31"]) assert.equal((await get(q)).status, 200);
  const d2 = (await api("GET", "/api/admin/dashboard", { cookie: ctx().adminCookie })).json.dashboard;
  assert.deepEqual(d2.attention, d1.attention); assert.ok(Array.isArray(d2.operationalOrders)); assert.equal(typeof d2.orders.revenueMonth, "number");
});
