"use strict";
// Escenarios propios del cierre final. No modifica aplicación ni aserciones anteriores.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require(path.resolve(__dirname, "../../../../backend/test/helpers/phase2Fixture.cjs"));
const root = path.resolve(__dirname, "../../../..");
const out = path.join(__dirname, "independiente-resultados.json");
const record = [];
const note = (id, detail) => record.push({ id, ...detail });
const { parseFinancePeriod, financePeriodKey, financeMonthBounds, historyBounds } = require(path.join(root, "backend/src/utils/financePeriod"));

test.before(() => fixture.setup());
test.after(() => {
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), results: record }, null, 2));
  return fixture.close();
});

test("I7-01 el día civil colombiano no sigue la zona del proceso", () => {
  const day = parseFinancePeriod(null, "2026-11-20", "2026-11-20");
  assert.equal(day.start.toISOString(), "2026-11-20T05:00:00.000Z");
  assert.equal(day.end.toISOString(), "2026-11-21T04:59:59.999Z");
  const several = parseFinancePeriod(null, "2026-11-19", "2026-11-21");
  assert.equal(several.start.toISOString(), "2026-11-19T05:00:00.000Z");
  assert.equal(several.end.toISOString(), "2026-11-22T04:59:59.999Z");
  const november = financeMonthBounds(0, new Date("2026-11-15T18:00:00Z"));
  assert.equal(november.start.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(november.end.toISOString(), "2026-12-01T04:59:59.999Z");
  const december = financeMonthBounds(0, new Date("2026-12-31T12:00:00Z"));
  assert.equal(december.start.toISOString(), "2026-12-01T05:00:00.000Z");
  assert.equal(december.end.toISOString(), "2027-01-01T04:59:59.999Z");
  const january = financeMonthBounds(0, new Date("2027-01-01T05:00:00Z"));
  assert.equal(january.start.toISOString(), "2027-01-01T05:00:00.000Z");
  assert.equal(january.end.toISOString(), "2027-02-01T04:59:59.999Z");
  assert.equal(financePeriodKey(new Date("2026-11-20T04:30:00Z"), "day"), "2026-11-19");
  assert.equal(financePeriodKey(new Date("2026-11-20T05:00:00Z"), "day"), "2026-11-20");
  assert.equal(financePeriodKey(new Date("2026-11-20T15:00:00Z"), "week"), "2026-W47");
  assert.equal(financePeriodKey(new Date("2026-11-20T15:00:00Z"), "month"), "2026-11");
  assert.equal(financePeriodKey(new Date("2026-11-20T15:00:00Z"), "year"), "2026");
  assert.equal(financePeriodKey(new Date("2027-01-01T04:30:00Z"), "day"), "2026-12-31");
  assert.equal(financePeriodKey(new Date("2027-01-01T04:30:00Z"), "year"), "2026");
  assert.equal(financePeriodKey(new Date("2027-01-01T05:00:00Z"), "week"), "2026-W53");
  const exact = parseFinancePeriod(null, "2026-11-20T10:00:00-05:00", "2026-11-20T20:00:00Z");
  assert.equal(exact.start.toISOString(), "2026-11-20T15:00:00.000Z");
  assert.equal(exact.end.toISOString(), "2026-11-20T20:00:00.000Z");
  assert.throws(() => parseFinancePeriod(null, "2026-11-20T23:15:00-05:00", "2026-11-21T01:00:00Z"), { statusCode: 400 });
  for (const bad of ["2026-02-31", "2026-04-31", "2026-11-31", "2026-00-10", "20-11-2026"]) {
    assert.throws(() => parseFinancePeriod(null, bad, "2026-12-01"), { statusCode: 400 });
  }
  assert.throws(() => parseFinancePeriod(null, "2026-12-02", "2026-12-01"), { statusCode: 400 });
  assert.equal(historyBounds("week", "2026-12-28", "2027-01-03").start.toISOString(), "2026-12-28T05:00:00.000Z");
  const zones = {};
  for (const tz of ["UTC", "America/Bogota", "Pacific/Kiritimati", "Pacific/Honolulu"]) {
    zones[tz] = execFileSync(process.execPath, ["-e", "const p=require('./backend/src/utils/financePeriod'); const r=p.parseFinancePeriod(null,'2026-11-20','2026-11-20'); console.log([r.start.toISOString(), r.end.toISOString(), p.financePeriodKey(new Date('2026-11-20T04:30:00Z'),'day'), p.financeMonthBounds(0, new Date('2026-12-31T20:00:00Z')).end.toISOString()].join('|'))"], { cwd: root, env: { ...process.env, TZ: tz }, encoding: "utf8" }).trim();
  }
  note("I7-01", { zones });
  for (const value of Object.values(zones)) assert.equal(value, "2026-11-20T05:00:00.000Z|2026-11-21T04:59:59.999Z|2026-11-19|2027-01-01T04:59:59.999Z");
});

test("I7-02 gráfica, reporte y CSV coinciden y excluyen lo no conciliado", async () => {
  const { Order, superCookie } = fixture.context;
  await Order.deleteMany({});
  const { product } = await fixture.makeProduct(12, 100000);
  const plan = [
    ["2026-11-20T05:00:00.000Z", {}],
    ["2026-11-21T04:59:59.999Z", {}],
    ["2026-11-20T05:00:00.000Z", { orderStatus: "cancelado" }],
    ["2026-11-21T04:59:59.999Z", { requiresReview: true }],
    ["2026-11-20T12:00:00.000Z", { paymentStatus: "reembolsado" }],
    ["2026-11-20T18:00:00.000Z", { paymentStatus: "pendiente" }],
    ["2026-11-20T04:59:59.999Z", {}],
    ["2026-11-21T05:00:00.000Z", {}],
  ];
  const made = [];
  for (const [stamp, fields] of plan) {
    const response = await fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, product.variants[0]._id) });
    assert.equal(response.status, 201, response.text);
    const order = await Order.findById(response.json.order.id);
    made.push({ id: order._id, stamp, total: order.total, fields });
  }
  for (const entry of made) {
    await Order.collection.updateOne({ _id: entry.id }, { $set: { createdAt: new Date(entry.stamp), paymentStatus: "pagado", ...entry.fields } });
  }
  const expected = made[0].total + made[1].total;
  const beforeDocs = await Order.find().lean();
  const query = "from=2026-11-20&to=2026-11-20";
  const history = await fixture.api("GET", "/api/admin/finance/history?groupBy=day&" + query, { cookie: superCookie });
  const report = await fixture.api("GET", "/api/admin/finance/report?" + query, { cookie: superCookie });
  const csv = await fixture.api("GET", "/api/admin/finance/export/csv?" + query, { cookie: superCookie });
  const month = await fixture.api("GET", "/api/admin/finance/history?groupBy=month&from=2026-11-01&to=2026-11-30", { cookie: superCookie });
  const year = await fixture.api("GET", "/api/admin/finance/history?groupBy=year&from=2026-01-01&to=2026-12-31", { cookie: superCookie });
  const afterDocs = await Order.find().lean();
  const csvCount = (csv.text.match(/"Pedidos pagados","(\d+)"/) || [])[1];
  const ok = history.status === 200 && history.json.summary.totalOrders === 2 && history.json.rows.length === 1
    && history.json.rows[0].periodKey === "2026-11-20" && history.json.summary.totalRevenue === expected
    && report.json.sales.ordersCount === 2 && report.json.sales.totalCollected === expected
    && report.json.pending.ordersCount === 1 && csvCount === "2"
    && month.json.rows.some((row) => row.periodKey === "2026-11" && row.ordersCount === 4)
    && year.json.rows.some((row) => row.periodKey === "2026" && row.ordersCount === 4);
  note("I7-02", { history: history.json.summary, report: report.json.sales, pending: report.json.pending, csvCount, month: month.json.rows, year: year.json.rows, unchanged: JSON.stringify(beforeDocs) === JSON.stringify(afterDocs) });
  assert.equal(history.json.summary.totalOrders, 2);
  assert.equal(history.json.rows[0].periodKey, "2026-11-20");
  assert.equal(history.json.summary.totalRevenue, expected);
  assert.equal(report.json.sales.ordersCount, 2);
  assert.equal(report.json.sales.totalCollected, expected);
  assert.equal(report.json.pending.ordersCount, 1);
  assert.equal(csvCount, "2");
  assert.equal(month.json.summary.totalOrders, 4);
  assert.equal(year.json.summary.totalOrders, 4);
  assert.deepEqual(afterDocs, beforeDocs);
  assert.equal(ok, true);
});

