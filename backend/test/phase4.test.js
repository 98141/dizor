"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const fixture = require("./helpers/phase2Fixture.cjs");
const Product = require("../src/models/product"), History = require("../src/models/productHistory"), StockAdjustment = require("../src/models/stockAdjustment"), Notification = require("../src/models/notification");
const criteria = require("../src/services/inventoryCriteria");
const api = (...args) => fixture.api(...args);
const list = (q = "", cookie = fixture.context.adminCookie) => api("GET", `/api/admin/catalog/products${q ? `?${q}` : ""}`, { cookie });
const get = (p, cookie = fixture.context.adminCookie) => api("GET", `/api/admin/catalog/products/${p._id}`, { cookie });
const update = (p, body, cookie = fixture.context.adminCookie) => api("PATCH", `/api/admin/catalog/products/${p._id}`, { cookie, body });
const adjust = (p, v, delta = 3, key = crypto.randomUUID(), cookie = fixture.context.adminCookie, reason = "Conteo físico ficticio") => api("POST", `/api/admin/catalog/products/${p._id}/stock`, { cookie, body: { variantId: String(v), delta, operationKey: key, reason } });
const history = (q = "", cookie = fixture.context.adminCookie) => api("GET", `/api/admin/inventory/history${q ? `?${q}` : ""}`, { cookie });
const make = async (stock = 10) => (await fixture.makeProduct(stock)).product;
const sku = () => "F4-" + crypto.randomUUID().slice(0, 12).toUpperCase();
const createBody = (p, overrides = {}) => ({ name: "Ficticio " + crypto.randomUUID(), category: String(p.category), salePrice: 80000,
  mainImage: "https://example.test/foto.jpg", images: [{ url: "https://example.test/foto.jpg" }], variants: [{ sku: sku(), stock: 5 }], ...overrides });
const postProduct = (body, cookie = fixture.context.adminCookie) => api("POST", "/api/admin/catalog/products", { cookie, body });
const checkout = async (p, method = "contra_entrega") => {
  const r = await api("POST", "/api/checkout/orders", { body: fixture.orderBody(p, p.variants[0]._id, { paymentMethod: method }) });
  assert.equal(r.status, 201, r.text); return fixture.context.Order.findById(r.json.order.id);
};
test.before(async () => { await fixture.setup(); await StockAdjustment.init(); await Notification.init(); });
test.beforeEach(async () => {
  await fixture.context.Order.deleteMany({}); await Notification.deleteMany({}); await History.deleteMany({}); await StockAdjustment.deleteMany({}); await Product.deleteMany({});
  process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED = "false";
});
test.after(async () => { try { assert.deepEqual(fixture.context.blocked, []); } finally { await fixture.close(); } });

