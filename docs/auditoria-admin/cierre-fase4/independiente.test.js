"use strict";
// Auditoría independiente de Fase 4. No modifica la aplicación ni las pruebas de Codex.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const fixture = require("../../../backend/test/helpers/phase2Fixture.cjs");
const ProductHistory = require("../../../backend/src/models/productHistory");
const StockAdjustment = require("../../../backend/src/models/stockAdjustment");
const Notification = require("../../../backend/src/models/notification");

const results = [];
const record = (id, verdict, detail) => results.push({ id, verdict, detail });
const api = (...args) => fixture.api(...args);
const admin = () => fixture.context.adminCookie;
const vendor = () => fixture.context.vendorCookie;
const superAdmin = () => fixture.context.superCookie;
const key = () => crypto.randomUUID();
const sku = () => "AUD-" + crypto.randomUUID().slice(0, 10).toUpperCase();
const list = (q = "", cookie = admin()) => api("GET", `/api/admin/catalog/products${q ? `?${q}` : ""}`, { cookie });
const alerts = (cookie = admin()) => api("GET", "/api/admin/alerts", { cookie });
const history = (q = "", cookie = admin()) => api("GET", `/api/admin/inventory/history${q ? `?${q}` : ""}`, { cookie });
const adjust = (product, variantId, delta, operationKey = key(), cookie = admin(), reason = "Conteo físico de auditoría") =>
  api("POST", `/api/admin/catalog/products/${product._id || product}/stock`, { cookie, body: { variantId: String(variantId), delta, operationKey, reason } });
const make = (stock = 8) => fixture.makeProduct(stock);
const stockOf = (product, variantId) => fixture.stockOf(product, variantId);
const checkout = (product, variantId, extra = {}) => api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, variantId, extra) });
const bodyFor = (product, variantSku, extra = {}) => ({
  name: "Alta " + crypto.randomUUID(), category: String(product.category), salePrice: 80000,
  mainImage: "https://example.test/foto.jpg", images: [{ url: "https://example.test/foto.jpg" }],
  variants: [{ sku: variantSku, stock: 4 }], ...extra,
});

test.before(async () => {
  await fixture.setup();
  await ProductHistory.init();
  await StockAdjustment.init();
  await Notification.init();
});
test.beforeEach(async () => {
  await fixture.context.Order.deleteMany({});
  await Notification.deleteMany({});
  await ProductHistory.deleteMany({});
  await StockAdjustment.deleteMany({});
  await fixture.context.Product.deleteMany({});
  process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
});
test.after(async () => {
  fs.writeFileSync(path.join(__dirname, "independiente-resultados.json"), JSON.stringify({
    at: new Date().toISOString(), blocked: fixture.context.blocked, results,
  }, null, 2));
  try { assert.deepEqual(fixture.context.blocked, []); }
  finally { await fixture.close(); }
});

