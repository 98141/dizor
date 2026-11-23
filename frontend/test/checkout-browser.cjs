"use strict";
// Componentes React y servicios reales + backend real en réplica temporal.
// Adaptadores solo para el router de Next y los contextos de sesión/carrito.
// Wompi simulado; ninguna solicitud sale al proveedor ni a otros servicios.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const fixture = require(path.join(root, "docs/auditoria-wompi-pedidos/auditoria-claude/evidencias/fixture-claude.cjs"));
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "dizor-checkout-"));
const out = process.env.DIZOR_CHECKOUT_BROWSER_OUT || path.join(root, "docs/checkout-municipios-evidencias");
fs.mkdirSync(out, { recursive: true });
const result = { checks: [], pageErrors: [], externalRequests: [], purchases: [] };
let browser, server;
const check = (label) => { result.checks.push(label); console.log("OK " + label); };
(async () => {
  try {
    await fixture.setup();
    const product = await fixture.makeProduct(50, 150000);
    const item = { productId: String(product.product._id), variantId: String(product.variantId), productName: product.product.name,
      unitPrice: 150000, quantity: 2, sizeName: "Única", colorName: "Natural", sku: "QA-CHECKOUT" };
    const files = {};
    const write = (name, content) => { const file = path.join(stage, name); fs.writeFileSync(file, content); return file; };
    const loader = write("jsx.cjs", `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
    files.navigation = write("navigation.js", `import {useSyncExternalStore} from 'react';const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};const router={push:url=>{history.pushState({},'',url);dispatchEvent(new Event('popstate'))},replace:url=>{history.replaceState({},'',url);dispatchEvent(new Event('popstate'))}};export const useRouter=()=>router;export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));`);
    files.link = write("link.jsx", `export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`);
    files.auth = write("auth.js", `export const useAuth=()=>({user:window.__user,isAuthenticated:!!window.__user,loadingAuth:false});`);
    files.cart = write("cart.js", `import {useState,useCallback} from 'react';export const useCart=()=>{const [items,setItems]=useState(()=>window.__items);const toApiItems=useCallback(()=>items.map(({productId,variantId,quantity})=>({productId,variantId,quantity})),[items]);return {items,hydrated:true,toApiItems,clearCart:()=>setItems([]),clearCoupon:()=>{},appliedCoupon:null};};`);
    files.favorites = write("favorites.js", `export const useFavorites=()=>({removePurchasedFromFavorites:()=>{}});`);
    files.api = write("api.js", `const request=async(method,url,body)=>{const response=await fetch('/mock'+url,{method,headers:{'Content-Type':'application/json','X-QA-Role':window.__user?'client':'guest'},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok){const err=new Error(data.message);err.response={data};throw err;}return {data};};export default {get:url=>request('GET',url),post:(url,body)=>request('POST',url,body)};`);
    const entry = write("entry.jsx", `import {createRoot} from 'react-dom/client';import Checkout from ${JSON.stringify(path.join(frontend, "src/app/(shop)/checkout/page.js"))};import Confirmation from ${JSON.stringify(path.join(frontend, "src/app/(shop)/pedido/confirmacion/page.js"))};import {usePathname} from 'next/navigation';function App(){const p=usePathname();return p.includes('confirmacion')?<Confirmation/>:<Checkout/>;}createRoot(document.getElementById('app')).render(<App/>);`);
    await new Promise((resolve, reject) => webpack({ mode: "development", devtool: false, entry, output: { path: stage, filename: "bundle.js" },
      plugins: [new webpack.NormalModuleReplacementPlugin(/^\.\/api$/, files.api), new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      resolve: { modules: [path.join(frontend, "node_modules"), "node_modules"], extensions: [".js", ".jsx"], alias: {
        "@/context/AuthContext": files.auth, "@/context/CartContext": files.cart, "@/context/FavoritesContext": files.favorites,
        "@/services/api": files.api, "next/navigation": files.navigation, "next/link": files.link, "@": path.join(frontend, "src"),
      } }, module: { rules: [{ test: /\.[jc]sx?$/, exclude: /node_modules/, use: loader }] },
    }, (err, stats) => err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
    const css = ["base/variables.css", "base/globals.css", "components/auth-form.css", "components/consent-check.css", "pages/checkout.css", "pages/order-view.css"]
      .filter((name) => fs.existsSync(path.join(frontend, "src/styles", name))).map((name) => fs.readFileSync(path.join(frontend, "src/styles", name), "utf8")).join("\n");
    const user = { id: String(fixture.users.client._id), name: "Cliente con dirección", email: fixture.users.client.email, phone: "3001234567", role: "cliente", shippingAddresses: [
      { id: "home", label: "Casa", address: "Casa predeterminada 123", city: "Pasto", department: "Nariño", postalCode: "520001", isDefault: true },
      { id: "legacy", label: "Antigua ambigua", address: "Calle antigua 321", city: "La Unión", department: "", postalCode: "123456" },
      { id: "bogota", label: "Bogotá", address: "Calle Bogotá 100", city: "Bogotá", department: "Bogotá D.C.", postalCode: "110111" },
      { id: "office", label: "Oficina", address: "Oficina 456", city: "Cali", department: "Valle del Cauca", postalCode: "760001" },
    ] };
    let failQuote = false, failOrder = false;
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(fs.readFileSync(path.join(stage, "bundle.js"))); }
        if (url.pathname.startsWith("/mock/")) {
          res.setHeader("Content-Type", "application/json");
          const apiPath = "/api" + url.pathname.slice(5);
          let raw = ""; for await (const chunk of req) raw += chunk;
          const body = raw ? JSON.parse(raw) : undefined;
          if (apiPath === "/api/checkout/calculate" && failQuote) { failQuote = false; res.statusCode = 503; return res.end(JSON.stringify({ message: "Fallo de cotización de prueba" })); }
          if (apiPath === "/api/checkout/orders" && failOrder) { failOrder = false; res.statusCode = 503; return res.end(JSON.stringify({ message: "Fallo temporal de prueba" })); }
          const response = await fixture.api(req.method, apiPath, { body, cookie: req.headers["x-qa-role"] === "client" ? fixture.cookies.client : undefined });
          if (response.status >= 400) console.log("QA HTTP", apiPath, response.status, response.json?.message, JSON.stringify(body));
          if (apiPath === "/api/checkout/orders" && req.method === "POST") result.purchases.push({ body, status: response.status, data: response.json });
          res.statusCode = response.status; return res.end(response.text);
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR checkout QA</title><style>${css}</style></head><body><div id="app"></div><script>window.__items=${JSON.stringify([item])};window.__user=${JSON.stringify(url.searchParams.get("as") === "client" ? user : null)};</script><script src="/bundle.js"></script></body></html>`);
      } catch (err) { res.statusCode = 500; res.end(JSON.stringify({ message: err.message })); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
      userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
    const page = await browser.newPage();
    const apiCalls = [];
    page.on("request", (req) => { if (req.url().includes("/mock/")) apiCalls.push(new URL(req.url()).pathname); });
    page.on("pageerror", (err) => result.pageErrors.push(err.stack || err.message));
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url().startsWith(origin) || req.url().startsWith("data:")) return req.continue();
      if (req.url().startsWith("https://checkout.wompi.co/l/")) return req.respond({ status: 200, contentType: "text/html", body: '<link rel="icon" href="data:,"><h1>Wompi simulado sin cobros</h1>' });
      result.externalRequests.push(req.url()); req.abort();
    });
    const ready = () => page.waitForFunction(() => document.querySelector('button[type="submit"]') && !document.querySelector('button[type="submit"]').disabled);
    const fill = async (name, value) => { await page.click(`[name="${name}"]`); await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control"); await page.type(`[name="${name}"]`, value); };
    const snapshot = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('input:not([type="radio"]),textarea,select')].map((e) => [e.id, e.type === "checkbox" ? e.checked : e.value])));
    const countOrders = () => fixture.M.Order.countDocuments();
    await page.setViewport({ width: 1440, height: 1000, hasTouch: true });
    await page.goto(origin + "/checkout"); await ready();
    assert.equal(await page.$('[name="carrier"]'), null);
    assert.equal(await page.$(".checkout-steps"), null);
    for (const title of ["Datos de contacto", "Dirección de envío", "Medio de pago", "Resumen del pedido"]) assert(await page.$eval("body", (e, title) => e.innerText.includes(title), title));
    assert.equal(await page.$$eval('button[type="submit"]', (nodes) => nodes.length), 1);
    await page.click('button[type="submit"]');
    assert.equal(await page.evaluate(() => document.activeElement.id), "name");
    assert(await page.$("#name-error"));
    for (const [name, value] of Object.entries({ name: "Cliente invitado", email: "correo inválido", phone: "123", address: "Calle Prueba 10" })) await fill(name, value);
    await page.click('button[type="submit"]'); assert.equal(await page.evaluate(() => document.activeElement.id), "email");
    await fill("email", "invitado@example.test"); await page.click('button[type="submit"]'); assert.equal(await page.evaluate(() => document.activeElement.id), "phone");
    await fill("phone", "+57 300 123 4567");
    assert.equal(await page.$('#city'), null);
    assert.equal(await page.$('#department'), null);
    assert.equal(await page.$eval('#municipality', (e) => e.placeholder), 'Busca tu ciudad o municipio');
    assert.equal(await page.$eval('#municipality', (e) => e.getAttribute('role')), 'combobox');
    assert.equal(await page.$eval('#municipality', (e) => e.getAttribute('aria-autocomplete')), 'list');
    assert.equal(await page.$eval('#municipality', (e) => document.getElementById(e.getAttribute('aria-controls')).getAttribute('role')), 'listbox');
    assert.equal(await page.$eval('#municipality', (e) => e.value), '');
    const callsBeforeSearch = apiCalls.length;
    await fill('municipality', 'sandona');
    await page.waitForSelector('#municipality-option-52683');
    assert.equal(apiCalls.length, callsBeforeSearch);
    await page.screenshot({ path: path.join(out, 'sugerencias-sandona-1440.png'), fullPage: true });
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#municipality', (e) => e.value), 'Sandoná — Nariño');
    assert.equal(await page.$eval('#municipality-option-52683', (e) => e.getAttribute('aria-selected')), 'true');
    assert.equal(await countOrders(), 0, 'Enter selecciona y no compra');
    await page.type("#notes", "Conservar esta nota al cambiar de pago");
    await page.click("#consent-order_processing"); await page.click("#consent-terms");
    const initialValues = await snapshot();
    await fill('municipality', 'Ciudad que no existe zzz');
    await page.keyboard.press('Enter');
    assert.equal(await countOrders(), 0);
    assert(await page.$eval('[role="status"]', (e) => e.textContent.includes('No se encontraron')));
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#municipality', (e) => e.getAttribute('aria-expanded')), 'false');
    await page.click('button[type="submit"]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'municipality');
    assert.equal(await page.$eval('#municipality-error', (e) => e.textContent), 'Selecciona una ciudad o municipio de la lista');
    const afterInvalid = await snapshot();
    for (const key of ['name', 'email', 'phone', 'address', 'postalCode', 'notes', 'consent-order_processing', 'consent-terms']) assert.deepEqual(afterInvalid[key], initialValues[key]);
    await fill('municipality', 'san pedro');
    await page.keyboard.press('ArrowDown');
    const second = await page.$eval('#municipality', (e) => e.getAttribute('aria-activedescendant'));
    await page.keyboard.press('ArrowUp');
    assert.notEqual(await page.$eval('#municipality', (e) => e.getAttribute('aria-activedescendant')), second);
    await page.keyboard.press('Escape');
    await fill('municipality', 'SANDONA');
    await page.click('#municipality-option-52683');
    const entered = await snapshot(), initialCount = await countOrders();
    check('Combobox único: selección por teclado/clic, búsqueda local sin tildes, sin envío con Enter, Escape, texto libre inválido y borrador conservado');
    await page.click('[name="payment"][value="wompi"]');
    await page.click('[name="payment"][value="contra_entrega"]');
    assert.deepEqual(await snapshot(), entered); assert.equal(await countOrders(), initialCount);
    check("Secciones visibles; validación junto al campo y foco; cambiar pago conserva datos, notas y autorizaciones sin crear pedidos");
    for (const width of [1440, 1024, 820, 800, 390, 360]) {
      await page.setViewport({ width, height: 1000, hasTouch: true });
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        columns: getComputedStyle(document.querySelector(".checkout-layout")).gridTemplateColumns.split(" ").length,
        total: document.querySelector(".checkout-total").getBoundingClientRect().bottom,
        button: document.querySelector('button[type="submit"]').getBoundingClientRect().top }));
      assert(layout.scroll <= width, JSON.stringify(layout));
      assert.equal(layout.columns, width <= 800 ? 1 : 2);
      assert(layout.button - layout.total < 45);
      if ([1440, 390, 360].includes(width)) await page.screenshot({ path: path.join(out, `checkout-${width}.png`), fullPage: true });
    }
    check("Dos columnas en escritorio; una en móvil, sin desbordamiento; total junto al botón en seis anchos");
    await fill('municipality', 'sandona');
    await page.screenshot({ path: path.join(out, 'sugerencias-sandona-360.png'), fullPage: true });
    await page.tap('#municipality-option-52683');
    assert.equal(await page.$eval('#municipality', (e) => e.value), 'Sandoná — Nariño');
    await page.screenshot({ path: path.join(out, 'seleccion-compra-local.png'), fullPage: true });
    failOrder = true;
    await page.click('button[type="submit"]'); await page.waitForFunction(() => document.body.innerText.includes("Fallo temporal de prueba"));
    assert.deepEqual(await snapshot(), entered); await ready();
    await page.evaluate(() => { const form = document.querySelector("form"); form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => location.pathname.includes("confirmacion") && document.body.innerText.includes("Pedido"));
    assert.equal(await countOrders(), initialCount + 1);
    assert.equal(result.purchases.length, 1);
    assert.equal(Object.hasOwn(result.purchases[0].body, "carrier"), false);
    const ce = await fixture.fresh(result.purchases[0].data.order.id);
    assert.equal(ce.carrier, ""); assert.equal(ce.paymentStatus, "pendiente"); assert.equal(ce.stockDeducted, true);
    const rawOrder = await fixture.M.Order.collection.findOne({ _id: ce._id });
    assert.equal(rawOrder.shippingAddress.city, 'Sandoná');
    assert.equal(rawOrder.shippingAddress.department, 'Nariño');
    const adminDetail = await fixture.api('GET', `/api/admin/orders/${ce._id}`, { cookie: fixture.cookies.admin });
    assert.equal(adminDetail.status, 200);
    assert.equal(adminDetail.json.order.shippingAddress.city, 'Sandoná');
    fs.writeFileSync(path.join(out, 'compra-local.json'), JSON.stringify({
      selectedOption: 'Sandoná — Nariño', municipalityId: '52683',
      request: { method: 'POST', endpoint: '/api/checkout/orders', body: result.purchases[0].body,
        carrierSent: Object.hasOwn(result.purchases[0].body, 'carrier') },
      responseStatus: result.purchases[0].status,
      mongo: { localEphemeralReplicaSet: true, database: fixture.mongoose.connection.name, collection: 'orders',
        _id: String(rawOrder._id), orderNumber: rawOrder.orderNumber, shippingAddress: rawOrder.shippingAddress, carrier: rawOrder.carrier },
      adminShippingAddress: adminDetail.json.order.shippingAddress,
    }, null, 2));
    check("Error del servidor conserva valores; doble envío crea un pedido contraentrega y navega a la confirmación real");
    await page.goto(origin + "/checkout?as=client"); await ready();
    assert.equal(await page.$eval("#name", (e) => e.value), user.name);
    assert.equal(await page.$eval("#address", (e) => e.value), "Casa predeterminada 123");
    assert.equal(await page.$eval('#municipality', (e) => e.value), 'Pasto — Nariño');
    await page.type('#notes', 'Nota de dirección guardada');
    await page.select('#savedAddress', 'bogota'); await ready();
    assert.equal(await page.$eval('#municipality', (e) => e.value), 'Bogotá, D.C. — Bogotá, D.C.');
    await page.select('#savedAddress', 'legacy'); await ready();
    assert.equal(await page.$eval('#address', (e) => e.value), 'Calle antigua 321');
    assert.equal(await page.$eval('#postalCode', (e) => e.value), '123456');
    assert.equal(await page.$eval('#phone', (e) => e.value), user.phone);
    assert.equal(await page.$eval('#notes', (e) => e.value), 'Nota de dirección guardada');
    await page.click('button[type="submit"]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'municipality');
    assert.equal(await page.$eval('#municipality-error', (e) => e.textContent), 'Selecciona una ciudad o municipio de la lista');
    check('Direcciones: pareja válida precargada, Bogotá propia, antigua ambigua exige solo municipio y conserva calle/teléfono/postal/notas');
    await page.select("#savedAddress", "office"); await ready();
    assert.equal(await page.$eval("#address", (e) => e.value), "Oficina 456");
    // La dirección histórica dice Cali; el catálogo oficial la denomina
    // Santiago de Cali. Se elige explícitamente, sin inferencias por substring.
    await fill('municipality', 'cali');
    await page.click('#municipality-option-76001');
    assert.equal(await page.$eval('#municipality', (e) => e.value), 'Santiago de Cali — Valle del Cauca');
    await ready();
    await fill("address", "Oficina corregida 789");
    await page.click('[name="payment"][value="wompi"]');
    await page.click("#consent-order_processing"); await page.click("#consent-terms");
    await page.evaluate(() => { const form = document.querySelector("form"); form.requestSubmit(); form.requestSubmit(); });
    await page.waitForFunction(() => location.hostname === "checkout.wompi.co");
    assert.equal(result.purchases.length, 2);
    const purchase = result.purchases[1], order = await fixture.fresh(purchase.data.order.id);
    assert.equal(order.shippingAddress.address, "Oficina corregida 789"); assert.equal(order.carrier, "");
    assert.equal(order.paymentStatus, "pendiente"); assert.equal(order.stockDeducted, false);
    assert.equal(String(order.user), user.id);
    const link = fixture.provider.links.get(order.wompi.paymentLinkId);
    await page.goto(origin + new URL(link.redirect_url).pathname + new URL(link.redirect_url).search);
    await page.waitForFunction(() => document.body.innerText.includes("Pedido registrado; pago pendiente"));
    assert.equal((await fixture.fresh(order._id)).paymentStatus, "pendiente");
    const tx = fixture.linkTx(order); fixture.provider.tx.set(tx.id, tx);
    assert.equal((await fixture.postEvent(tx)).status, 200);
    await page.reload(); await page.waitForFunction(() => document.body.innerText.includes("¡Gracias por tu compra!"));
    assert.equal((await fixture.fresh(order._id)).paymentStatus, "pagado");
    check("Cliente autenticado: datos/direcciones editables; Wompi redirige; retorno pendiente y pago solo tras evento verificado simulado");
    failQuote = true;
    await page.goto(origin + "/checkout");
    await page.waitForFunction(() => document.body.innerText.includes("Fallo de cotización de prueba"));
    assert.equal(await page.$eval('button[type="submit"]', (e) => e.disabled), true);
    await page.locator(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "Actualizar resumen")).click(); await ready();
    check("Error de cotización bloquea la compra y permite recuperar el resumen");
    assert.deepEqual(result.pageErrors, []); assert.deepEqual(result.externalRequests, []); assert.deepEqual(fixture.provider.blocked, []);
    // No persistir tokens de acceso ni datos de sesión en las evidencias.
    result.purchases = result.purchases.map(({ body, status, data }) => ({ paymentMethod: body.paymentMethod, carrierSent: Object.hasOwn(body, "carrier"), status, orderNumber: data.order.orderNumber }));
    result.passed = true;
  } catch (err) { result.error = err.stack || err.message; process.exitCode = 1; console.error(err); }
  finally {
    result.purchases = result.purchases.map((purchase) => purchase.body ? {
      paymentMethod: purchase.body.paymentMethod, carrierSent: Object.hasOwn(purchase.body, 'carrier'),
      status: purchase.status, orderNumber: purchase.data?.order?.orderNumber,
    } : purchase);
    if (browser) await browser.close(); if (server) await new Promise((resolve) => server.close(resolve)); await fixture.close();
    fs.writeFileSync(path.join(out, "resultado.json"), JSON.stringify(result, null, 2));
  }
})();
