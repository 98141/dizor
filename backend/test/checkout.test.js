"use strict";
// Replica set local, claves ficticias, proveedor sandbox simulado y red externa
// bloqueada por el mismo arnés que las regresiones de Wompi existentes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../../docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/fixture-claude.cjs");
test.before(async () => { await fixture.setup(); });
test.after(async () => { await fixture.close(); });

test("checkout público no ofrece transportadoras y mantiene los dos medios", async () => {
  const response = await fixture.api("GET", "/api/checkout/config");
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.json.config, "carriers"), false);
  assert.deepEqual(response.json.config.paymentMethods.map((m) => m.id), ["wompi", "contra_entrega"]);
  assert.equal(response.json.config.shippingIncluded, true);
  assert.equal(response.json.config.municipalities.length, 1122);
  assert.equal(response.json.config.municipalityCatalog.datasetId, "gdxc-w37w");
});

test("el resumen inicial se calcula sin preseleccionar departamento", async () => {
  const product = await fixture.makeProduct(5);
  const body = fixture.orderBody(product);
  const response = await fixture.api("POST", "/api/checkout/calculate", { body: { items: body.items, department: "" } });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.json.totals.shippingCost, 0);
});

test("crear compra exige pareja del catálogo y conserva el contrato sin campos logísticos nuevos", async () => {
  const product = await fixture.makeProduct(10);
  const before = await fixture.M.Order.countDocuments();
  const links = fixture.provider.links.size;
  for (const [city, department] of [["Sandoná", "Antioquia"], ["Bogotá", "Cundinamarca"], ["Ciudad inventada", "Nariño"], ["San Pedro", ""], ["", "Nariño"], [{ id: "52683" }, "Nariño"]]) {
    const response = await fixture.createOrder(product, { shippingAddress: { address: "Calle de prueba", city, department } });
    assert.equal(response.status, 400, response.text);
    assert.equal(response.json.message, "Selecciona una ciudad o municipio de la lista");
  }
  assert.equal(await fixture.M.Order.countDocuments(), before);
  assert.equal(fixture.provider.links.size, links);
  assert.equal(await fixture.stockOf(product), 10);
  for (const [city, department, savedCity, savedDepartment] of [
    ["sandona", "NARINO", "Sandoná", "Nariño"],
    ["Bogota", "Bogota D.C.", "Bogotá, D.C.", "Bogotá, D.C."],
  ]) {
    const response = await fixture.createOrder(product, { paymentMethod: "contra_entrega", carrier: "servientrega", customerNotes: "Conservar nota",
      shippingAddress: { address: "Carrera de prueba", city, department, postalCode: "520001", country: "Colombia" } });
    assert.equal(response.status, 201, response.text);
    const order = await fixture.fresh(response.json.order.id);
    assert.deepEqual(order.shippingAddress, { address: "Carrera de prueba", city: savedCity, department: savedDepartment, postalCode: "520001", country: "Colombia" });
    assert.equal(order.carrier, "");
    assert.equal(order.customerNotes, "Conservar nota");
    const detail = await fixture.api("GET", `/api/admin/orders/${order._id}`, { cookie: fixture.cookies.admin });
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.json.order.shippingAddress.city, savedCity);
    assert.equal(detail.json.order.shippingAddress.department, savedDepartment);
  }
});

test("las banderas históricas de Nequi no habilitan otros medios públicos", async () => {
  const keys = ["NEQUI_DIRECT_ENABLED", "NEQUI_MANUAL_ENABLED", "NEQUI_ENV"];
  const previous = keys.map((key) => process.env[key]);
  try {
    Object.assign(process.env, { NEQUI_DIRECT_ENABLED: "true", NEQUI_MANUAL_ENABLED: "true", NEQUI_ENV: "mock" });
    const response = await fixture.api("GET", "/api/checkout/config");
    assert.deepEqual(response.json.config.paymentMethods.map((m) => m.id), ["wompi", "contra_entrega"]);
    const product = await fixture.makeProduct(5);
    for (const paymentMethod of ["nequi_api", "nequi_manual"]) {
      const response = await fixture.createOrder(product, { paymentMethod });
      assert.equal(response.status, 400, response.text);
    }
    assert.equal(await fixture.stockOf(product), 5);
  } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});

