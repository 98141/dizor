"use strict";
// Comprobaciones independientes de Fase 6. No modifica la aplicación ni aserciones anteriores.
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require(path.resolve(__dirname, "../../../backend/test/helpers/phase2Fixture.cjs"));
const out = path.join(__dirname, "independiente-resultados.json");
const record = [];
const note = (id, ok, detail) => record.push({ id, ok, ...detail });

test.before(() => fixture.setup());
test.after(() => {
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), results: record }, null, 2));
  return fixture.close();
});

test("I6-01 inventario, alertas y dashboard coinciden con los datos y no los reescriben", async () => {
  const { Product, adminCookie } = fixture.context;
  await Product.deleteMany({});
  const mixed = (await fixture.makeProduct(12)).product;
  mixed.variants.push({ sku: "I6-OUT", stock: 0, isActive: true });
  await mixed.save();
  const low = (await fixture.makeProduct(2)).product;
  low.variants.push({ sku: "I6-HIGH", stock: 40, isActive: true });
  await low.save();
  const inactive = (await fixture.makeProduct(20)).product;
  inactive.variants.push({ sku: "I6-OFF", stock: 0, isActive: false });
  await inactive.save();
  const onlyInactive = (await fixture.makeProduct(0)).product;
  onlyInactive.variants[0].isActive = false;
  await onlyInactive.save();
  const review = (await fixture.makeProduct(8)).product;
  await Product.collection.updateOne({ _id: review._id }, { $set: { "variants.0.stock": 1.5 } });
  const missing = (await fixture.makeProduct(6)).product;
  await Product.collection.updateOne({ _id: missing._id }, { $unset: { "variants.0.stock": "" } });
  const unpublished = (await fixture.makeProduct(0)).product;
  unpublished.isActive = false;
  await unpublished.save();
  const before = await Product.find().lean();
  const dashboard = await fixture.api("GET", "/api/admin/dashboard", { cookie: adminCookie });
  const alerts = await fixture.api("GET", "/api/admin/alerts", { cookie: adminCookie });
  const after = await Product.find().lean();
  const catalog = dashboard.json.dashboard.catalog;
  const groups = alerts.json.alerts;
  const ok = dashboard.status === 200 && alerts.status === 200
    && catalog.outOfStock === 2 && catalog.lowStock === 1
    && groups.outOfStock.count === 2 && groups.lowStock.count === 1 && groups.inventoryReview.count === 2
    && JSON.stringify(after) === JSON.stringify(before);
  note("I6-01", ok, {
    catalog, alerts: { out: groups.outOfStock.count, low: groups.lowStock.count, review: groups.inventoryReview.count },
    unchanged: JSON.stringify(after) === JSON.stringify(before),
  });
  assert.equal(catalog.outOfStock, 2);
  assert.equal(catalog.lowStock, 1);
  assert.equal(groups.outOfStock.count, 2);
  assert.equal(groups.lowStock.count, 1);
  assert.equal(groups.inventoryReview.count, 2);
  assert.deepEqual(after, before);
});

test("I6-02 roles no alcanzan finanzas, recaudo ni historial de inventario fuera de su permiso", async () => {
  const { vendorCookie, adminCookie, superCookie } = fixture.context;
  const { product } = await fixture.makeProduct(4);
  const checkout = await fixture.api("POST", "/api/checkout/orders", {
    body: fixture.orderBody(product, product.variants[0]._id, { paymentMethod: "contra_entrega" }),
  });
  assert.equal(checkout.status, 201);
  const id = checkout.json.order.id;
  const vendorPay = await fixture.api("PATCH", `/api/admin/orders/${id}/payment`, {
    cookie: vendorCookie, body: { reference: "GIRO-I6", receivedAt: "2026-11-21T06:00" },
  });
  const finance = {};
  for (const [role, cookie] of [["vendor", vendorCookie], ["admin", adminCookie], ["super", superCookie]]) {
    finance[role] = (await fixture.api("GET", "/api/admin/finance/report", { cookie })).status;
  }
  const history = (await fixture.api("GET", "/api/admin/inventory/history", { cookie: vendorCookie })).status;
  const stored = await fixture.context.Order.findById(id).lean();
  const ok = vendorPay.status === 403 && finance.vendor === 403 && finance.admin === 403 && finance.super === 200
    && history === 403 && stored.paymentStatus === "pendiente";
  note("I6-02", ok, { vendorPay: vendorPay.status, finance, history, paymentStatus: stored.paymentStatus });
  assert.equal(vendorPay.status, 403);
  assert.equal(finance.vendor, 403);
  assert.equal(finance.admin, 403);
  assert.equal(finance.super, 200);
  assert.equal(history, 403);
  assert.equal(stored.paymentStatus, "pendiente");
});

test("I6-03 repetir la preparación no anuncia una transición nueva", async () => {
  const { adminCookie } = fixture.context;
  const { product } = await fixture.makeProduct(5);
  const checkout = await fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, product.variants[0]._id) });
  const id = checkout.json.order.id;
  const first = await fixture.api("PATCH", `/api/admin/orders/${id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  const second = await fixture.api("PATCH", `/api/admin/orders/${id}/status`, { cookie: adminCookie, body: { orderStatus: "en_preparacion" } });
  const ok = first.json.message === "Estado actualizado" && second.json.message === "El pedido ya tenía este estado. No se registró una nueva transición.";
  note("I6-03", ok, { first: first.json.message, second: second.json.message });
  assert.equal(ok, true);
});