test("F4-I01 última unidad, ajuste contra venta y dos variantes", async () => {
  const last = await make(1);
  const buyers = await Promise.all([checkout(last.product, last.variantId), checkout(last.product, last.variantId)]);
  const won = buyers.filter((item) => item.status === 201);
  const shared = await make(8);
  const saleAndAdjust = await Promise.all([
    checkout(shared.product, shared.variantId),
    adjust(shared.product, shared.variantId, 2, key(), admin(), "Ingreso durante una venta"),
  ]);
  const second = await make(6);
  const created = await api("POST", "/api/admin/catalog/products", { cookie: admin(), body: bodyFor(second.product, sku(), {
    variants: [
      { sku: sku(), stock: 5, size: String(second.product.variants[0].size), color: String(second.product.variants[0].color) },
      { sku: sku(), stock: 9 },
    ],
  }) });
  const saved = created.status === 201 ? await fixture.context.Product.findById(created.json.product.id) : null;
  const both = saved ? await Promise.all(saved.variants.map((variant, index) => adjust(saved, variant._id, index === 0 ? 1 : -2, key(), admin(), `Ajuste variante ${index}`))) : [];
  const after = saved ? await fixture.context.Product.findById(saved._id) : null;
  const sales = await ProductHistory.countDocuments({ productId: last.product._id, eventType: "sale" });
  const sharedMoves = await ProductHistory.find({ productId: shared.product._id }).lean();
  const ok = won.length === 1 && (await stockOf(last.product, last.variantId)) === 0 && sales === 1
    && saleAndAdjust[0].status === 201 && saleAndAdjust[1].status === 200
    && (await stockOf(shared.product, shared.variantId)) === 9
    && sharedMoves.filter((row) => row.eventType === "sale").length === 1
    && sharedMoves.filter((row) => row.eventType === "stock_adjustment").length === 1
    && created.status === 201 && both.every((item) => item.status === 200)
    && after.variants[0].stock === 6 && after.variants[1].stock === 7;
  record("F4-I01", ok ? "pass" : "fail", {
    buyers: buyers.map((item) => item.status), lastStock: await stockOf(last.product, last.variantId), sales,
    saleAndAdjust: saleAndAdjust.map((item) => item.status), sharedStock: await stockOf(shared.product, shared.variantId),
    created: created.status, variantStocks: after?.variants.map((variant) => variant.stock),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F4-I02 dos administradores, cancelación concurrente y Wompi junto a un ajuste", async () => {
  const piece = await make(10);
  const keys = [key(), key()];
  const admins = await Promise.all([
    adjust(piece.product, piece.variantId, 1, keys[0], admin(), "Conteo del administrador"),
    adjust(piece.product, piece.variantId, 4, keys[1], superAdmin(), "Conteo del superadministrador"),
  ]);
  const otherKey = await api("POST", `/api/admin/catalog/products/${piece.product._id}/stock`, { cookie: superAdmin(), body: {
    variantId: String(piece.variantId), delta: 9, operationKey: keys[0], reason: "Intento de reutilizar la clave",
  } });
  const lookup = await api("GET", `/api/admin/catalog/products/${piece.product._id}/stock-operations/${keys[0]}`, { cookie: superAdmin() });
  const cod = await make(5);
  const order = await checkout(cod.product, cod.variantId);
  assert.equal(order.status, 201, order.text);
  const savedOrder = await fixture.context.Order.findById(order.json.order.id);
  const raced = await Promise.all([
    api("PATCH", `/api/admin/orders/${savedOrder._id}/status`, { cookie: admin(), body: { orderStatus: "cancelado", note: "Cierre de auditoría" } }),
    adjust(cod.product, cod.variantId, -1, key(), admin(), "Retiro durante la cancelación"),
  ]);
  const wompi = await make(6);
  const pending = await checkout(wompi.product, wompi.variantId, { paymentMethod: "wompi" });
  assert.equal(pending.status, 201, pending.text);
  const wompiOrder = await fixture.context.Order.findById(pending.json.order.id);
  const approved = await Promise.all([
    fixture.postEvent(fixture.txFor(wompiOrder)),
    adjust(wompi.product, wompi.variantId, 1, key(), admin(), "Ajuste durante la aprobación"),
  ]);
  const movements = await ProductHistory.find({ productId: wompi.product._id }).lean();
  const notices = await Notification.countDocuments({ order: wompiOrder._id });
  const ok = admins.every((item) => item.status === 200) && (await stockOf(piece.product, piece.variantId)) === 15
    && otherKey.status === 409 && lookup.json.found === false
    && raced.filter((item) => item.status === 200).length === 2
    && (await stockOf(cod.product, cod.variantId)) === 4
    && approved[0].status === 200 && approved[1].status === 200
    && (await stockOf(wompi.product, wompi.variantId)) === 6
    && movements.filter((row) => row.eventType === "sale").length === 1
    && movements.filter((row) => row.eventType === "stock_adjustment").length === 1
    && (await fixture.context.Order.findById(wompiOrder._id)).paymentStatus === "pagado"
    && notices >= 1;
  record("F4-I02", ok ? "pass" : "fail", {
    admins: admins.map((item) => item.status), otherKey: otherKey.status, lookup: lookup.json.found,
    raced: raced.map((item) => item.status), codStock: await stockOf(cod.product, cod.variantId),
    approved: approved.map((item) => item.status), wompiStock: await stockOf(wompi.product, wompi.variantId),
    events: movements.map((row) => row.eventType), notices,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F4-I03 clave repetida, rechazo tardío y lecturas que no mueven stock", async () => {
  const { product, variantId } = await make(4);
  const operationKey = key();
  const first = await adjust(product, variantId, 2, operationKey, admin(), "Ingreso único");
  const replay = await adjust(product, variantId, 2, operationKey, admin(), "Ingreso único");
  const changed = await adjust(product, variantId, 7, operationKey, admin(), "Ingreso único");
  const before = await stockOf(product, variantId);
  const beforeUpdated = (await fixture.context.Product.collection.findOne({ _id: product._id })).updatedAt;
  await list();
  await alerts();
  await history(`productId=${product._id}`);
  const rejectedKey = key();
  const rejected = await adjust(product, variantId, -100, rejectedKey, admin(), "Retiro imposible");
  const late = await adjust(product, variantId, -100, rejectedKey, admin(), "Retiro imposible");
  const rows = await ProductHistory.find({ productId: product._id, eventType: "stock_adjustment" }).lean();
  const intent = await StockAdjustment.findById(rejectedKey).lean();
  const afterUpdated = (await fixture.context.Product.collection.findOne({ _id: product._id })).updatedAt;
  const ok = first.status === 200 && replay.status === 200 && replay.json.repeated === true && changed.status === 409
    && (await stockOf(product, variantId)) === 6
    && rejected.status === 409 && rejected.json.operationRejected === true
    && late.status === 409 && late.json.operationRejected === true
    && rows.length === 1 && rows[0].quantityChange === 2 && rows[0].stockBefore === 4 && rows[0].stockAfter === 6
    && intent.state === "rejected" && before === 6
    && String(beforeUpdated) === String(afterUpdated);
  record("F4-I03", ok ? "pass" : "fail", {
    first: first.status, replay: replay.status, repeated: replay.json?.repeated, changed: changed.status,
    rejected: rejected.status, late: late.status, rows: rows.length, intent: intent?.state, stock: await stockOf(product, variantId),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F4-I04 datos históricos, SKU conservado y producto sin variantes", async () => {
  const fractional = await make(3);
  await fixture.context.Product.collection.updateOne({ _id: fractional.product._id, "variants._id": fractional.variantId }, { $set: { "variants.$.stock": 2.5 } });
  const missing = await make(3);
  await fixture.context.Product.collection.updateOne({ _id: missing.product._id, "variants._id": missing.variantId }, { $unset: { "variants.$.stock": "" } });
  const inactive = await make(9);
  await fixture.context.Product.collection.updateOne({ _id: inactive.product._id, "variants._id": inactive.variantId }, { $set: { "variants.$.isActive": false } });
  const bareId = new fixture.context.mongoose.Types.ObjectId();
  await fixture.context.Product.collection.insertOne({
    _id: bareId, name: "Histórico sin variantes", slug: "historico-sin-variantes-" + crypto.randomUUID().slice(0, 8),
    category: fractional.product.category, salePrice: 1000, isActive: true, variants: [],
    images: [{ url: "https://example.test/p.jpg" }], mainImage: "https://example.test/p.jpg",
    createdAt: new Date(), updatedAt: new Date(),
  });
  const listed = await list("limit=50");
  const fractionRow = listed.json.products.find((item) => item.id === String(fractional.product._id));
  const missingRow = listed.json.products.find((item) => item.id === String(missing.product._id));
  const bareRow = listed.json.products.find((item) => item.id === String(bareId));
  const blocked = await adjust(fractional.product, fractional.variantId, 1);
  const renamed = await make(2);
  const originalSku = renamed.product.variants[0].sku;
  const recorded = await adjust(renamed.product, renamed.variantId, 1, key(), admin(), "Antes de renombrar");
  await api("PATCH", `/api/admin/catalog/products/${renamed.product._id}`, { cookie: admin(), body: {
    variants: [{ id: String(renamed.variantId), sku: sku(), size: renamed.product.variants[0].size, color: renamed.product.variants[0].color, isActive: true }],
  } });
  const oldRow = await ProductHistory.findOne({ productId: renamed.product._id, eventType: "stock_adjustment" }).lean();
  const current = await fixture.context.Product.findById(renamed.product._id);
  const ok = fractionRow.inventory.stockStatus === "review" && fractionRow.variants[0].stock === 2.5
    && missingRow.variants[0].stock == null && missingRow.inventory.stockStatus === "review"
    && bareRow.variants.length === 0 && blocked.status === 409
    && (await stockOf(fractional.product, fractional.variantId)) === 2.5
    && (await ProductHistory.countDocuments({ productId: fractional.product._id, eventType: "stock_adjustment" })) === 0
    && recorded.status === 200 && oldRow.sku === originalSku && current.variants[0].sku !== originalSku && current.variants[0].stock === 3;
  record("F4-I04", ok ? "pass" : "fail", {
    fractional: fractionRow?.variants?.[0]?.stock, status: fractionRow?.inventory?.stockStatus,
    missing: missingRow?.variants?.[0]?.stock, bare: bareRow?.variants?.length, blocked: blocked.status,
    oldSku: oldRow?.sku, currentSku: current.variants[0].sku,
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F4-I05 SKU concurrente, liberación del control y ediciones simultáneas", async () => {
  const seed = await make(2);
  const shared = sku();
  const pair = await Promise.all([
    api("POST", "/api/admin/catalog/products", { cookie: admin(), body: bodyFor(seed.product, shared, { name: "Primera " + crypto.randomUUID() }) }),
    api("POST", "/api/admin/catalog/products", { cookie: admin(), body: bodyFor(seed.product, shared, { name: "Segunda " + crypto.randomUUID() }) }),
  ]);
  const created = pair.filter((item) => item.status === 201);
  const released = await api("POST", "/api/admin/catalog/products", { cookie: admin(), body: bodyFor(seed.product, sku()) });
  const left = await fixture.context.Product.findById(created[0].json.product.id);
  const right = await fixture.context.Product.findById(released.json.product.id);
  const claimed = sku();
  const claim = await Promise.all([
    api("PATCH", `/api/admin/catalog/products/${left._id}`, { cookie: admin(), body: { variants: [{ id: String(left.variants[0]._id), sku: claimed, isActive: true }] } }),
    api("PATCH", `/api/admin/catalog/products/${right._id}`, { cookie: admin(), body: { variants: [{ id: String(right.variants[0]._id), sku: claimed, isActive: true }] } }),
  ]);
  const owners = await fixture.context.Product.find({ "variants.sku": claimed });
  const indexes = await fixture.context.Product.collection.indexes();
  const ok = created.length === 1 && pair.some((item) => item.status === 400)
    && released.status === 201 && claim.filter((item) => item.status === 200).length === 1
    && owners.length === 1
    && !indexes.some((index) => index.key && index.key["variants.sku"] === 1 && index.unique);
  record("F4-I05", ok ? "pass" : "fail", {
    pair: pair.map((item) => item.status), released: released.status, claim: claim.map((item) => item.status), owners: owners.length,
    indexes: indexes.map((index) => index.name),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});

test("F4-I06 alertas, filtros, permisos e historial exportado", async () => {
  const low = await make(5);
  const healthy = await make(6);
  const mixed = await make(0);
  await fixture.context.Product.collection.updateOne({ _id: mixed.product._id }, { $push: { variants: {
    _id: new fixture.context.mongoose.Types.ObjectId(), sku: sku(), stock: 12, isActive: true,
  } } });
  const hidden = await make(1);
  await fixture.context.Product.collection.updateOne({ _id: hidden.product._id }, { $set: { isActive: false, "variants.0.isActive": false, "variants.0.stock": 1 } });
  const named = await make(8);
  await fixture.context.Product.collection.updateOne({ _id: named.product._id }, { $set: { name: "Cliente [a].*+" } });
  const literal = await list(`q=${encodeURIComponent(".*")}`);
  const anchor = await list(`q=${encodeURIComponent("^")}`);
  const invalid = await list("stock=agotado");
  const badPage = await list("page=-1");
  const far = await list("page=40&limit=1");
  const page1 = await list("limit=1&page=1");
  const page2 = await list("limit=1&page=2");
  const lowList = await list("stock=low&limit=50");
  const alertBody = await alerts();
  const lowIds = new Set((alertBody.json.alerts.lowStock?.items || []).map((item) => String(item.id)));
  const outIds = new Set((alertBody.json.alerts.outOfStock?.items || []).map((item) => String(item.id)));
  const dashboard = await api("GET", "/api/admin/dashboard", { cookie: admin() });
  const movement = await adjust(low.product, low.variantId, 1, key(), admin(), "Sube de cinco a seis");
  const rows = await history(`sku=${low.product.variants[0].sku}&eventType=stock_adjustment&variantId=${low.variantId}`);
  const pdf = await api("GET", `/api/admin/inventory/history/export-pdf?sku=${low.product.variants[0].sku}`, { cookie: admin() });
  const emptyPdf = await api("GET", "/api/admin/inventory/history/export-pdf?sku=SKU-INEXISTENTE", { cookie: admin() });
  const vendorList = await list("limit=5", vendor());
  const vendorWrite = await adjust(low.product, low.variantId, 1, key(), vendor(), "No debe aplicar");
  const vendorProduct = await api("POST", "/api/admin/catalog/products", { cookie: vendor(), body: bodyFor(low.product, sku()) });
  const vendorPrice = await api("PATCH", `/api/admin/catalog/products/${low.product._id}`, { cookie: vendor(), body: { salePrice: 1, internalCost: 1 } });
  const vendorDelete = await api("DELETE", `/api/admin/catalog/products/${low.product._id}`, { cookie: vendor() });
  const vendorHistory = await history("", vendor());
  const client = await list("", fixture.context.clientCookie);
  const anonymous = await list("", "");
  const pending = await checkout(healthy.product, healthy.variantId, { paymentMethod: "wompi" });
  const deactivate = await api("DELETE", `/api/admin/catalog/products/${healthy.product._id}`, { cookie: admin() });
  const vendorText = JSON.stringify(vendorList.json);
  const outAndLow = [...lowIds].filter((id) => outIds.has(id));
  const ok = lowList.json.products.some((item) => item.id === String(low.product._id))
    && !lowList.json.products.some((item) => item.id === String(healthy.product._id))
    && lowIds.has(String(low.product._id)) && outIds.has(String(mixed.product._id)) && !lowIds.has(String(mixed.product._id))
    && !lowIds.has(String(hidden.product._id)) && !outIds.has(String(hidden.product._id))
    && outAndLow.length === 0
    && literal.json.total === 1 && anchor.json.total === 0 && invalid.status === 400 && badPage.status === 400
    && far.status === 200 && far.json.results === 0 && far.json.total >= 1
    && page1.json.products[0].id !== page2.json.products[0].id && page1.json.total === page2.json.total
    && movement.status === 200 && rows.json.total === 1 && rows.json.history[0].stockBefore === 5 && rows.json.history[0].stockAfter === 6
    && pdf.status === 200 && pdf.text.startsWith("%PDF") && emptyPdf.status === 200 && pdf.text.length > emptyPdf.text.length
    && vendorList.status === 200 && !vendorText.includes("424242") && !vendorText.includes("internalCost")
    && vendorWrite.status === 403 && vendorProduct.status === 403 && vendorPrice.status === 403
    && vendorDelete.status === 403 && vendorHistory.status === 403
    && client.status === 403 && anonymous.status === 401
    && pending.status === 201 && deactivate.status === 409
    && (await stockOf(low.product, low.variantId)) === 6;
  record("F4-I06", ok ? "pass" : "fail", {
    literal: literal.json.total, anchor: anchor.json.total, invalid: invalid.status, far: far.status,
    low: lowIds.has(String(low.product._id)), mixedOut: outIds.has(String(mixed.product._id)), overlap: outAndLow.length,
    dashboardLow: dashboard.json.dashboard?.catalog?.lowStock, alertsLow: alertBody.json.alerts.lowStock?.count,
    dashboardOut: dashboard.json.dashboard?.catalog?.outOfStock, alertsOut: alertBody.json.alerts.outOfStock?.count,
    vendor: [vendorWrite.status, vendorProduct.status, vendorPrice.status, vendorDelete.status, vendorHistory.status],
    client: client.status, anonymous: anonymous.status, deactivate: deactivate.status, pdf: pdf.status,
    pdfBytes: pdf.text.length, emptyPdfBytes: emptyPdf.text.length, history: rows.json.total,
    bounds: [rows.json.history?.[0]?.stockBefore, rows.json.history?.[0]?.stockAfter],
    pending: pending.status, finalStock: await stockOf(low.product, low.variantId),
    vendorList: vendorList.status, hiddenCost: vendorText.includes("424242") || vendorText.includes("internalCost"),
  });
  assert.equal(ok, true, JSON.stringify(results.at(-1).detail));
});