for (const authenticated of [false, true]) for (const paymentMethod of ["contra_entrega", "wompi"]) {
  test(`${authenticated ? "cliente" : "invitado"}: ${paymentMethod} sin transportadora conserva dirección y reglas de pago`, async () => {
    const product = await fixture.makeProduct(5);
    const body = fixture.orderBody(product, { paymentMethod,
      shippingAddress: { address: "Calle 10 # 2-30", city: "Pasto", department: "Nariño", postalCode: "520001", country: "Colombia" } });
    delete body.carrier;
    const response = await fixture.api("POST", "/api/checkout/orders", { body, cookie: authenticated ? fixture.cookies.client : undefined });
    assert.equal(response.status, 201, response.text);
    const order = await fixture.fresh(response.json.order.id);
    assert.equal(order.carrier, "");
    assert.deepEqual(order.shippingAddress, body.shippingAddress);
    assert.equal(order.isGuest, !authenticated);
    assert.equal(String(order.user), authenticated ? String(fixture.users.client._id) : "null");
    assert.equal(order.paymentStatus, "pendiente");
    assert.equal(order.orderStatus, paymentMethod === "wompi" ? "pago_pendiente" : "pendiente");
    assert.equal(order.stockDeducted, paymentMethod === "contra_entrega");
    assert.equal(await fixture.stockOf(product), paymentMethod === "wompi" ? 5 : 4);
    assert.equal(order.shippingCost, 0);
    const detail = await fixture.api("GET", `/api/admin/orders/${order._id}`, { cookie: fixture.cookies.admin });
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.json.order.carrier, "");
    if (paymentMethod === "wompi") {
      assert.match(response.json.paymentUrl, /^https:\/\/checkout\.wompi\.co\/l\//);
      const link = fixture.provider.links.get(order.wompi.paymentLinkId);
      assert.equal(link.currency, "COP");
      assert.equal(link.amount_in_cents, order.total * 100);
      assert.equal(link.collect_shipping, false);
      assert.match(link.redirect_url, /pedido\/confirmacion\?order=.+&payment=wompi$/);
      const lookup = await fixture.api("POST", "/api/checkout/orders/lookup", {
        body: { orderNumber: order.orderNumber, accessToken: response.json.accessToken, payment: "approved", status: "APPROVED" },
      });
      assert.equal(lookup.status, 200, lookup.text);
      assert.equal(lookup.json.order.paymentStatus, "pendiente");
      assert.equal((await fixture.fresh(order._id)).stockDeducted, false);
    }
  });
}

test("transportadoras enviadas por clientes antiguos o manipulados se ignoran, también en reintentos", async () => {
  for (const carrier of ["interrapidisimo", "servientrega", "envia", "coordinadora", "inventada", { $ne: "" }]) {
    const product = await fixture.makeProduct(5);
    const body = fixture.orderBody(product, { paymentMethod: "contra_entrega", carrier,
      shippingAddress: { address: "Dirección conservada", city: "Bogotá, D.C.", department: "Bogotá, D.C.", postalCode: "110111" } });
    const response = await fixture.api("POST", "/api/checkout/orders", { body });
    assert.equal(response.status, 201, response.text);
    const order = await fixture.fresh(response.json.order.id);
    assert.equal(order.carrier, "");
    assert.equal(order.shippingAddress.address, body.shippingAddress.address);
    assert.equal(order.shippingAddress.postalCode, "110111");
    const replay = await fixture.api("POST", "/api/checkout/orders", { body: { ...body, carrier: "otra" } });
    assert.equal(replay.status, 200, replay.text);
    assert.equal(replay.json.order.id, response.json.order.id);
    assert.equal(await fixture.stockOf(product), 4);
  }
});

