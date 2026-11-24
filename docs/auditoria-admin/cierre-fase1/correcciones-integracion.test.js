"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");

// Reuse the independent auditor's fixture and pertinent scenarios verbatim.
// Its original test is not registered: infrastructure/index-migration probes
// are outside this correction. The original source and evidence stay untouched.
const original = path.join(__dirname, "independiente.test.js");
const fixture = new Module(original, module);
fixture.filename = original;
fixture.paths = Module._nodeModulePaths(__dirname);
fixture.require = (name) => name === "node:test" ? () => {} : Module.prototype.require.call(fixture, name);
const source = fs.readFileSync(original, "utf8");
fixture._compile(source + `
module.exports = {
  setup, scenarioFinanceGap, scenarioStockRaces, scenarioUiGuards, api,
  get context() { return { Order, ProductHistory, mongoose, base, superCookie, adminCookie, results, blocked }; },
  async close() {
    fs.writeFileSync(path.join(__dirname, "correcciones-independientes-resultados.json"), JSON.stringify({
      originalSha256: require("crypto").createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
      scope: ["I16/I16b", "I08/I08b/I08c", "I19/I19b/I19c"], results, blocked,
    }, null, 2));
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  },
};
`, original);
const audit = fixture.exports;
test.before(async () => audit.setup());
test.after(async () => {
  try { assert.deepEqual(audit.context.blocked, []); }
  finally { await audit.close(); }
});
for (const name of ["scenarioFinanceGap", "scenarioStockRaces", "scenarioUiGuards"]) {
  test(`independiente sin cambios: ${name}`, async () => {
    const start = audit.context.results.length;
    await audit[name]();
    const rows = audit.context.results.slice(start);
    assert.ok(rows.length);
    assert.deepEqual(rows.filter((r) => ["fail", "defect"].includes(r.verdict)), [], JSON.stringify(rows));
  });
}

let financeFixtures, report, history;
test("finanzas: cancelados, devueltos, reembolsados e incidencias activas no son ingresos conciliados", async () => {
  const { Order, mongoose, superCookie, adminCookie } = audit.context;
  const from = new Date(Date.now() - 86400000).toISOString(), to = new Date(Date.now() + 86400000).toISOString();
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const snapshot = async () => {
    const r = await audit.api("GET", `/api/admin/finance/report?${query}`, { cookie: superCookie });
    const h = await audit.api("GET", `/api/admin/finance/history?${query}`, { cookie: superCookie });
    const d = await audit.api("GET", "/api/admin/dashboard", { cookie: adminCookie });
    assert.equal(r.status, 200, r.text); assert.equal(h.status, 200, h.text); assert.equal(d.status, 200, d.text);
    return { report: r.json, history: h.json, dashboard: d.json };
  };
  const before = await snapshot();
  const tag = crypto.randomBytes(4).toString("hex");
  const create = (name, total, extra = {}) => ({
    _id: new mongoose.Types.ObjectId(), orderNumber: `FIX-${tag}-${name}`,
    buyer: { name: "Ficticio", email: "cierre@example.test", phone: "3000000000" },
    paymentMethod: "wompi", paymentStatus: "pagado", orderStatus: "entregado", requiresReview: false,
    items: [{ product: new mongoose.Types.ObjectId(), variantId: new mongoose.Types.ObjectId(), productName: name,
      quantity: 1, unitPrice: total, lineTotal: total, unitCost: 10000 }],
    total, subtotal: total, createdAt: new Date(), updatedAt: new Date(), ...extra,
  });
  financeFixtures = [
    create("VALIDO", 80000, { subtotal: 60000, taxTotal: 15000, shippingCost: 5000,
      items: [{ product: new mongoose.Types.ObjectId(), variantId: new mongoose.Types.ObjectId(), productName: "VALIDO", quantity: 1, unitPrice: 60000, lineTotal: 60000, unitCost: 10000 }] }),
    create("RESUELTO", 90000, { incidents: [{ code: "payment_processing_failed", detail: "Evidencia resuelta", resolvedAt: new Date() }] }),
    create("LEGADO", 70000),
    create("CANCELADO", 50000, { orderStatus: "cancelado" }),
    create("DEVUELTO", 45000, { orderStatus: "devuelto" }),
    create("REEMBOLSADO", 35000, { paymentStatus: "reembolsado" }),
    create("RECHAZADO", 10000, { orderStatus: "rechazado" }),
    create("REVISION", 30000, { requiresReview: true }),
    create("INCIDENCIA", 40000, { incidents: [{ code: "payment_amount_or_currency_mismatch", detail: "Cobro a conciliar", resolvedAt: null }] }),
    create("INCIDENCIA_LEGADA", 42000, { incidents: [{ code: "approved_after_cancellation", detail: "Sin fecha de resolución" }] }),
    create("PENDIENTE", 55000, { paymentStatus: "pendiente" }),
  ];
  delete financeFixtures[2].requiresReview; // A legacy document without new fields.
  await Order.collection.insertMany(financeFixtures);
  const evidenceBefore = await Order.collection.find({ _id: { $in: financeFixtures.map((o) => o._id) } }).sort({ orderNumber: 1 }).toArray();
  const after = await snapshot(); report = after.report; history = after.history;
  assert.equal(after.report.sales.ordersCount - before.report.sales.ordersCount, 3);
  assert.equal(after.report.sales.totalCollected - before.report.sales.totalCollected, 240000);
  assert.equal(after.report.sales.productRevenue - before.report.sales.productRevenue, 220000);
  assert.equal(after.report.sales.grossProfit - before.report.sales.grossProfit, 190000);
  assert.equal(after.history.summary.totalOrders - before.history.summary.totalOrders, 3);
  assert.equal(after.history.summary.totalRevenue - before.history.summary.totalRevenue, 240000);
  assert.equal(after.history.summary.totalProfit - before.history.summary.totalProfit, 190000);
  const monthRevenue = (d) => d.dashboard.orders.revenueMonth;
  assert.equal(monthRevenue(after.dashboard) - monthRevenue(before.dashboard), 240000);
  assert.equal(after.report.sales.totalCollected, after.history.summary.totalRevenue);
  assert.equal(after.report.sales.ordersCount, after.history.summary.totalOrders);
  assert.equal(after.report.sales.grossMarginPct, after.history.summary.grossMarginPct);
  const evidenceAfter = await Order.collection.find({ _id: { $in: financeFixtures.map((o) => o._id) } }).sort({ orderNumber: 1 }).toArray();
  assert.deepEqual(evidenceAfter, evidenceBefore, "Las consultas no reescriben historia ni cobros en disputa");
});

