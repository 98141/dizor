"use strict";
// Sprint 08 · Configuración, Usuarios y personal, Auditoría.
// Unit tests of the bounded audit query helper, plus API checks against the real Express app
// and an ephemeral MongoDB replica set (phase2Fixture: needs MMS_DIR and MONGOMS_SYSTEM_BINARY).
// No .env, no real database, no e-mail, no external network.
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAuditPagination, auditDateFilter, bogotaDayStart } = require("../src/utils/auditQuery");

test("S08-01 tamaño de página acotado: 1..100, por defecto 25; un límite negativo ya no llega a Mongo", () => {
  assert.deepEqual(parseAuditPagination({}), { page: 1, limit: 25, skip: 0 });
  assert.deepEqual(parseAuditPagination({ page: "3", limit: "15" }), { page: 3, limit: 15, skip: 30 });
  assert.equal(parseAuditPagination({ limit: "-5" }).limit, 25);
  assert.equal(parseAuditPagination({ limit: "0" }).limit, 25);
  assert.equal(parseAuditPagination({ limit: "500" }).limit, 100);
  assert.equal(parseAuditPagination({ limit: "abc" }).limit, 25);
  assert.equal(parseAuditPagination({ page: "-2" }).page, 1);
  assert.equal(parseAuditPagination({ page: "0" }).skip, 0);
});

test("S08-02 «Hasta» incluye el día civil completo de Colombia", () => {
  const range = auditDateFilter("2026-11-20", "2026-11-20");
  assert.equal(range.$gte.toISOString(), "2026-11-20T05:00:00.000Z");
  assert.equal(range.$lte.toISOString(), "2026-11-21T04:59:59.999Z");
  // 23:30 in Bogotá on the 20th is inside; it was excluded when "to" meant 00:00 UTC.
  const lateEvening = new Date("2026-11-20T23:30:00-05:00");
  assert.ok(lateEvening >= range.$gte && lateEvening <= range.$lte);
  assert.equal(auditDateFilter("", ""), null);
  assert.deepEqual(Object.keys(auditDateFilter("2026-11-01", "")), ["$gte"]);
});

test("S08-03 fechas inválidas o invertidas responden 400 y un instante explícito conserva el comportamiento anterior", () => {
  for (const bad of ["2026-02-30", "ayer", "2026-13-01"]) assert.throws(() => auditDateFilter(bad), (e) => e.statusCode === 400, bad);
  assert.throws(() => auditDateFilter(["2026-01-01"]), (e) => e.statusCode === 400);
  assert.throws(() => auditDateFilter("2026-11-21", "2026-11-20"), (e) => e.statusCode === 400 && /posterior/.test(e.message));
  assert.equal(auditDateFilter("2026-11-20T10:00:00.000Z").$gte.toISOString(), "2026-11-20T10:00:00.000Z");
});

test("S08-04 «Hoy» empieza a medianoche de Bogotá, no del servidor", () => {
  assert.equal(bogotaDayStart(new Date("2026-11-26T03:00:00Z")).toISOString(), "2026-11-25T05:00:00.000Z");
  assert.equal(bogotaDayStart(new Date("2026-11-26T05:00:00Z")).toISOString(), "2026-11-26T05:00:00.000Z");
  assert.equal(bogotaDayStart(new Date("2026-11-26T23:59:00Z")).toISOString(), "2026-11-26T05:00:00.000Z");
});

const integration = process.env.MMS_DIR && process.env.MONGOMS_SYSTEM_BINARY;
const fixture = integration ? require("./helpers/phase2Fixture.cjs") : null;
const it = integration ? test : test.skip;
if (integration) { test.before(() => fixture.setup()); test.after(() => fixture.close()); }
const api = (...args) => fixture.api(...args);