test("administración abre pendientes de asignación, asigna al despachar y conserva históricos", async () => {
  const product = await fixture.makeProduct(5);
  const response = await fixture.createOrder(product, { paymentMethod: "contra_entrega", carrier: undefined });
  const id = response.json.order.id;
  assert.equal((await fixture.api("PATCH", `/api/admin/orders/${id}/status`, {
    cookie: fixture.cookies.admin, body: { orderStatus: "en_preparacion" },
  })).status, 200);
  const assigned = await fixture.api("PATCH", `/api/admin/orders/${id}/shipping`, {
    cookie: fixture.cookies.admin, body: { carrier: "servientrega", trackingNumber: "GUIA-FICTICIA" },
  });
  assert.equal(assigned.status, 200, assigned.text);
  for (const carrier of ["servientrega", "interrapidisimo", "envia", "coordinadora"]) {
    // Simula pedidos históricos persistidos antes de este cambio.
    await fixture.M.Order.updateOne({ _id: id }, { $set: { carrier } });
    const detail = await fixture.api("GET", `/api/admin/orders/${id}`, { cookie: fixture.cookies.admin });
    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.json.order.carrier, carrier);
    assert.equal(detail.json.order.trackingNumber, "GUIA-FICTICIA");
    const tracking = await fixture.api("POST", "/api/checkout/track", {
      body: { orderNumber: detail.json.order.orderNumber, email: detail.json.order.buyer.email },
    });
    assert.equal(tracking.status, 200, tracking.text);
    assert.equal(tracking.json.order.carrier, carrier);
  }
});

test("envíos concurrentes con la misma clave crean una compra y un solo efecto financiero", async () => {
  for (const paymentMethod of ["contra_entrega", "wompi"]) {
    const product = await fixture.makeProduct(5);
    const body = fixture.orderBody(product, { paymentMethod, carrier: undefined });
    const countLinks = fixture.provider.links.size;
    const responses = await Promise.all([1, 2].map(() => fixture.api("POST", "/api/checkout/orders", { body })));
    assert(responses.some((r) => r.status === 201), JSON.stringify(responses));
    assert(responses.every((r) => [200, 201, 409].includes(r.status)));
    assert.equal(await fixture.M.Order.countDocuments({ idempotencyKey: body.idempotencyKey }), 1);
    const replay = await fixture.api("POST", "/api/checkout/orders", { body });
    assert.equal(replay.status, 200, replay.text);
    assert.equal(await fixture.stockOf(product), paymentMethod === "wompi" ? 5 : 4);
    assert.equal(fixture.provider.links.size - countLinks, paymentMethod === "wompi" ? 1 : 0);
  }
});

test("servidor conserva validación de precios, cantidades, stock y medios deshabilitados", async () => {
  const product = await fixture.makeProduct(2, 150000);
  for (const extra of [
    { paymentMethod: "nequi_api" }, { paymentMethod: "tarjeta" },
    { items: [{ productId: String(product.product._id), variantId: String(product.variantId), quantity: 0 }] },
    { items: [{ productId: String(product.product._id), variantId: String(product.variantId), quantity: 3 }] },
  ]) {
    const response = await fixture.createOrder(product, extra);
    assert.equal(response.status, 400, response.text);
  }
  const response = await fixture.createOrder(product, { paymentMethod: "contra_entrega", total: 1,
    items: [{ productId: String(product.product._id), variantId: String(product.variantId), quantity: 1, unitPrice: 1 }] });
  assert.equal(response.status, 201, response.text);
  assert.equal((await fixture.fresh(response.json.order.id)).subtotal, 150000);
  assert.deepEqual(fixture.provider.blocked, []);
});
