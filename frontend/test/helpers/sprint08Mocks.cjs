"use strict";
// Sprint 08 · fictitious service doubles for the isolated browser harness.
// They mirror the real contracts of /admin/settings, /admin/users and /admin/audit
// (field names, validation messages, pagination and Bogotá civil-day filters).
// No network, no real accounts, no credentials: every value is invented.

const common = `
const sc = () => window.__dzScenario;
const calls = () => window.__dzCalls;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (status, message) => { const e = new Error(message); if (status) e.response = { status, data: { message } }; return e; };
`;

const settings = `${common}
let current = null;
const base = () => ({ id: "s1", taxEnabled: true, taxRate: 19, shippingMode: "free_threshold", shippingFixedCost: 15000, freeShippingMinAmount: 200000, shippingByDepartment: {}, currency: "COP", carriers: ["interrapidisimo", "servientrega", "envia"], shippingIncluded: true, activeCarriers: ["interrapidisimo", "servientrega"], appearance: {}, updatedAt: "2026-11-20T15:30:00.000Z" });
export async function getStoreSettings() {
  current ||= { ...base(), ...(sc().settings || {}) };
  calls().push({ api: "GET /admin/settings" });
  const s = sc(); await wait(s.settingsDelay || 0);
  if (s.settingsGetFail > 0) { s.settingsGetFail--; throw fail(503, "Servicio no disponible"); }
  return { status: "success", settings: structuredClone(current) };
}
export async function updateStoreSettings(data) {
  calls().push({ api: "PATCH /admin/settings", data: structuredClone(data) });
  const s = sc(); await wait(s.patchDelay ?? 300);
  const mode = s.patchMode; s.patchMode = null;
  if (mode === "reject") throw fail(400, "La tasa de impuesto debe estar entre 0 y 100");
  // Same allow-list as settingsAdminController: shipping keys are ignored while shipping is included.
  const allowed = current.shippingIncluded ? ["taxEnabled", "taxRate"] : ["taxEnabled", "taxRate", "shippingMode", "shippingFixedCost", "freeShippingMinAmount"];
  for (const key of allowed) if (data[key] !== undefined) current[key] = data[key];
  current.updatedAt = new Date().toISOString();
  if (mode === "lost") throw fail(0, "Network Error"); // applied, response lost
  return { status: "success", settings: structuredClone(current) };
}`;

const users = `${common}
let team = null, seq = 10;
const seed = () => [
  { _id: "u1", name: "Ana Martínez", email: "ana.martinez@dizor.example", phone: "3000000001", role: "admin", isActive: true, lastLoginAt: "2026-11-25T14:05:00.000Z", createdAt: "2026-10-02T15:00:00.000Z" },
  { _id: "u2", name: "Carlos Pérez", email: "carlos.perez@dizor.example", phone: "", role: "vendedor", isActive: true, lastLoginAt: "2026-11-24T21:40:00.000Z", createdAt: "2026-10-10T15:00:00.000Z" },
  { _id: "u3", name: "Coordinación logística regional del Caribe", email: "coordinacion.logistica.regional.caribe@tejiendo-raices.example", phone: "3000000003", role: "vendedor", isActive: false, lastLoginAt: null, createdAt: "2026-09-12T15:00:00.000Z" },
  { _id: "u4", name: "Laura Gómez", email: "laura.gomez@dizor.example", phone: "", role: "vendedor", isActive: true, lastLoginAt: "2026-11-26T12:10:00.000Z", createdAt: "2026-11-01T15:00:00.000Z" },
];
const strong = (p) => p.length >= 8 && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p) && /[a-z]/.test(p) && /[A-Z]/.test(p);
export async function getAdminUsers() {
  team ||= sc().users === "empty" ? [] : seed();
  calls().push({ api: "GET /admin/users" });
  const s = sc(); await wait(s.usersDelay || 0);
  if (s.usersGetFail > 0) { s.usersGetFail--; throw fail(503, "Servicio no disponible"); }
  return { status: "success", results: team.length, users: structuredClone(team) };
}
export async function createAdminUser(data) {
  calls().push({ api: "POST /admin/users", keys: Object.keys(data).sort() });
  const s = sc(); await wait(s.createDelay ?? 300);
  const { name, email, password, phone, role } = data;
  if (!name || !email || !password || !role) throw fail(400, "Nombre, correo, contraseña y rol son obligatorios");
  if (!["admin", "vendedor"].includes(role)) throw fail(400, "Solo puedes crear usuarios con rol admin o vendedor");
  if (!strong(password)) throw fail(400, "Contraseña débil. Usa mínimo 8 caracteres, un número y un símbolo.");
  if (team.some((u) => u.email === email.toLowerCase())) throw fail(400, "El correo ya está registrado");
  const user = { _id: "n" + seq++, name, email: email.toLowerCase(), phone: phone || "", role, isActive: true, lastLoginAt: null, createdAt: new Date().toISOString() };
  team.unshift(user);
  if (s.createMode === "lost") { s.createMode = null; throw fail(0, "Network Error"); }
  return { status: "success", message: "Usuario administrativo creado correctamente", user: { id: user._id, name, email: user.email, role, isActive: true } };
}
export async function updateAdminUserStatus(id, isActive) {
  calls().push({ api: "PATCH /admin/users/:id/status", id, isActive });
  await wait(250);
  const user = team.find((u) => u._id === id);
  if (!user) throw fail(404, "Usuario administrativo no encontrado");
  user.isActive = isActive;
  return { status: "success", message: isActive ? "Usuario activado" : "Usuario desactivado", user: { id, isActive } };
}`;