test("finanzas: indicadores, métodos, tendencia y exportaciones contienen solo las mismas ventas", async () => {
  assert.ok(report && history);
  assert.equal(report.paymentMethods.reduce((sum, row) => sum + row.count, 0), report.sales.ordersCount);
  assert.equal(report.paymentMethods.reduce((sum, row) => sum + row.total, 0), report.sales.totalCollected);
  const validNumbers = financeFixtures.slice(0, 3).map((o) => o.orderNumber);
  const excludedNumbers = financeFixtures.slice(3).map((o) => o.orderNumber);
  assert.ok(validNumbers.every((n) => report.salesLines.some((line) => line.orderNumber === n)));
  assert.ok(excludedNumbers.every((n) => !report.salesLines.some((line) => line.orderNumber === n)));
  const month = report.monthlyTrend.at(-1);
  assert.equal(month.totalRevenue, report.sales.totalCollected);
  assert.equal(month.orders, report.sales.ordersCount);
  const { base, superCookie } = audit.context;
  const query = `from=${encodeURIComponent(report.period.start)}&to=${encodeURIComponent(report.period.end)}`;
  const getExport = (type) => fetch(`${base}/api/admin/finance/export/${type}?${query}`, { headers: { Cookie: superCookie } });
  const csv = await getExport("csv"); assert.equal(csv.status, 200);
  const text = await csv.text();
  for (const n of validNumbers) assert.ok(text.includes(n));
  for (const n of excludedNumbers) assert.ok(!text.includes(n));
  const xlsx = await getExport("xlsx"); assert.equal(xlsx.status, 200);
  const ExcelJS = require(path.resolve(__dirname, "../../../backend/node_modules/exceljs"));
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
  const rows = JSON.stringify(workbook.getWorksheet("Ventas").getSheetValues());
  for (const n of validNumbers) assert.ok(rows.includes(n));
  for (const n of excludedNumbers) assert.ok(!rows.includes(n));
  const pdf = await getExport("pdf"); assert.equal(pdf.status, 200);
  assert.ok(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).equals(Buffer.from("%PDF")));
});
