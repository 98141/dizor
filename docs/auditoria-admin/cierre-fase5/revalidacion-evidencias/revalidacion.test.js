"use strict";
// Revalidación independiente de las correcciones de Fase 5. No modifica la aplicación.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fixture = require("../../../../backend/test/helpers/phase2Fixture.cjs");

const out = __dirname;
const results = [];
const record = (id, verdict, detail) => results.push({ id, verdict, detail });
const libPromise = import(pathToFileURL(path.resolve(out, "../../../../frontend/src/lib/confirmedSettings.mjs")).href);

function sample(title = "Promoción artesanal de temporada") {
  return {
    key: "default",
    popup: {
      enabled: true, delaySeconds: 4, showNewsletterForm: true, variant: "newsletter", couponCode: "",
      title, text: "Descubre nuestros productos elaborados en palma de iraca.",
      ctaLabel: "Ver colección", ctaHref: "/catalogo", imageUrl: "",
    },
    newsletter: { footerTitle: "Novedades Dizor", footerText: "Avisos de colección.", successMessage: "Listo." },
    abandonedCart: { enabled: false, delayHours: 24, maxReminders: 2, emailSubject: "Tu carrito te espera — Dizor", featureEnabled: false },
  };
}
const envelope = (settings) => ({ status: "success", settings });
const fail = (status) => Object.assign(new Error("fallo " + status), { response: { status, data: { message: "rechazo de prueba" } } });

test("R-A01 catorce condiciones sobre un almacén que representa la base", async () => {
  const lib = await libPromise;
  let stored = sample();
  let writes = 0;
  const seen = [];
  const read = async () => {
    if (read.mode === "500") throw fail(500);
    if (read.mode === "offline") throw Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" });
    if (read.mode === "abort") throw Object.assign(new Error("aborted"), { code: "ERR_CANCELED" });
    if (read.mode === "invalid-json") throw new SyntaxError("JSON inválido");
    if (read.mode === "incomplete") return { status: "success", settings: { key: "default", popup: { title: "" } } };
    if (read.mode === "hang") return new Promise(() => {});
    if (read.mode === "slow-old") return read.slow.promise;
    return envelope(stored);
  };
  const write = async (body) => {
    writes += 1;
    if (write.mode === "500") throw fail(500);
    if (write.mode === "400") throw fail(400);
    if (write.mode === "applied-then-lost") {
      stored = { ...stored, ...body, abandonedCart: { ...body.abandonedCart, featureEnabled: false } };
      throw fail(503);
    }
    if (write.mode === "lost-before-apply") throw fail(503);
    stored = { ...stored, ...body, abandonedCart: { ...body.abandonedCart, featureEnabled: false } };
    return envelope(stored);
  };
  const resource = lib.createConfirmedSettings({
    read, write, parse: lib.readMarketing, valid: lib.validMarketing, payload: lib.marketingPayload, timeoutMs: 30,
  });
  const snap = () => ({ status: resource.getSnapshot().status, title: resource.getSnapshot().value?.popup?.title ?? null, canSave: resource.canSave(), writes, stored: stored.popup.title, enabled: stored.popup.enabled });

  assert.equal(resource.canSave(), false);
  read.mode = "ok";
  assert.equal(await resource.load(), true);
  assert.equal(snap().title, "Promoción artesanal de temporada");
  seen.push({ step: "carga", ...snap() });

  for (const mode of ["500", "offline", "abort", "invalid-json", "incomplete"]) {
    read.mode = mode;
    assert.equal(await resource.load(), false);
    assert.equal(resource.getSnapshot().status, "load-error");
    assert.equal(resource.canSave(), false);
    assert.equal(await resource.save(), false);
    assert.equal(stored.popup.title, "Promoción artesanal de temporada");
    assert.equal(stored.popup.enabled, true);
    seen.push({ step: mode, ...snap() });
  }

  read.mode = "hang";
  const hanging = resource.load();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(resource.getSnapshot().status, "load-error");
  assert.equal(await resource.save(), false);
  await hanging;
  seen.push({ step: "timeout", ...snap() });

  read.mode = "ok";
  assert.equal(await resource.load(), true);
  assert.equal(snap().title, "Promoción artesanal de temporada");
  seen.push({ step: "reintento", ...snap() });

  read.slow = {};
  read.slow.promise = new Promise((resolve) => { read.slow.resolve = resolve; });
  read.mode = "slow-old";
  const older = resource.load();
  await Promise.resolve();
  read.mode = "ok";
  stored = sample("Título reciente");
  await resource.load();
  read.slow.resolve(envelope(sample("Título viejo")));
  await older;
  assert.equal(resource.getSnapshot().value.popup.title, "Título reciente");
  seen.push({ step: "fuera-de-orden", ...snap() });

  stored = sample();
  await resource.load();
  resource.edit((s) => ({ ...s, popup: { ...s.popup, title: "Edición válida de temporada" } }));
  const first = resource.save();
  const second = resource.save();
  assert.equal(await first, true);
  assert.equal(await second, false);
  assert.equal(writes, 1);
  assert.equal(stored.popup.title, "Edición válida de temporada");
  seen.push({ step: "doble-clic", ...snap(), writes });

  const writesBeforeReject = writes;
  write.mode = "400";
  resource.edit((s) => ({ ...s, popup: { ...s.popup, title: "Borrador rechazado" } }));
  assert.equal(await resource.save(), false);
  assert.equal(resource.getSnapshot().status, "save-error");
  assert.equal(resource.getSnapshot().message.includes("correctamente"), false);
  assert.equal(stored.popup.title, "Edición válida de temporada");
  assert.equal(writes, writesBeforeReject + 1);
  seen.push({ step: "error-guardado", ...snap() });

  write.mode = "lost-before-apply";
  resource.edit((s) => ({ ...s, popup: { ...s.popup, title: "No aplicado" } }));
  assert.equal(await resource.save(), false);
  assert.equal(resource.getSnapshot().status, "uncertain");
  assert.equal(resource.getSnapshot().message.includes("correctamente"), false);
  assert.equal(resource.canSave(), false);
  assert.equal(stored.popup.title, "Edición válida de temporada");
  seen.push({ step: "ambiguo-no-aplicado", ...snap() });

  write.mode = "ok";
  read.mode = "ok";
  await resource.load();
  assert.equal(resource.getSnapshot().value.popup.title, "Edición válida de temporada");
  const empty = sample("");
  empty.popup.enabled = false;
  empty.popup.text = "";
  for (const key of Object.keys(empty.newsletter)) empty.newsletter[key] = "";
  empty.abandonedCart.emailSubject = "";
  stored = empty;
  await resource.load();
  assert.equal(resource.canSave(), true);
  assert.equal(await resource.save(), true);
  seen.push({ step: "vacio-legitimo", ...snap() });

  assert.equal(writes > 0, true);
  record("R-A01", "corregida", { seen, finalStored: stored.popup });
});