const audit = `${common}
const MODULES = ["auth", "orders", "catalog", "users", "settings", "special_requests", "coupons", "cms"];
const ACTIONS = { auth: ["login", "login_failed", "logout"], orders: ["order_status_changed", "payment_confirmed", "tracking_registered"], catalog: ["product_updated", "product_created"], users: ["staff_user_created", "staff_user_status_changed"], settings: ["settings_updated"], special_requests: ["special_request_status_changed"], coupons: ["coupon_created", "coupon_toggled"], cms: ["cms_page_updated", "cms_banner_updated"] };
const PEOPLE = [["ana.martinez@dizor.example", "admin"], ["super@dizor.example", "superadmin"], ["coordinacion.logistica.regional.caribe@tejiendo-raices.example", "vendedor"], ["carlos.perez@dizor.example", "vendedor"]];
const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const hex = (i) => (i.toString(16).padStart(6, "0") + "a1b2c3d4e5f6a7b8c9d0").slice(0, 24);
let events = null;
function build(n) {
  const now = Math.floor(Date.now() / 60000) * 60000, out = [];
  for (let i = 0; i < n; i++) {
    const module = MODULES[i % MODULES.length], acts = ACTIONS[module], action = acts[Math.floor(i / MODULES.length) % acts.length];
    const [userEmail, role] = PEOPLE[i % PEOPLE.length];
    const success = action !== "login_failed" && i % 17 !== 5;
    const createdAt = new Date(now - (i < 6 ? i * 7 * 60000 : 9 * 3600000 + i * 3.3 * 3600000)).toISOString();
    const long = i % 11 === 3;
    out.push({ id: "e" + i, userId: hex(i), userEmail, role, action, module, entityId: hex(i + 500), entityType: module === "orders" ? "order" : module === "users" ? "user" : module === "catalog" ? "product" : null,
      summary: long ? "Pedido DZ-2026-" + (1000 + i) + " · cambio de estado registrado con referencia de transportadora INTERRAPIDISIMO-0000" + i + " y nota operativa extensa para comprobar el recorte" : (success ? "Evento " + (i + 1) + " · " + module : "Intento rechazado " + (i + 1)),
      ip: "10.0.0." + (i % 250), success, previousData: i % 4 === 0 ? { status: "pagado" } : null,
      newData: i === 1 ? { status: "enviado", token: "tok_ficticio_no_mostrar" } : i % 4 === 0 ? { status: "enviado", carrier: "servientrega" } : null, createdAt });
  }
  return out;
}
const civil = (v, end) => { if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) throw fail(400, "Fecha de auditoría inválida"); const d = new Date(v + "T00:00:00-05:00"); return end ? new Date(+d + 86400000 - 1) : d; };
export async function getAuditLogs(params = {}) {
  events ||= build(sc().auditCount ?? 138);
  calls().push({ api: "GET /admin/audit", params: { ...params } });
  const s = sc(); await wait(s.auditDelay || 0);
  if (s.auditGetFail > 0) { s.auditGetFail--; throw fail(503, "Servicio no disponible"); }
  const page = Math.max(1, parseInt(params.page, 10) || 1), limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 25));
  let rows = events;
  if (params.module) rows = rows.filter((e) => e.module === params.module);
  if (params.action) rows = rows.filter((e) => e.action === params.action);
  if (params.success === "true") rows = rows.filter((e) => e.success);
  if (params.success === "false") rows = rows.filter((e) => !e.success);
  if (params.from) { const f = civil(params.from); rows = rows.filter((e) => new Date(e.createdAt) >= f); }
  if (params.to) { const t = civil(params.to, true); rows = rows.filter((e) => new Date(e.createdAt) <= t); }
  if (params.term) { const r = new RegExp(params.term.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"), "i"); rows = rows.filter((e) => [e.userEmail, e.action, e.module, e.summary, e.role].some((v) => r.test(v || ""))); }
  return { status: "success", results: Math.min(limit, Math.max(0, rows.length - (page - 1) * limit)), total: rows.length, page, totalPages: Math.ceil(rows.length / limit) || 1,
    filters: { modules: [...new Set(events.map((e) => e.module))].sort(), actions: [...new Set(events.map((e) => e.action))].sort() },
    logs: structuredClone(rows.slice((page - 1) * limit, page * limit)) };
}
export async function getAuditStats() {
  events ||= build(sc().auditCount ?? 138);
  calls().push({ api: "GET /admin/audit/stats" });
  const s = sc(); await wait(s.auditDelay || 0);
  if (s.statsFail > 0) { s.statsFail--; throw fail(503, "Servicio no disponible"); }
  const today = dayKey(new Date());
  const stats = { total: events.length, today: events.filter((e) => dayKey(new Date(e.createdAt)) === today).length, failed: events.filter((e) => !e.success).length, byModule: [] };
  window.__dzStats = stats;
  return { status: "success", stats };
}`;

module.exports = { settings, users, audit };