it("S08-05 Usuarios: solo el superadministrador consulta, crea o cambia estado; el listado no expone credenciales", async () => {
  const ctx = fixture.context;
  for (const cookie of [ctx.adminCookie, ctx.vendorCookie, ctx.clientCookie]) {
    assert.equal((await api("GET", "/api/admin/users", { cookie })).status, 403);
    assert.equal((await api("POST", "/api/admin/users", { cookie, body: { name: "X", email: "x@example.test", password: "Prueba2026!x", role: "admin" } })).status, 403);
  }
  assert.equal((await api("GET", "/api/admin/users")).status, 401);
  const list = await api("GET", "/api/admin/users", { cookie: ctx.superCookie });
  assert.equal(list.status, 200);
  assert.ok(list.json.users.length >= 2);
  assert.ok(list.json.users.every((u) => ["admin", "vendedor"].includes(u.role)), "el superadministrador no aparece");
  const raw = JSON.stringify(list.json);
  assert.doesNotMatch(raw, /"password"|refreshToken|\$2[aby]\$/);
  const target = list.json.users.find((u) => u.role === "vendedor");
  assert.equal((await api("PATCH", `/api/admin/users/${target._id}/status`, { cookie: ctx.adminCookie, body: { isActive: false } })).status, 403);
  assert.equal((await ctx.User.findById(target._id)).isActive, true);
});

it("S08-06 Crear usuario conserva las validaciones del servidor y no admite superadministradores", async () => {
  const ctx = fixture.context, cookie = ctx.superCookie, base = { name: "Persona S08", email: "persona-s08@example.test", phone: "" };
  const weak = await api("POST", "/api/admin/users", { cookie, body: { ...base, password: "debil", role: "vendedor" } });
  assert.equal(weak.status, 400); assert.match(weak.json.message, /Contraseña débil/);
  assert.equal((await api("POST", "/api/admin/users", { cookie, body: { ...base, password: "PruebaS08!2026", role: "superadmin" } })).status, 400);
  assert.equal((await api("POST", "/api/admin/users", { cookie, body: { ...base, email: "no-es-correo", password: "PruebaS08!2026", role: "vendedor" } })).status, 400);
  assert.equal((await api("POST", "/api/admin/users", { cookie, body: { ...base, name: "", password: "PruebaS08!2026", role: "vendedor" } })).status, 400);
  const created = await api("POST", "/api/admin/users", { cookie, body: { ...base, password: "PruebaS08!2026", role: "vendedor" } });
  assert.equal(created.status, 201); assert.equal(created.json.user.role, "vendedor"); assert.equal(created.json.user.password, undefined);
  assert.equal((await api("POST", "/api/admin/users", { cookie, body: { ...base, password: "PruebaS08!2026", role: "vendedor" } })).status, 400, "duplicado");
  assert.equal(await ctx.User.countDocuments({ email: base.email }), 1);
});

it("S08-07 Auditoría: vendedor y cliente rechazados; administradores consultan; no existe ruta de escritura", async () => {
  const ctx = fixture.context, AuditLog = require("../src/models/AuditLog");
  for (const cookie of [ctx.vendorCookie, ctx.clientCookie]) {
    assert.equal((await api("GET", "/api/admin/audit", { cookie })).status, 403);
    assert.equal((await api("GET", "/api/admin/audit/stats", { cookie })).status, 403);
  }
  assert.equal((await api("GET", "/api/admin/audit", { cookie: ctx.adminCookie })).status, 200);
  const sample = await AuditLog.findOne().lean();
  assert.ok(sample, "el fixture registra eventos reales de inicio de sesión");
  const before = await AuditLog.countDocuments(), snapshot = JSON.stringify(sample);
  for (const [method, url] of [["PATCH", `/api/admin/audit/${sample._id}`], ["PUT", `/api/admin/audit/${sample._id}`], ["DELETE", `/api/admin/audit/${sample._id}`], ["POST", "/api/admin/audit"]]) {
    const res = await api(method, url, { cookie: ctx.superCookie, body: { summary: "reescrito", success: false } });
    assert.ok([404, 405].includes(res.status), `${method} ${url} → ${res.status}`);
  }
  assert.equal(await AuditLog.countDocuments(), before);
  assert.equal(JSON.stringify(await AuditLog.findById(sample._id).lean()), snapshot, "el evento histórico no cambia");
});