test("I7-03 repetición, última unidad y permisos no escriben de más", async () => {
  const { Order, Product, vendorCookie, adminCookie, superCookie } = fixture.context;
  const { product } = await fixture.makeProduct(1, 80000);
  const variant = product.variants[0]._id;
  const key = "i7-perdida-" + Date.now();
  const body = fixture.orderBody(product, variant, { idempotencyKey: key, email: "perdida-i7@example.test" });
  const first = await fixture.api("POST", "/api/checkout/orders", { body });
  const second = await fixture.api("POST", "/api/checkout/orders", { body });
  const stored = await Order.find({ idempotencyKey: key }).lean();
  const stock = (await Product.findById(product._id)).variants.id(variant).stock;
  const rival = await fixture.makeProduct(1, 90000);
  const [left, right] = await Promise.all([
    fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(rival.product, rival.product.variants[0]._id, { email: "carrera-a@example.test" }) }),
    fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(rival.product, rival.product.variants[0]._id, { email: "carrera-b@example.test" }) }),
  ]);
  const successes = [left, right].filter((item) => item.status === 201);
  const rivalStock = (await Product.findById(rival.product._id)).variants[0].stock;
  const rivalOrders = await Order.countDocuments({ "items.product": rival.product._id });
  const ordersBefore = await Order.find().lean();
  const dashboard = await fixture.api("GET", "/api/admin/dashboard", { cookie: adminCookie });
  const ordersAfter = await Order.find().lean();
  const vendorFinance = await fixture.api("GET", "/api/admin/finance/export/csv?period=all", { cookie: vendorCookie });
  const vendorStock = await fixture.api("POST", `/api/admin/catalog/products/${product._id}/stock`, { cookie: vendorCookie, body: { variantId: String(variant), delta: 5, operationKey: "i7-vendor", reason: "no autorizado" } });
  const adminFinance = await fixture.api("GET", "/api/admin/finance/report?period=all", { cookie: adminCookie });
  const superFinance = await fixture.api("GET", "/api/admin/finance/report?period=all", { cookie: superCookie });
  note("I7-03", { first: first.status, second: second.status, orders: stored.length, stock, race: [left.status, right.status], rivalStock, rivalOrders, vendorFinance: vendorFinance.status, vendorStock: vendorStock.status, adminFinance: adminFinance.status, superFinance: superFinance.status, dashboard: dashboard.status });
  assert.equal(stored.length, 1);
  assert.equal(stock, 0);
  assert.equal(successes.length, 1);
  assert.equal(rivalStock, 0);
  assert.equal(rivalOrders, 1);
  assert.deepEqual(ordersAfter, ordersBefore);
  assert.equal(vendorFinance.status, 403);
  assert.equal(vendorStock.status, 403);
  assert.equal(adminFinance.status, 403);
  assert.equal(superFinance.status, 200);
});

