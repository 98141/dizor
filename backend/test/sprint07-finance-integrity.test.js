"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { assess, emptyRollup, addLine, productRow, financeProductListQuery, financeHistoryPage } = require("../src/services/financePresentation");
const { parseFinancePeriod, financePeriodKey } = require("../src/utils/financePeriod");

const line = (overrides) => ({ quantity: 1, unitPrice: 100000, lineTotal: 100000, ...overrides });

test("un costo ausente no se presenta como margen verificable del 100", () => {
  const roll = emptyRollup();
  addLine(roll, line({ unitCost: undefined }), null);
  const view = assess(roll);
  assert.equal(view.cogs, 0);
  assert.equal(view.grossMarginPct, 100);
  assert.equal(view.marginReliable, false);
  assert.equal(view.status, "pending");
  assert.equal(view.knownMarginPct, null);
  assert.equal(view.knownProfit, 0);
});

test("un costo cero es un costo conocido y el margen puede ser 100", () => {
  const roll = emptyRollup();
  addLine(roll, line({ unitCost: 0 }), 40000);
  const view = assess(roll);
  assert.equal(view.cogs, 0);
  assert.equal(view.marginReliable, true);
  assert.equal(view.status, "complete");
  assert.equal(view.knownMarginPct, 100);
});

test("el costo histórico de la venta gana al costo actual", () => {
  const roll = emptyRollup();
  addLine(roll, line({ unitCost: 20000 }), 90000);
  const view = assess(roll);
  assert.equal(view.cogs, 20000);
  assert.equal(view.knownProfit, 80000);
  assert.equal(view.marginReliable, true);
});

test("la cobertura parcial no usa el ingreso sin costo como ganancia verificable", () => {
  const roll = emptyRollup();
  addLine(roll, line({ unitCost: 40000 }), null);
  addLine(roll, line({ productName: "sin costo" }), null);
  const view = assess(roll);
  assert.equal(view.status, "partial");
  assert.equal(view.knownProfit, 60000);
  assert.equal(view.grossProfit, 160000);
  assert.equal(view.marginReliable, false);
  assert.equal(view.costCoveragePct, 50);
});

test("un producto con unidades sin costo no entra al ranking como margen 100", () => {
  const row = productRow({ ...emptyRollup(), productId: "p", name: "Iraca", slug: "iraca", revenue: 100000, knownRevenue: 0, missingRevenue: 100000, units: 1, missingUnits: 1, cogs: 0 });
  assert.equal(row.costComplete, false);
  assert.equal(row.marginPct, null);
  assert.equal(row.profit, null);
});

test("hoy y 30 días usan el día civil de Colombia", () => {
  const now = new Date("2026-11-24T15:00:00Z");
  const today = parseFinancePeriod("today", null, null, now);
  assert.equal(today.start.toISOString(), "2026-11-24T05:00:00.000Z");
  assert.equal(today.end.toISOString(), "2026-11-25T04:59:59.999Z");
  const days = parseFinancePeriod("days30", null, null, now);
  assert.equal(days.start.toISOString(), "2026-10-26T05:00:00.000Z");
  assert.equal(financePeriodKey(new Date("2026-11-24T04:30:00Z"), "day"), "2026-11-23");
});

test("la página de costos rechaza tamaños ajenos y no trata el filtro sin costo como cero", () => {
  assert.throws(() => financeProductListQuery({ page: 1, limit: 15 }), /Tamaño de página/);
  const query = financeProductListQuery({ page: 1, filter: "missing", sort: "cost", q: "a+b" });
  assert.equal(query.filter, "missing");
  assert.equal(query.regex, "a\\+b");
  assert.equal(query.legacy, false);
  assert.equal(financeProductListQuery({}).legacy, true);
  assert.throws(() => financeHistoryPage({ page: 0 }), /Página de historial/);
  assert.equal(financeHistoryPage({ page: 2, limit: 12 }).limit, 12);
});

test("una cifra elevada sigue siendo un entero seguro de presentar", () => {
  const stock = 140098;
  const price = 225000;
  const potential = stock * price;
  assert.equal(Number.isSafeInteger(potential), true);
  assert.equal(new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(potential).includes("31"), true);
});