it("S08-08 Paginación y filtros de auditoría en el servidor: límite acotado, día civil y fecha inválida", async () => {
  const ctx = fixture.context, AuditLog = require("../src/models/AuditLog"), cookie = ctx.adminCookie;
  // Events created for this ephemeral database only (module "sprint08"), never real history.
  const at = (iso, i, success = true) => ({ action: "settings_updated", module: "sprint08", summary: `S08 evento ${i}`, success, userEmail: "admin-cierre@example.test", role: "admin", createdAt: new Date(iso), updatedAt: new Date(iso) });
  await AuditLog.collection.insertMany([
    at("2026-11-20T00:30:00-05:00", 1), at("2026-11-20T23:30:00-05:00", 2, false), at("2026-11-21T00:10:00-05:00", 3),
    ...Array.from({ length: 30 }, (_, i) => at(`2026-10-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00-05:00`, 10 + i)),
  ]);
  const day = await api("GET", "/api/admin/audit?module=sprint08&from=2026-11-20&to=2026-11-20", { cookie });
  assert.equal(day.status, 200);
  assert.deepEqual(day.json.logs.map((l) => l.summary).sort(), ["S08 evento 1", "S08 evento 2"]);
  const failed = await api("GET", "/api/admin/audit?module=sprint08&success=false&from=2026-11-20&to=2026-11-20&term=evento", { cookie });
  assert.deepEqual(failed.json.logs.map((l) => l.summary), ["S08 evento 2"]);
  const page = await api("GET", "/api/admin/audit?module=sprint08&limit=15&page=2", { cookie });
  assert.equal(page.json.total, 33); assert.equal(page.json.totalPages, 3); assert.equal(page.json.results, 15); assert.equal(page.json.page, 2);
  const negative = await api("GET", "/api/admin/audit?module=sprint08&limit=-5", { cookie });
  assert.equal(negative.status, 200); assert.equal(negative.json.results, 25); assert.equal(negative.json.totalPages, 2);
  const huge = await api("GET", "/api/admin/audit?module=sprint08&limit=5000", { cookie });
  assert.equal(huge.json.results, 33); assert.equal(huge.json.totalPages, 1);
  assert.equal((await api("GET", "/api/admin/audit?from=2026-02-30", { cookie })).status, 400);
  assert.equal((await api("GET", "/api/admin/audit?from=2026-11-21&to=2026-11-20", { cookie })).status, 400);
});

it("S08-09 «Hoy» y «Fallidos» salen de la base: un evento de ayer en Bogotá no cuenta como hoy", async () => {
  const ctx = fixture.context, AuditLog = require("../src/models/AuditLog"), cookie = ctx.adminCookie;
  const before = (await api("GET", "/api/admin/audit/stats", { cookie })).json.stats;
  const start = bogotaDayStart();
  const doc = (ms, success) => ({ action: "login_failed", module: "sprint08-hoy", success, createdAt: new Date(+start + ms), updatedAt: new Date(+start + ms) });
  await AuditLog.collection.insertMany([doc(-60000, false), doc(60000, false)]);
  const after = (await api("GET", "/api/admin/audit/stats", { cookie })).json.stats;
  assert.equal(after.total - before.total, 2);
  assert.equal(after.today - before.today, 1);
  assert.equal(after.failed - before.failed, 2);
});

it("S08-10 Configuración: guardar impuestos no toca la política de envío; rango y permisos se conservan", async () => {
  const ctx = fixture.context;
  const before = (await api("GET", "/api/admin/settings", { cookie: ctx.adminCookie })).json.settings;
  const saved = await api("PATCH", "/api/admin/settings", { cookie: ctx.adminCookie, body: { taxEnabled: false, taxRate: 19, shippingMode: "fixed", shippingFixedCost: 1 } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.settings.taxEnabled, false); assert.equal(saved.json.settings.taxRate, 19);
  for (const key of ["shippingMode", "shippingFixedCost", "freeShippingMinAmount", "carriers"]) assert.deepEqual(saved.json.settings[key], before[key], key);
  assert.equal(saved.json.settings.shippingIncluded, true);
  assert.deepEqual(saved.json.settings.activeCarriers, ["interrapidisimo", "servientrega"]);
  assert.equal((await api("PATCH", "/api/admin/settings", { cookie: ctx.adminCookie, body: { taxRate: 150 } })).status, 400);
  assert.equal((await api("PATCH", "/api/admin/settings", { cookie: ctx.vendorCookie, body: { taxRate: 2 } })).status, 403);
  assert.equal((await api("GET", "/api/admin/settings", { cookie: ctx.adminCookie })).json.settings.taxRate, 19);
});
