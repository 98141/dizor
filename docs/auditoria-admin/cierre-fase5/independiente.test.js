"use strict";
// Auditoría independiente de Fase 5. No modifica la aplicación ni las pruebas de Codex.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fixture = require("../../../backend/test/helpers/phase2Fixture.cjs");

const out = __dirname;
const results = [];
const record = (id, verdict, detail) => results.push({ id, verdict, detail });
const api = (...args) => fixture.api(...args);

test.before(async () => {
  await fixture.setup();
});
test.after(async () => {
  fs.writeFileSync(path.join(out, "independiente-resultados.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  await fixture.close();
});

test("F5-I01 menú por rol y selección con parámetros no previstos", async () => {
  const nav = await import(pathToFileURL(path.resolve(out, "../../../frontend/src/lib/adminNavigation.mjs")).href);
  const labels = (role, variant) => nav.getNavigation(role, variant).map((m) => m.label);
  assert.deepEqual(labels("superadmin"), ["Inicio", "Pedidos", "Productos", "Atención al cliente", "Tienda online", "Marketing", "Finanzas", "Configuración"]);
  assert.deepEqual(labels("admin"), ["Inicio", "Pedidos", "Productos", "Atención al cliente", "Tienda online", "Marketing", "Configuración"]);
  assert.deepEqual(labels("vendedor", "admin"), ["Inicio", "Pedidos", "Solicitudes"]);
  assert.deepEqual(nav.getNavigation("vendedor", "admin").map((m) => m.href), ["/vendedor", "/vendedor/pedidos", "/admin/solicitudes"]);
  assert.equal(nav.getNavigation("admin", "vendedor").some((m) => m.id === "finance" || m.id === "products"), false);
  const bare = nav.locateNavigation("/admin/contenido", "tab=exports", "admin");
  const newsletter = nav.locateNavigation("/admin/contenido", "tab=exports&scope=newsletter&extra=1", "admin");
  const unknown = nav.contentTab("tab<script>", "popup");
  const historical = nav.contentHref("resenas", "term=conservar&from=correo&tab=popup");
  const parsed = new URL(historical, "http://local.test");
  assert.equal(parsed.pathname, "/admin/contenido");
  assert.equal(parsed.searchParams.get("tab"), "resenas");
  assert.equal(parsed.searchParams.get("term"), "conservar");
  assert.equal(parsed.searchParams.get("from"), "correo");
  assert.equal(nav.returnToRequests("/admin/solicitudes?q=NAV&page=2&status=pendiente"), "/admin/solicitudes?q=NAV&page=2&status=pendiente");
  assert.equal(nav.returnToRequests("/admin/solicitudes/../usuarios"), "/admin/solicitudes");
  record("F5-I01", "observado", {
    exportsSinAmbito: { module: bare.module?.id, child: bare.child?.id || null },
    exportsNewsletter: { module: newsletter.module?.id, child: newsletter.child?.id || null },
    unknownTabFallback: unknown.id,
  });
});

test("F5-I02 autorización real de exportaciones y finanzas", async () => {
  const ctx = fixture.context;
  const urls = [
    "/api/admin/finance/export/csv",
    "/api/admin/finance/export/xlsx",
    "/api/admin/finance/export/pdf",
    "/api/admin/finance/products",
    "/api/admin/marketing/orders/export?tray=prepare",
    "/api/admin/marketing/newsletter/export",
    "/api/admin/marketing/abandoned-carts/export",
  ];
  const matrix = {};
  for (const url of urls) {
    matrix[url] = {
      vendor: (await api("GET", url, { cookie: ctx.vendorCookie })).status,
      admin: (await api("GET", url, { cookie: ctx.adminCookie })).status,
      anonymous: (await api("GET", url)).status,
    };
  }
  for (const url of urls.filter((u) => u.includes("/finance/"))) {
    assert.equal(matrix[url].vendor, 403, url);
    assert.equal(matrix[url].admin, 403, url);
    assert.equal(matrix[url].anonymous, 401, url);
  }
  for (const url of urls.filter((u) => u.includes("/marketing/"))) {
    assert.equal(matrix[url].vendor, 403, url);
    assert.equal(matrix[url].admin, 200, url);
    assert.equal(matrix[url].anonymous, 401, url);
  }
  const orders = await api("GET", "/api/admin/marketing/orders/export?tray=prepare&q=inexistente", { cookie: ctx.adminCookie });
  assert.equal(orders.status, 200);
  assert.match(String(orders.headers.get("content-type") || ""), /csv|text/i);
  const csv = orders.text || "";
  assert.match(csv, /orderNumber|buyerEmail/i);
  record("F5-I02", "aprobado", { matrix, orderExportIgnoresTray: true, csvBytes: Buffer.byteLength(csv) });
});

test("F5-I03 guardar impuestos no altera envío, transportadoras ni pagos", async () => {
  const ctx = fixture.context;
  const before = (await api("GET", "/api/admin/settings", { cookie: ctx.adminCookie })).json.settings;
  const patch = await api("PATCH", "/api/admin/settings", {
    cookie: ctx.adminCookie,
    body: { taxEnabled: false, taxRate: 0 },
  });
  assert.equal(patch.status, 200);
  const after = patch.json.settings;
  for (const field of ["shippingMode", "shippingFixedCost", "freeShippingMinAmount", "carriers"]) {
    assert.deepEqual(after[field], before[field], field);
  }
  assert.equal(after.shippingIncluded, true);
  assert.deepEqual(after.activeCarriers, before.activeCarriers);
  assert.equal(JSON.stringify(after).includes("nequi"), false);
  const crafted = await api("PATCH", "/api/admin/settings", {
    cookie: ctx.adminCookie,
    body: { shippingMode: "fixed", shippingFixedCost: 1, carriers: ["nequi"] },
  });
  assert.equal(crafted.status, 200);
  const { getShippingCost } = require("../../../backend/src/services/settingsService");
  const StoreSettings = require("../../../backend/src/models/storeSettings");
  const stored = await StoreSettings.findOne({ key: "default" }).lean();
  record("F5-I03", crafted.json.settings.shippingIncluded === true && getShippingCost(stored, 100000, "Antioquia") === 0 ? "observado" : "fallo", {
    effectiveIncluded: crafted.json.settings.shippingIncluded,
    storedMode: stored.shippingMode,
    storedCost: stored.shippingFixedCost,
    storedCarriers: stored.carriers,
    checkoutCost: getShippingCost(stored, 100000, "Antioquia"),
  });
  await api("PATCH", "/api/admin/settings", {
    cookie: ctx.adminCookie,
    body: { shippingMode: before.shippingMode, shippingFixedCost: before.shippingFixedCost, carriers: before.carriers },
  });
});

test("F5-I04 vendedor opera solicitudes y no abre módulos restringidos", async () => {
  const ctx = fixture.context;
  const SpecialRequest = require("../../../backend/src/models/specialRequest");
  const created = await SpecialRequest.create({
    requestNumber: "AUD-NAV-001",
    type: "customization",
    status: "pendiente",
    contact: { name: "Cliente auditoria", email: "auditoria@example.test", phone: "3000000000" },
    estimatedQuantity: 2,
  });
  const updated = await api("PATCH", `/api/admin/special-requests/${created._id}/status`, {
    cookie: ctx.vendorCookie,
    body: { status: "en_revision", note: "Revision local de auditoria" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.request.status, "en_revision");
  const finance = await api("GET", "/api/admin/finance/overview", { cookie: ctx.vendorCookie });
  const users = await api("GET", "/api/admin/users", { cookie: ctx.vendorCookie });
  const stock = await api("POST", "/api/admin/catalog/products/000000000000000000000000/stock", {
    cookie: ctx.vendorCookie,
    body: { variantId: "000000000000000000000000", delta: 1 },
  });
  const direct = await api("GET", `/api/admin/special-requests/${created._id}`, { cookie: ctx.vendorCookie });
  assert.equal(finance.status, 403);
  assert.equal(users.status, 403);
  assert.equal(stock.status, 403);
  assert.equal(direct.status, 200);
  record("F5-I04", "aprobado", { status: updated.status, finance: finance.status, users: users.status, stock: stock.status, direct: direct.status });
});

test("F5-I05 servicios de pedido, inventario y comunicaciones no cambiaron de contrato", async () => {
  const { product, variantId } = await fixture.makeProduct(6);
  const order = await api("POST", "/api/checkout/orders", { body: fixture.orderBody(product, variantId) });
  assert.equal(order.status, 201);
  const id = order.json.order.id;
  const prepared = await api("PATCH", `/api/admin/orders/${id}/status`, {
    cookie: fixture.context.vendorCookie,
    body: { orderStatus: "en_preparacion" },
  });
  assert.equal(prepared.status, 200);
  const adjust = await api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
    cookie: fixture.context.adminCookie,
    body: { variantId: String(variantId), delta: 1, operationKey: "aud-fase5-" + id, reason: "Conteo de auditoria" },
  });
  assert.equal(adjust.status, 200);
  const replay = await api("POST", `/api/admin/catalog/products/${product._id}/stock`, {
    cookie: fixture.context.adminCookie,
    body: { variantId: String(variantId), delta: 1, operationKey: "aud-fase5-" + id, reason: "Conteo de auditoria" },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.json.repeated, true);
  const notes = await api("GET", `/api/admin/orders/${id}/communications`, { cookie: fixture.context.adminCookie });
  assert.equal(notes.status, 200);
  assert.ok(Array.isArray(notes.json.notifications));
  record("F5-I05", "aprobado", { order: order.status, prepared: prepared.status, adjust: adjust.status, replay: replay.json.repeated, notifications: notes.json.notifications.length });
});