test("I7-04 un fallo de marketing no autoriza un guardado vacío", async () => {
  const { createConfirmedSettings, readMarketing } = await import(pathToFileURL(path.join(root, "frontend/src/lib/confirmedSettings.mjs")).href);
  const real = { key: "default", popup: { title: "Título real", text: "Texto", ctaLabel: "Ver", ctaHref: "/tienda", imageUrl: "", variant: "info", couponCode: "", enabled: true, showNewsletterForm: false, delaySeconds: 4 }, newsletter: { footerTitle: "Pie", footerText: "Texto", successMessage: "Listo" }, abandonedCart: { emailSubject: "Carrito", enabled: false, featureEnabled: false, delayHours: 4, maxReminders: 1 } };
  let writes = 0;
  const resource = createConfirmedSettings({ read: async () => { throw new Error("caida"); }, write: async () => { writes += 1; return { status: "success", settings: {} }; }, parse: readMarketing });
  assert.equal(await resource.load(), false);
  assert.equal(resource.getSnapshot().status, "load-error");
  assert.equal(await resource.save(), false);
  assert.equal(writes, 0);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const late = createConfirmedSettings({ read: () => held, write: async () => { writes += 1; return null; }, parse: readMarketing });
  const pending = late.load();
  late.cancel();
  release({ status: "success", settings: { ...real, popup: { ...real.popup, title: "Tarde" } } });
  await pending;
  assert.notEqual(late.getSnapshot().status, "ready");
  assert.equal(writes, 0);
  note("I7-04", { status: resource.getSnapshot().status, writes, late: late.getSnapshot().status });
});

function pathToFileURL(file) {
  return require("node:url").pathToFileURL(file);
}