test("R-B03 y Nequi sobre la API real del fixture", async () => {
  await fixture.setup();
  try {
    const StoreSettings = require("../../../../backend/src/models/storeSettings");
    const ctx = fixture.context;
    const before = (await fixture.api("GET", "/api/admin/settings", { cookie: ctx.adminCookie })).json.settings;
    const crafted = await fixture.api("PATCH", "/api/admin/settings", {
      cookie: ctx.adminCookie,
      body: { taxEnabled: false, taxRate: 0, shippingMode: "fixed", shippingFixedCost: 1, freeShippingMinAmount: 9, carriers: ["nequi"], shippingByDepartment: { Antioquia: 1 } },
    });
    assert.equal(crafted.status, 200);
    const stored = await StoreSettings.findOne({ key: "default" }).lean();
    assert.equal(stored.shippingMode, before.shippingMode);
    assert.equal(stored.shippingFixedCost, before.shippingFixedCost);
    assert.deepEqual(stored.carriers, before.carriers);
    const { getShippingCost } = require("../../../../backend/src/services/settingsService");
    assert.equal(getShippingCost(stored, 80000, "Nariño"), 0);
    const config = await fixture.api("GET", "/api/checkout/config");
    const ids = (config.json.config?.paymentMethods || []).map((m) => m.id);
    assert.equal(ids.includes("nequi_api"), false);
    assert.equal(ids.includes("nequi_manual"), false);
    const made = await fixture.makeProduct(3);
    const nequi = await fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(made.product, made.variantId, { paymentMethod: "nequi_manual" }) });
    assert.notEqual(nequi.status, 201);
    const cod = await fixture.api("POST", "/api/checkout/orders", { body: fixture.orderBody(made.product, made.variantId) });
    assert.equal(cod.status, 201);
    record("R-B03", "corregida", { shippingMode: stored.shippingMode, cost: stored.shippingFixedCost, carriers: stored.carriers, nequiStatus: nequi.status, methods: ids });
  } finally {
    await fixture.close();
  }
});

test.after(() => {
  fs.writeFileSync(path.join(out, "revalidacion-resultados.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
});