test("V01 paginación permite consultar más de 100 productos sin descargarlos todos", async () => {
  const p = await make(); const body = p.toObject(); delete body._id; delete body.__v;
  await Product.insertMany(Array.from({ length: 104 }, (_, i) => ({ ...body, name: `Lote ${i}`, slug: `lote-${i}`, variants: [{ ...body.variants[0], _id: undefined, sku: sku() }] })));
  const r = await list("page=6&limit=20"); assert.equal(r.status, 200, r.text); assert.equal(r.json.total, 105); assert.equal(r.json.products.length, 5); assert.equal(r.json.totalPages, 6);
});
test("V02 búsqueda por nombre y caracteres especiales es literal", async () => {
  const p = await make(); await Product.updateOne({ _id: p._id }, { $set: { name: "Bolso [A+B].*" } });
  assert.equal((await list(`q=${encodeURIComponent("[A+B].*")}`)).json.total, 1);
  assert.equal((await list(`q=${encodeURIComponent("^$")}`)).json.total, 0);
});
test("V03 búsqueda por SKU encuentra la presentación", async () => {
  const p = await make(); await make(); const r = await list(`q=${p.variants[0].sku}`); assert.equal(r.json.total, 1); assert.equal(r.json.products[0].id, String(p._id));
});
test("V04 categorías, tejido y publicación se combinan en servidor", async () => {
  const p = await make(); const Category = require("../src/models/category"), Weave = require("../src/models/weaveType");
  const cat = await Category.create({ name: "Fase4 " + sku() }), weave = await Weave.create({ name: "Tejido " + sku() });
  await Product.updateOne({ _id: p._id }, { $set: { category: cat._id, weaveType: weave._id, isActive: false } }); await make();
  const r = await list(`category=${cat._id}&weaveType=${weave._id}&isActive=false`); assert.equal(r.json.total, 1); assert.equal(r.json.products[0].isActive, false);
});
test("V05 filtro de stock bajo observa cada variante y conserva total", async () => {
  const p = await make(3); const r = await list("stock=low"); assert.equal(r.json.total, 1); assert.equal(r.json.products[0].inventory.totalStock, 3); assert.equal(r.json.threshold, 5);
  assert.equal(r.json.products[0].id, String(p._id));
});
test("V06 agotado junto a otra variante disponible no se oculta por el total", async () => {
  const p = await make(10); p.variants.push({ sku: sku(), stock: 0 }); await p.save();
  const r = await list("stock=out"); assert.equal(r.json.total, 1); assert.equal(r.json.products[0].totalStock, 10); assert.equal(r.json.products[0].inventory.outCount, 1);
});
test("V07 variantes inactivas conservan unidades sin ofrecerlas como disponibles", async () => {
  const p = await make(10); p.variants[0].isActive = false; await p.save();
  const row = (await get(p)).json.product; assert.equal(row.totalStock, 0); assert.equal(row.variants[0].stock, 10); assert.equal(row.variants[0].stockStatus, "inactive"); assert.equal(row.inventory.unavailable, true);
});
test("V08 producto no publicado distingue existencias de disponibilidad para venta", async () => {
  const p = await make(10); await update(p, { isActive: false }); const row = (await get(p)).json.product;
  assert.equal(row.totalStock, 10); assert.equal(row.inventory.availableStock, 0); assert.equal(row.isActive, false);
});
test("V09 ajuste positivo registra stock, responsable, motivo y fecha", async () => {
  const p = await make(10); const r = await adjust(p, p.variants[0]._id); assert.equal(r.status, 200, r.text); assert.equal(r.json.stock, 13);
  const h = await History.findById(r.json.movementId); assert.equal(h.stockBefore, 10); assert.equal(h.stockAfter, 13); assert.equal(h.userEmail, "admin-cierre@example.test"); assert.ok(h.userId && h.createdAt); assert.equal(h.summary, "Conteo físico ficticio");
});
test("V10 ajuste negativo es relativo y no modifica precio", async () => {
  const p = await make(10); assert.equal((await adjust(p, p.variants[0]._id, -4)).json.stock, 6); const saved = await Product.findById(p._id); assert.equal(saved.salePrice, p.salePrice);
});
test("V11 fracciones, cero, cantidades inseguras y stock negativo se rechazan", async () => {
  const p = await make(2); for (const delta of [0, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal((await adjust(p, p.variants[0]._id, delta)).status, 400);
  assert.equal((await adjust(p, p.variants[0]._id, -3)).status, 409); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 2); assert.equal(await History.countDocuments(), 0);
});
test("V12 misma clave concurrente produce un solo movimiento", async () => {
  const p = await make(10), key = crypto.randomUUID(), v = p.variants[0]._id;
  const rs = await Promise.all([adjust(p, v, 3, key), adjust(p, v, 3, key), adjust(p, v, 3, key)]);
  assert.ok(rs.every((r) => r.status === 200), rs.map((r) => r.text).join("\n")); assert.equal(await fixture.stockOf(p, v), 13); assert.equal(await History.countDocuments({ movementKey: key }), 1);
});
test("V13 una clave no puede cambiar cantidad, motivo, actor o variante", async () => {
  const p = await make(), key = crypto.randomUUID(), v = p.variants[0]._id; await adjust(p, v, 1, key);
  assert.equal((await adjust(p, v, 2, key)).status, 409); assert.equal((await adjust(p, v, 1, key, fixture.context.adminCookie, "Otro motivo")).status, 409);
  assert.equal((await adjust(p, v, 1, key, fixture.context.superCookie)).status, 409);
});
test("V14 dos administradores no se sobrescriben al ajustar simultáneamente", async () => {
  const p = await make(), v = p.variants[0]._id;
  const rs = await Promise.all([adjust(p, v, 5), adjust(p, v, -2, crypto.randomUUID(), fixture.context.superCookie)]);
  assert.ok(rs.every((r) => r.status === 200)); assert.equal(await fixture.stockOf(p, v), 13); assert.equal(await History.countDocuments({ productId: p._id }), 2);
});
test("V15 venta concurrente con ajuste conserva saldo e historial", async () => {
  const p = await make(10), v = p.variants[0]._id;
  await Promise.all([checkout(p), adjust(p, v, 5)]); assert.equal(await fixture.stockOf(p, v), 14);
  const sum = await History.aggregate([{ $match: { productId: p._id } }, { $group: { _id: null, n: { $sum: "$quantityChange" } } }]); assert.equal(sum[0].n, 4);
});
test("V16 formulario abierto antes de una venta nunca repone stock absoluto", async () => {
  const p = await make(10); const snapshot = (await get(p)).json.product; await checkout(p);
  const r = await update(p, { shortDescription: "Descripción nueva", variants: snapshot.variants }); assert.equal(r.status, 200, r.text); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 9);
});
test("V17 edición y venta simultáneas conservan ID y existencias", async () => {
  const p = await make(10), snapshot = (await get(p)).json.product;
  const [r] = await Promise.all([update(p, { name: "Editado " + sku(), variants: snapshot.variants }), checkout(p)]);
  assert.equal(r.status, 200, r.text); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 9); assert.equal(String((await Product.findById(p._id)).variants[0]._id), String(p.variants[0]._id));
});
test("V18 una presentación nueva admite stock inicial entero y genera evidencia atómica", async () => {
  const p = await make(); const before = (await get(p)).json.product;
  const r = await update(p, { variants: [...before.variants, { sku: sku(), stock: 7 }] }); assert.equal(r.status, 200, r.text);
  assert.equal(r.json.product.variants.length, 2); const h = await History.findOne({ productId: p._id, quantityChange: 7 }); assert.equal(h.stockBefore, 0); assert.equal(h.stockAfter, 7);
});
test("V19 producto sin talla ni color usa su SKU real y funciona en checkout", async () => {
  const p = await make(); const r = await postProduct(createBody(p)); assert.equal(r.status, 201, r.text);
  const generic = await Product.findById(r.json.product.id); assert.equal(generic.variants[0].size, null); assert.equal(generic.variants[0].color, null); await checkout(generic); assert.equal(await fixture.stockOf(generic, generic.variants[0]._id), 4);
});
test("V20 SKU duplicado se rechaza entre productos y dentro del producto", async () => {
  const p = await make(); assert.equal((await postProduct(createBody(p, { variants: [{ sku: p.variants[0].sku, stock: 1 }] }))).status, 400);
  assert.equal((await postProduct(createBody(p, { variants: [{ sku: "DUPLICADO", stock: 1 }, { sku: "DUPLICADO", stock: 2, isActive: false }] }))).status, 400);
});
test("V21 dos altas concurrentes no pueden apropiarse del mismo SKU", async () => {
  const p = await make(), code = sku(); const rs = await Promise.all([postProduct(createBody(p, { variants: [{ sku: code, stock: 1 }] })), postProduct(createBody(p, { variants: [{ sku: code, stock: 1 }] }))]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 400]); assert.equal(await Product.countDocuments({ "variants.sku": code }), 1);
});
test("V22 combinaciones activas repetidas se rechazan sin eliminar histórico", async () => {
  const p = await make(); const snapshot = (await get(p)).json.product;
  assert.equal((await update(p, { variants: [...snapshot.variants, { size: snapshot.variants[0].size, color: snapshot.variants[0].color, sku: sku(), stock: 1 }] })).status, 400);
  assert.equal((await Product.findById(p._id)).variants.length, 1);
});
test("V23 historial filtra producto, variante, SKU, tipo y responsable", async () => {
  const p = await make(); const r = await adjust(p, p.variants[0]._id, 2); const h = await History.findById(r.json.movementId);
  const result = await history(`productId=${p._id}&variantId=${p.variants[0]._id}&sku=${p.variants[0].sku}&movementKind=restock&userId=${h.userId}`);
  assert.equal(result.status, 200, result.text); assert.equal(result.json.total, 1); assert.equal(result.json.history[0].userId, String(h.userId));
  await History.collection.insertOne({ productId: p._id, productName: "Registro histórico ficticio", eventType: "legacy_stock_count", quantityChange: 0, createdAt: new Date() });
  assert.equal((await history("eventType=legacy_stock_count")).json.total, 1);
});
test("V24 retiros y restauración por cancelación no se confunden", async () => {
  const p = await make(); await adjust(p, p.variants[0]._id, -1); const o = await checkout(p);
  assert.equal((await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: fixture.context.adminCookie, body: { orderStatus: "cancelado" } })).status, 200);
  assert.equal((await history("movementKind=withdrawal")).json.total, 1); assert.equal((await history("movementKind=restoration")).json.total, 1); assert.equal((await history("movementKind=sale")).json.total, 1);
});
test("V25 DELETE desactiva sin borrar producto ni impedir un pedido ya surtido", async () => {
  const p = await make(); const o = await checkout(p); const before = await fixture.context.Order.collection.findOne({ _id: o._id });
  const r = await api("DELETE", `/api/admin/catalog/products/${p._id}`, { cookie: fixture.context.adminCookie }); assert.equal(r.status, 200, r.text); assert.equal((await Product.findById(p._id)).isActive, false);
  assert.deepEqual(await fixture.context.Order.collection.findOne({ _id: o._id }), before);
  assert.equal((await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: fixture.context.adminCookie, body: { orderStatus: "en_preparacion" } })).status, 200);
});
test("V26 Wompi pendiente protege el producto y la variante antes de aplicar inventario", async () => {
  const p = await make(); await checkout(p, "wompi");
  assert.equal((await update(p, { isActive: false })).status, 409);
  const before = (await get(p)).json.product; before.variants[0].isActive = false; assert.equal((await update(p, { variants: before.variants })).status, 409);
  assert.equal((await Product.findById(p._id)).isActive, true); assert.equal((await Product.findById(p._id)).variants[0].isActive, true);
});
test("V27 omitir variante conserva su ID y permite restauración histórica", async () => {
  const p = await make(); const o = await checkout(p); assert.equal((await update(p, { variants: [] })).status, 200);
  const saved = await Product.findById(p._id); assert.equal(String(saved.variants[0]._id), String(p.variants[0]._id)); assert.equal(saved.variants[0].isActive, false);
  await api("PATCH", `/api/admin/orders/${o._id}/status`, { cookie: fixture.context.adminCookie, body: { orderStatus: "cancelado" } }); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 10);
});
test("V28 vendedor consulta sin costos y recibe 403 en todas las escrituras", async () => {
  const p = await make(), cookie = fixture.context.vendorCookie;
  assert.equal((await get(p, cookie)).json.product.internalCost, undefined); assert.equal((await list("", cookie)).json.products[0].internalCost, undefined);
  for (const r of [await update(p, { salePrice: 1 }, cookie), await adjust(p, p.variants[0]._id, 1, crypto.randomUUID(), cookie), await api("DELETE", `/api/admin/catalog/products/${p._id}`, { cookie }), await postProduct(createBody(p), cookie), await history("", cookie)]) assert.equal(r.status, 403);
});
test("V29 cliente y anónimo no consultan catálogo administrativo ni recuperación", async () => {
  const p = await make(); assert.equal((await list("", fixture.context.clientCookie)).status, 403); assert.equal((await api("GET", "/api/admin/catalog/products")).status, 401);
  assert.equal((await api("GET", `/api/admin/catalog/products/${p._id}/stock-operations/${crypto.randomUUID()}`, { cookie: fixture.context.vendorCookie })).status, 403);
});
test("V30 lista, resumen y alertas coinciden por variante sin entradas duplicadas", async () => {
  const p = await make(10); p.variants.push({ sku: sku(), stock: 0 }); await p.save();
  const r = await list("stock=out&isActive=true"); const inv = await api("GET", "/api/admin/catalog/products/inventory?stock=out", { cookie: fixture.context.adminCookie });
  const alerts = (await api("GET", "/api/admin/alerts", { cookie: fixture.context.adminCookie })).json.alerts;
  assert.equal(r.json.total, 1); assert.equal(inv.json.total, 1); assert.equal(alerts.outOfStock.count, 1); assert.equal(alerts.lowStock.count, 0);
  assert.equal(alerts.outOfStock.items[0].affectedVariants[0].id, String(p.variants[1]._id));
});
test("V31 umbral cinco, inactivas y stock suficiente comparten criterio", async () => {
  const p = await make(5); assert.equal((await list("stock=low")).json.total, 1);
  await adjust(p, p.variants[0]._id, 1); assert.equal((await list("stock=healthy")).json.total, 1);
  assert.equal(criteria.variantStatus({ isActive: false, stock: 0 }), "inactive");
});
test("V32 stock histórico fraccionario requiere revisión y nunca se redondea", async () => {
  const p = await make(); await Product.collection.updateOne({ _id: p._id }, { $set: { "variants.0.stock": 10.5 } });
  assert.equal((await list("stock=review")).json.total, 1); assert.equal((await adjust(p, p.variants[0]._id, 1)).status, 409); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 10.5);
  assert.equal((await list("stock=available")).json.total, 0);
  await Product.collection.updateOne({ _id: p._id }, { $unset: { "variants.0.stock": "" } });
  assert.equal((await get(p)).json.product.variants[0].stock, undefined);
  assert.equal((await adjust(p, p.variants[0]._id, 1)).status, 409);
  assert.equal(Object.hasOwn((await Product.collection.findOne({ _id: p._id })).variants[0], "stock"), false);
});
test("V33 consulta de operación recupera un resultado aceptado sin otro movimiento", async () => {
  const p = await make(), key = crypto.randomUUID(); await adjust(p, p.variants[0]._id, 3, key); await adjust(p, p.variants[0]._id, -2);
  const r = await api("GET", `/api/admin/catalog/products/${p._id}/stock-operations/${key}`, { cookie: fixture.context.adminCookie });
  assert.equal(r.json.found, true); assert.equal(r.json.stock, 13); assert.equal(r.json.currentStock, 11);
  const repeated = await adjust(p, p.variants[0]._id, 3, key); assert.equal(repeated.json.currentStock, 11); assert.equal(await History.countDocuments({ movementKey: key }), 1);
});
test("V34 rechazo persistido impide una aplicación tardía de la misma intención", async () => {
  const p = await make(1), key = crypto.randomUUID(); assert.equal((await adjust(p, p.variants[0]._id, -2, key)).json.operationRejected, true);
  await adjust(p, p.variants[0]._id, 10); const r = await adjust(p, p.variants[0]._id, -2, key); assert.equal(r.status, 409); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 11);
  const verify = await api("GET", `/api/admin/catalog/products/${p._id}/stock-operations/${key}`, { cookie: fixture.context.adminCookie }); assert.equal(verify.json.rejected, true); assert.equal(await History.countDocuments({ movementKey: key }), 0);
});
test("V35 fallo de historial revierte ajuste; reintento conserva clave y aplica una vez", async () => {
  const p = await make(), key = crypto.randomUUID(), original = History.create; let fail = true;
  History.create = function (...args) { if (fail) { fail = false; throw new Error("Fallo ficticio"); } return original.apply(this, args); };
  try { assert.equal((await adjust(p, p.variants[0]._id, 3, key)).status, 500); } finally { History.create = original; }
  assert.equal(await fixture.stockOf(p, p.variants[0]._id), 10); assert.equal((await adjust(p, p.variants[0]._id, 3, key)).status, 200); assert.equal(await fixture.stockOf(p, p.variants[0]._id), 13);
});
test("V36 edición de precio y stock inicial nuevo tienen historial transaccional", async () => {
  const p = await make(), original = History.create; History.create = () => { throw new Error("Historial no disponible"); };
  try { assert.equal((await update(p, { salePrice: 50000 })).status, 500); } finally { History.create = original; }
  assert.equal((await Product.findById(p._id)).salePrice, p.salePrice);
});
test("V37 fechas de movimientos usan días colombianos e IDs inválidos se rechazan", async () => {
  const p = await make(); const r = await adjust(p, p.variants[0]._id); await History.collection.updateOne({ _id: new fixture.context.mongoose.Types.ObjectId(r.json.movementId) }, { $set: { createdAt: new Date("2026-11-21T04:59:59Z") } });
  assert.equal((await history("from=2026-11-20&to=2026-11-20")).json.total, 1);
  assert.equal((await history("from=2026-02-30")).status, 400); assert.equal((await history("productId=bad")).status, 400); assert.equal((await list("limit=-3")).status, 400);
});
test("V38 exportación PDF y sus filtros siguen disponibles", async () => {
  const p = await make(); await adjust(p, p.variants[0]._id);
  const r = await api("GET", `/api/admin/inventory/history/export-pdf?productId=${p._id}`, { cookie: fixture.context.adminCookie }); assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /pdf/);
});
test("V39 imágenes, precios y SKU obligatorios muestran rechazo controlado", async () => {
  const p = await make(); for (const body of [createBody(p, { salePrice: -1 }), createBody(p, { images: [] }), createBody(p, { variants: [{ stock: 1 }] }), createBody(p, { mainImage: "https://example.test/otra.jpg" })]) assert.equal((await postProduct(body)).status, 400);
});
test("V40 no se pueden reciclar IDs ni SKU de una variante conservada", async () => {
  const p = await make(), old = (await get(p)).json.product.variants[0];
  assert.equal((await update(p, { variants: [{ sku: old.sku, stock: 2 }] })).status, 400);
  assert.equal((await update(p, { variants: [old, { ...old, sku: sku() }] })).status, 400);
});
test("V41 altas y consultas de catálogo no activan notificaciones ni alteran pedidos", async () => {
  const p = await make(); const o = await checkout(p, "wompi"); const before = await fixture.context.Order.collection.findOne({ _id: o._id }), n = await Notification.countDocuments();
  await list(); await get(p); await history(); await update(p, { shortDescription: "Solo catálogo" });
  assert.deepEqual(await fixture.context.Order.collection.findOne({ _id: o._id }), before); assert.equal(await Notification.countDocuments(), n); assert.equal(process.env.TRANSACTIONAL_NOTIFICATIONS_ENABLED, "false");
});
test("V42 volumen ficticio: página acotada y plan de consulta reproducible", async () => {
  const p = await make(); const raw = p.toObject(); delete raw._id; delete raw.__v;
  const Size = require("../src/models/size");
  const sizes = [raw.variants[0].size, ...(await Size.create([{ name: "Volumen M " + sku() }, { name: "Volumen L " + sku() }])).map((s) => s._id)];
  await Product.insertMany(Array.from({ length: 1200 }, (_, i) => ({ ...raw, name: `Volumen ${String(i).padStart(4, "0")}`, slug: `volumen-${i}`, variants: sizes.map((size, j) => ({ ...raw.variants[0], _id: undefined, size, sku: `VOL-${i}-${j}`, stock: i % 3 === 0 ? 0 : i % 3 === 1 ? 3 : 20 })) })));
  let pipeline; const original = Product.aggregate; Product.aggregate = function (stages, ...args) { pipeline = stages; return original.call(this, stages, ...args); };
  const start = performance.now(); let r;
  try { r = await list(`q=Volumen&category=${p.category}&stock=low&page=3&limit=20`); } finally { Product.aggregate = original; }
  const elapsedMs = performance.now() - start; assert.equal(r.status, 200, r.text); assert.equal(r.json.total, 400); assert.equal(r.json.products.length, 20);
  const plan = await Product.aggregate(pipeline).explain("executionStats");
  fs.writeFileSync(path.resolve(__dirname, "../../docs/auditoria-admin/fase4-evidencias/rendimiento.json"), JSON.stringify({ products: 1201, variants: 3601, returned: 20, totalMatches: 400, elapsedMs, plan, note: "Datos ficticios locales; sin índices nuevos. El explain reproduce el pipeline agregado, sin el populate posterior." }, null, 2));
});
