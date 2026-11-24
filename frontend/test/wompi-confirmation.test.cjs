const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const swc = require("../node_modules/@next/swc-win32-x64-msvc");
function load(relative, overrides = {}) {
  const file = path.resolve(__dirname, relative);
  const { code } = swc.transformSync(fs.readFileSync(file, "utf8"), false, Buffer.from(JSON.stringify({
    filename: file, jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" },
  })));
  const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : Module.prototype.require.call(mod, name);
  mod._compile(code, file); return mod.exports;
}
const { createConfirmationLoader, wompiReturnId } = load("../src/lib/wompiConfirmation.js");
const result = paymentStatus => ({ order: { paymentMethod: "wompi", paymentStatus } });
const rejected = status => { throw { response: { status } }; };

test("UI01: captura ID del retorno antes de limpiar la URL sin aceptar estado del navegador", () => {
  const params = new URLSearchParams("order=DIZ-1&payment=wompi&id=123-456&status=APPROVED&env=prod");
  const id = wompiReturnId(params); params.delete("id"); assert.equal(id, "123-456");
  for (const query of ["id=123", "payment=wompi&id=../otro", "payment=wompi", "payment=contra_entrega&id=123"]) assert.equal(wompiReturnId(new URLSearchParams(query)), "");
});

test("UI02: envío interno lleva pedido, token e ID sin intervención del comprador", async () => {
  const calls = [];
  const load = createConfirmationLoader({ orderNumber: "DIZ-1", accessToken: "token", transactionId: "123-456",
    verify: async (...args) => { calls.push(args); return result("pagado"); }, lookup: () => assert.fail("No hace falta otra consulta") });
  assert.equal((await load()).order.paymentStatus, "pagado"); assert.deepEqual(calls, [["DIZ-1", "token", "123-456"]]);
});

test("UI03: proveedor caído muestra pedido pendiente y vuelve a verificar en el siguiente sondeo", async () => {
  let attempts = 0, lookups = 0;
  const load = createConfirmationLoader({ transactionId: "123", verify: async () => {
    if (++attempts === 1) rejected(503); return result("pagado");
  }, lookup: async () => { lookups++; return result("pendiente"); } });
  assert.equal((await load()).order.paymentStatus, "pendiente");
  assert.equal((await load()).order.paymentStatus, "pagado"); assert.equal(attempts, 2); assert.equal(lookups, 1);
});

test("UI04: respuesta PENDING se consulta otra vez y nunca se presenta como aprobada", async () => {
  let attempts = 0;
  const load = createConfirmationLoader({ transactionId: "123", verify: async () => result(++attempts === 1 ? "pendiente" : "pagado") });
  assert.equal((await load()).order.paymentStatus, "pendiente"); assert.equal((await load()).order.paymentStatus, "pagado");
});

test("UI05: retorno ajeno o inválido no impide ver el pedido ni se reenvía en cada sondeo", async () => {
  let attempts = 0, lookups = 0;
  const load = createConfirmationLoader({ transactionId: "123", verify: async () => { attempts++; rejected(409); },
    lookup: async () => { lookups++; return result("pendiente"); } });
  await load(); await load(); assert.equal(attempts, 1); assert.equal(lookups, 2);
});

test("UI06: sin retorno usa confirmación existente; pago aprobado no se vuelve a aplicar en sondeos", async () => {
  let attempts = 0, lookups = 0;
  const options = { verify: async () => { attempts++; return result("pagado"); }, lookup: async () => { lookups++; return result("pagado"); } };
  await createConfirmationLoader(options)(); assert.equal(attempts, 0);
  const load = createConfirmationLoader({ ...options, transactionId: "123" }); await load(); await load();
  assert.equal(attempts, 1); assert.equal(lookups, 2);
});

test("UI07: administrador ve un solo botón de verificación sin campo para copiar códigos", () => {
  const React = require("../node_modules/react"), { renderToStaticMarkup } = require("../node_modules/react-dom/server");
  const Component = load("../src/components/admin/OrderNextAction.jsx", {
    "@/lib/orderLabels": { CARRIER_LABELS: {} }, "./OrderWorkspace.module.css": {},
  }).default;
  const props = { order: { operation: { primary: { code: "waiting_payment", label: "Pago pendiente" }, canReconcile: true } }, execute() {} };
  const html = renderToStaticMarkup(React.createElement(Component, props));
  assert.match(html, /Verificar pago con Wompi/); assert.doesNotMatch(html, /name="transactionId"/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.match(renderToStaticMarkup(React.createElement(Component, { ...props, busy: true })), /disabled=""/);
});
