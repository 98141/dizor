"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const swc = require("../node_modules/@next/swc-win32-x64-msvc");

// Execute the actual ProductForm handlers. State updates are deliberately queued
// until flush(), reproducing two clicks before React's next render. Refs update
// immediately, as in React. No server, browser, network or new dependencies.
async function mount(adjustProductStock, variants = 1) {
  const slots = [], pending = [], effects = [];
  let cursor = 0, tree;
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (value) => pending.push(() => { slots[i] = typeof value === "function" ? value(slots[i]) : value; })];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
  };
  const file = path.resolve(__dirname, "../src/components/admin/ProductForm.jsx");
  const { code } = swc.transformSync(fs.readFileSync(file, "utf8"), false, Buffer.from(JSON.stringify({
    filename: file, jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
    module: { type: "commonjs" },
  })));
  const mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = (name) => {
    if (name === "react") return hooks;
    if (name === "next/link") return () => null;
    if (name === "next/navigation") return { useRouter: () => ({ push() {} }) };
    if (name === "@/services/adminCatalogService") return {
      adjustProductStock,
      getCatalogMeta: async () => ({ meta: {} }),
      getAdminProduct: async () => ({ product: { name: "Ficticio", images: [], variants: Array.from({ length: variants }, (_, i) => ({ id: `var-${i}`, sku: `TEST-${i}`, stock: 10 })) } }),
    };
    return Module.prototype.require.call(mod, name);
  };
  mod._compile(code, file);
  const render = () => { cursor = 0; tree = mod.exports.default({ productId: "product-test" }); };
  const flush = () => { while (pending.length) pending.shift()(); render(); };
  const nodes = () => {
    const out = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      out.push(node); visit(node.props?.children);
    }
    visit(tree); return out;
  };
  const text = (node) => Array.isArray(node) ? node.map(text).join("") : node?.props ? text(node.props.children) : typeof node === "string" ? node : "";
  const field = (label, i = 0) => nodes().filter((n) => n.props?.["aria-label"] === label)[i];
  const button = (i = 0) => nodes().filter((n) => n.type === "button" && /Registrar ajuste|Registrando…|Reintentar ajuste/.test(text(n)))[i];
  const messages = () => nodes().filter((n) => n.props?.role === "status" || n.props?.role === "alert").map(text);
  const enter = (delta = "3", reason = "Conteo ficticio", i = 0) => {
    field("Cantidad del ajuste", i).props.onChange({ target: { value: delta } });
    field("Motivo del ajuste", i).props.onChange({ target: { value: reason } }); flush();
  };
  render(); effects.forEach((fn) => fn()); await new Promise(setImmediate); flush();
  return { flush, field, button, messages, enter };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test("doble clic antes de render: una petición, botón ocupado y stock confirmado", async () => {
  const calls = [], pending = deferred();
  const form = await mount((id, payload) => { calls.push({ id, payload }); return pending.promise; });
  form.enter();
  const handler = form.button().props.onClick;
  const first = handler(), second = handler();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].payload.operationKey);
  form.flush(); assert.equal(form.button().props.disabled, true);
  assert.ok(form.messages().includes("Registrando ajuste…"));
  pending.resolve({ stock: 13 }); await Promise.all([first, second]);
  // Even the previous render's handler cannot submit the completed action again.
  await handler(); assert.equal(calls.length, 1);
  form.flush(); assert.equal(form.button().props.disabled, false);
  assert.equal(form.field("Stock variante 1").props.value, 13);
  assert.equal(form.field("Cantidad del ajuste").props.value, "");
  assert.ok(form.messages().some((m) => m.includes("Ajuste registrado. Stock: 13")));
});

test("error de red y reintento inmediato conservan clave y contenido", async () => {
  const calls = []; let current = deferred();
  const form = await mount((_, payload) => { calls.push({ ...payload }); return current.promise; });
  form.enter("-2");
  const first = form.button().props.onClick(); current.reject(new Error("Respuesta perdida")); await first; form.flush();
  assert.ok(form.messages().some((m) => m.includes("Reintenta la misma operación")));
  assert.equal(form.field("Cantidad del ajuste").props.disabled, true);
  current = deferred(); const handler = form.button().props.onClick;
  const retry = handler(), duplicate = handler();
  assert.equal(calls.length, 2); assert.deepEqual(calls[1], calls[0]);
  form.flush(); assert.equal(form.button().props.disabled, true);
  current.resolve({ stock: 8, repeated: true }); await Promise.all([retry, duplicate]); form.flush();
  assert.equal(form.field("Stock variante 1").props.value, 8);
});

test("rechazo explícito permite corregir sin ocultar el error; acción nueva usa clave nueva", async () => {
  const calls = [];
  const form = await mount(async (_, payload) => {
    calls.push({ ...payload });
    if (calls.length === 1) throw { response: { status: 409, data: { message: "Stock insuficiente" } } };
    return { stock: 11 };
  });
  form.enter("-20"); await form.button().props.onClick(); form.flush();
  assert.ok(form.messages().includes("Stock insuficiente"));
  assert.equal(Boolean(form.field("Cantidad del ajuste").props.disabled), false);
  form.enter("1"); await form.button().props.onClick(); form.flush();
  assert.notEqual(calls[0].operationKey, calls[1].operationKey);
  form.enter("1"); await form.button().props.onClick(); form.flush();
  assert.notEqual(calls[1].operationKey, calls[2].operationKey);
});

test("dos variantes simultáneas se bloquean por separado y actualizan por ID", async () => {
  const calls = [], a = deferred(), b = deferred();
  const form = await mount((_, payload) => { calls.push(payload); return payload.variantId === "var-0" ? a.promise : b.promise; }, 2);
  form.enter("1", "Variante A", 0); form.enter("2", "Variante B", 1);
  const first = form.button(0).props.onClick(), second = form.button(1).props.onClick();
  await form.button(0).props.onClick(); await form.button(1).props.onClick();
  assert.equal(calls.length, 2); assert.notEqual(calls[0].operationKey, calls[1].operationKey);
  form.flush(); assert.equal(form.button(0).props.disabled, true); assert.equal(form.button(1).props.disabled, true);
  b.resolve({ stock: 12 }); await second; form.flush();
  assert.equal(form.field("Stock variante 2").props.value, 12); assert.equal(form.button(0).props.disabled, true);
  a.resolve({ stock: 11 }); await first; form.flush();
  assert.equal(form.field("Stock variante 1").props.value, 11);
});
