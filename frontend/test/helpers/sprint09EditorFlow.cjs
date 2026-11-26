"use strict";
// Sprint 09 · product editor flow on real Next + Express + MongoDB (see sprint09-editor-next-browser.cjs).
// Fictitious data only. Images are local public files (no Cloudinary). Faults are injected by
// intercepting browser requests; "applied but lost" forwards the request to Express first.
const assert = require("node:assert/strict"), path = require("node:path");
const Size = require("../../../backend/src/models/size"), Color = require("../../../backend/src/models/color"), Category = require("../../../backend/src/models/category");

const IMAGES = ["/icon-192.png", "/icon-512.png", "/favicon-dizor-192.png", "/favicon-dizor.png", "/logoImagenes.png", "/logoHorizontal.png", "/file.svg", "/globe.svg", "/window.svg", "/images/guia-tallas.png"];
const LONG = `Sombrero tejido a mano en palma de iraca por artesanas de Sandoná.

# Material y origen
Fibra natural de palma de iraca, cocida y blanqueada sin químicos.

# Detalles
- Ala flexible de 8 cm
- Acabado a mano
- Cinta interior de algodón

# Cuidados
Guardar en lugar seco. No doblar el ala.`;

module.exports = async function flow(t) {
  const { page, ctx, fixture, origin, result, network, cookie, text, goto, shot, check, measure, sleep, MODE } = t;
  const api = (method, url, body, role = "superadmin") => fixture.api(method, url, { cookie: role === "admin" ? ctx.adminCookie : role === "vendedor" ? ctx.vendorCookie : ctx.superCookie, body });

  // ── Fictitious catalog ──
  const [cat] = await Promise.all([Category.create({ name: "Sombreros S09" })]);
  await Category.create({ name: "Bolsos S09" });
  const sizes = await Promise.all(["S", "M", "L", "XL"].map((name) => Size.create({ name: name + " S09" })));
  const colors = await Promise.all(["Natural", "Miel", "Negro"].map((name) => Color.create({ name: name + " S09" })));
  const variant = (sku, s, c, stock, extra = {}) => ({ sku, size: s != null ? sizes[s]._id : null, color: c != null ? colors[c]._id : null, stock, ...extra });
  const create = async (body) => { const r = await api("POST", "/api/admin/catalog/products", { category: cat._id, salePrice: 230000, internalCost: 90000, material: "Palma de iraca", images: [{ url: IMAGES[0] }], mainImage: IMAGES[0], ...body }); assert.equal(r.status, 201, JSON.stringify(r.json)); return r.json.product; };
  const three = await create({ name: "Sombrero vueltiao fino", shortDescription: "Sombrero de ala media tejido a mano.", fullDescription: LONG, seoTitle: "Sombrero vueltiao fino | SEO histórico", seoDescription: "Descripción SEO guardada antes del sprint.", discountPercent: 10, onPromotion: true, isFeatured: true,
    images: IMAGES.map((url, i) => ({ url, alt: `Vista ${i + 1}` })), mainImage: IMAGES[1], variants: [variant("SVF-01", 0, 0, 8), variant("SVF-02", 1, 0, 5), variant("SVF-03", 2, 0, 3, { price: 250000 })] });
  const many = await create({ name: "Bolso iraca grande", variants: Array.from({ length: 9 }, (_, i) => variant(`BIG-${String(i + 1).padStart(2, "0")}`, i % 4, i % 3, i + 1)).filter((v, i, a) => a.findIndex((x) => String(x.size) === String(v.size) && String(x.color) === String(v.color)) === i) });
  const one = await create({ name: "Individual de palma", images: [{ url: IMAGES[6] }], mainImage: IMAGES[6], variants: [variant("IND-01", null, null, 12)] });
  const id = (p) => p.id || p._id;
  const returnTo = "/admin/productos?q=Sombrero&page=1";
  const editUrl = (p) => `/admin/productos/${id(p)}/editar?returnTo=${encodeURIComponent(returnTo)}`;
  const element = async (selector, name) => { const el = await page.$(selector); assert.ok(el, selector); await el.evaluate((e) => e.scrollIntoView({ block: "center" })); await sleep(80); await el.screenshot({ path: path.join(t.out, name + ".png") }); result.screenshots.push(name + ".png"); };
  const vp = (width, height = 900) => page.setViewport({ width, height });
  await cookie("admin");

  if (MODE === "antes") {
    await vp(1440); await goto("/admin/productos/nuevo", "Información general"); await shot("nuevo-1440"); await measure("nuevo-1440");
    await vp(390, 844); await shot("nuevo-390"); await measure("nuevo-390");
    await vp(360, 800); await measure("nuevo-360");
    await vp(1440); await goto(editUrl(three), "Información general"); await sleep(400); await shot("editar-1440"); await measure("editar-1440");
    await element("#product-images", "galeria-1440"); await element("#product-variants", "variantes-1440"); await element("#product-publication", "publicacion-1440");
    await page.evaluate(() => document.querySelector(".variant-adjustment-legacy")?.setAttribute("open", "")); await element("#product-variants", "ajuste-abierto-1440");
    await vp(390, 844); await goto(editUrl(three), "Información general"); await sleep(400); await shot("editar-390"); await measure("editar-390");
    await element("#product-variants", "variantes-390");
    await vp(360, 800); await measure("editar-360");
    await vp(1440); await goto(editUrl(many), "Información general"); await sleep(300); await measure("muchas-variantes-1440"); await vp(390, 844); await measure("muchas-variantes-390");
    await vp(1440); await goto("/admin/productos/nuevo", "Información general");
    await page.$eval("form.product-form", (f) => f.requestSubmit()); await sleep(500); await shot("error-validacion-1440", false);
    network.handle = async (r) => { if (r.method() === "PATCH" && r.url().includes("/admin/catalog/products/")) { await sleep(4000); r.continue(); return true; } return false; };
    await goto(editUrl(one), "Información general");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Guardar cambios").click()); await text("Guardando…"); await shot("guardando-1440", false);
    network.handle = null; await sleep(4500);
    return;
  }

  // ════════════════ helpers for the new editor ════════════════
  const sections = ["general", "images", "price", "variants", "publication"];
  const expanded = (s) => page.$eval(`#pe-toggle-${s}`, (b) => b.getAttribute("aria-expanded") === "true");
  const openSections = async () => (await Promise.all(sections.map(expanded))).map((v, i) => v && sections[i]).filter(Boolean);
  const toggle = async (s) => { await page.click(`#pe-toggle-${s}`); await page.waitForFunction((s) => document.getElementById(`pe-toggle-${s}`).getAttribute("aria-expanded") === "true", {}, s); };
  const visible = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
  const fill = async (sel, value) => { await page.$eval(sel, (e, v) => { const proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : e.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(e, v); e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, value); };
  const clickText = async (label, scope = "body") => { const h = await page.waitForFunction((l, s) => [...document.querySelector(s).querySelectorAll("button,a,[role=menuitem]")].find((e) => e.getClientRects().length && e.textContent.trim() === l), { timeout: 15000 }, label, scope); await h.click(); await h.dispose(); };
  const submit = () => page.$eval("form.product-form", (f) => f.requestSubmit());
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const db = async (p) => ctx.Product.findById(id(p)).lean();
  const widths = [[1440, 1000], [1024, 900], [820, 1180], [390, 844], [360, 800]];

  // ── E01 new product: compact start ──
  await vp(1440); await goto("/admin/productos/nuevo", "Información general");
  assert.deepEqual(await openSections(), ["general"]);
  for (const s of sections.slice(1)) assert.equal(await visible(`#pe-panel-${s}`), false, s);
  const summaries = await page.$$eval(".pe-section__summary", (n) => n.map((e) => e.textContent.trim()));
  assert.ok(summaries[1].includes("0 de 10"), summaries[1]);
  assert.equal(await page.$$eval("button[type=submit]", (n) => n.filter((b) => b.getClientRects().length).length), 1, "un solo botón de guardado");
  assert.equal(await visible(".pe-savebar"), true);
  await shot("nuevo-1440"); await measure("nuevo-1440");
  await vp(390, 844); await shot("nuevo-390"); const nuevoMovil = await measure("nuevo-390");
  assert.ok(nuevoMovil.height < 2200, "nuevo móvil compacto " + nuevoMovil.height);
  await vp(360, 800); await measure("nuevo-360");
  check("E01", "nuevo producto: solo Información general abierta, resúmenes por sección y una sola acción de guardado");

  // ── E02 draft survives section changes ──
  await vp(1440);
  await fill("#name", "Sombrero borrador S09"); const skuBefore = await page.$eval('[aria-label="SKU variante 1"]', (e) => e.value);
  await toggle("images"); assert.deepEqual(await openSections(), ["images"]);
  await fill("#pe-image-url", IMAGES[2]); await clickText("Agregar", "#pe-panel-images"); await text("1 de 10");
  await toggle("price"); await fill("#salePrice", "180000");
  await toggle("general");
  assert.equal(await page.$eval("#name", (e) => e.value), "Sombrero borrador S09");
  assert.equal(await page.$eval('[aria-label="SKU variante 1"]', (e) => e.value), skuBefore, "el SKU no se regenera al cambiar de sección");
  assert.equal(await page.$eval("#salePrice", (e) => e.value), "180000");
  assert.equal(await page.$$eval(".pe-gallery li", (n) => n.length), 1);
  assert.ok((await page.$eval("#pe-toggle-price .pe-section__summary", (e) => e.textContent)).includes("180.000"));
  check("E02", "cambiar de sección conserva nombre, imágenes, precio y SKU; los resúmenes reflejan el borrador");
  await vp(390, 844); await shot("nuevo-parcial-390"); await vp(1440);

  // ── E03 error in a collapsed section opens it and focuses the field ──
  await toggle("publication");
  await submit(); await text("Revisa");
  assert.deepEqual(await openSections(), ["general"]);
  assert.equal(await page.evaluate(() => document.activeElement.id), "category");
  assert.equal(await page.$eval("#category", (e) => e.getAttribute("aria-invalid")), "true");
  await text("Selecciona la categoría");
  await shot("error-validacion-1440", false);
  await page.select("#category", String(cat._id));
  await fill("#salePrice", ""); await toggle("variants"); await submit();
  await page.waitForFunction(() => document.activeElement.id === "salePrice");
  assert.deepEqual(await openSections(), ["price"]);
  check("E03", "error en sección contraída: se abre, se enfoca el campo y se anuncia junto al campo");
  await fill("#salePrice", "180000");

  // ── E04 create: double submit → one POST; ambiguous result verified by SKU ──
  let posts = 0;
  network.handle = async (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/admin/catalog/products") {
      posts++;
      // Applied on the server, answer lost on the way back.
      const res = await fetch(r.url(), { method: "POST", headers: { "Content-Type": "application/json", cookie: ctx.adminCookie }, body: r.postData() });
      await res.text(); await sleep(300);
      await r.respond({ status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ message: "Servicio no disponible" }) }).catch(() => r.abort());
      return true;
    }
    return false;
  };
  await page.$eval("form.product-form", (f) => { f.requestSubmit(); f.requestSubmit(); });
  await text("No se pudo confirmar");
  assert.equal(posts, 1, "doble envío: una petición");
  assert.equal(await page.$eval("button[type=submit]", (b) => b.disabled), true, "sin reenvío mientras el resultado es desconocido");
  await shot("resultado-desconocido-1440", false);
  network.handle = null;
  await clickText("Comprobar guardado"); await page.waitForFunction(() => location.pathname === "/admin/productos");
  const created = await ctx.Product.findOne({ name: "Sombrero borrador S09" }).lean();
  assert.ok(created); assert.equal(await ctx.Product.countDocuments({ name: "Sombrero borrador S09" }), 1);
  assert.equal(created.variants[0].sku, skuBefore); assert.equal(created.mainImage, IMAGES[2]); assert.equal(created.salePrice, 180000);
  check("E04", "creación: doble clic = una petición; respuesta perdida comprobada por SKU, sin duplicar el producto");
  check("E09", "respuesta ambigua: guardado bloqueado hasta comprobar el resultado real");

  // ── E05 edit: compact edit, variants collapsed ──
  await vp(1440); await goto(editUrl(three), "Sombrero vueltiao fino");
  assert.deepEqual(await openSections(), ["general"]);
  assert.equal(await page.$eval("#seoTitle", (e) => e.value), "Sombrero vueltiao fino | SEO histórico");
  const aside = await page.$eval(".pe-aside", (e) => e.innerText);
  for (const s of ["Sombrero vueltiao fino", "230.000", "3 variantes", "10 imágenes", "Activo"]) assert.ok(aside.includes(s), `resumen: ${s} · ${aside}`);
  await shot("editar-1440"); await measure("editar-1440");
  check("E05", "edición: resumen lateral con datos reales y SEO histórico intacto");
  await toggle("variants");
  assert.equal(await page.$$eval(".pe-variant", (n) => n.length), 3);
  assert.equal(await page.$$eval(".pe-variant__panel", (n) => n.filter((e) => e.getClientRects().length).length), 0, "variantes contraídas");
  const v1 = await page.$eval(".pe-variant", (e) => e.innerText); assert.ok(v1.includes("SVF-01") && v1.includes("8 unidades") && v1.includes("Activa"), v1);
  await element("#pe-panel-variants", "variantes-contraidas-1440");
  check("E16", "variantes contraídas: talla/color, SKU, unidades y estado");

  // ── E06 variant edit, one open at a time without losing changes ──
  await clickText("Editar variante 2"); assert.equal(await visible('[aria-label="Precio variante 2"]'), true);
  await fill('[aria-label="Precio variante 2"]', "240000");
  await clickText("Editar variante 3");
  assert.equal(await visible('[aria-label="Precio variante 2"]'), false); assert.equal(await page.$eval('[aria-label="Precio variante 2"]', (e) => e.value), "240000");
  assert.ok((await page.$$eval(".pe-variant", (n) => n[1].innerText)).includes("Cambios sin guardar"));
  await element("#pe-panel-variants", "variante-expandida-1440");
  check("E17", "una variante abierta a la vez; los cambios de la anterior se conservan y se señalan");

  // ── E07 stock: read-only existing, relative adjustment, concurrent sale ──
  assert.equal(await page.$eval('[aria-label="Stock variante 3"]', (e) => e.readOnly), true);
  await clickText("Ajustar existencias", ".pe-variant:nth-child(3)");
  await fill('.pe-variant:nth-child(3) [aria-label="Cantidad del ajuste"]', "4"); await fill('.pe-variant:nth-child(3) [aria-label="Motivo del ajuste"]', "Reposición ficticia S09");
  await element(".pe-variant:nth-child(3)", "ajuste-abierto-1440");
  let adjusts = 0;
  network.handle = async (r) => { if (r.method() === "POST" && r.url().endsWith("/stock")) { adjusts++; if (adjusts === 1) { await r.respond({ status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: "{}" }).catch(() => r.abort()); return true; } } return false; };
  await page.$eval(".pe-variant:nth-child(3) .pe-adjust__submit", (b) => { b.click(); b.click(); });
  await text("Reintenta la misma operación");
  await clickText("Reintentar ajuste", ".pe-variant:nth-child(3)"); await text("Ajuste registrado. Stock: 7");
  network.handle = null;
  assert.equal(adjusts, 2);
  assert.equal((await db(three)).variants[2].stock, 7);
  check("E23", "ajuste relativo: fallo ambiguo conserva la clave, reintento aplica una vez (3 → 7)");
  // Concurrent sale while the form is open: the edit must not overwrite it.
  await ctx.Product.updateOne({ _id: id(three), "variants.sku": "SVF-01" }, { $inc: { "variants.$.stock": -2 } });
  await toggle("price"); await fill("#discountPercent", "15");
  let patchBody = null;
  network.handle = async (r) => { if (r.method() === "PATCH" && r.url().includes("/admin/catalog/products/")) { patchBody = JSON.parse(r.postData()); } return false; };
  await page.$eval("form.product-form", (f) => { f.requestSubmit(); f.requestSubmit(); });
  await page.waitForFunction((rt) => location.pathname + location.search === rt, {}, returnTo);
  network.handle = null;
  const saved = await db(three);
  assert.equal(saved.variants[0].stock, 6, "venta concurrente conservada"); assert.equal(saved.variants[2].stock, 7);
  assert.equal(saved.variants[1].price, 240000); assert.equal(saved.discountPercent, 15);
  assert.ok(patchBody.variants.every((v) => !v.id || !Object.hasOwn(v, "stock")));
  assert.deepEqual(saved.images.map((i) => i.url), IMAGES); assert.equal(saved.mainImage, IMAGES[1]);
  assert.equal(saved.seoTitle, "Sombrero vueltiao fino | SEO histórico");
  check("E21", "stock existente de solo lectura y fuera del guardado");
  check("E24", "venta concurrente durante la edición conservada (8 → 6)");
  check("E30", "regreso a la lista filtrada tras guardar (q y página)");

  // ── E08 gallery: 10 images, main, menu by keyboard, delete keeps order ──
  await vp(1440); await goto(editUrl(three), "Sombrero vueltiao fino"); await toggle("images");
  assert.equal(await page.$$eval(".pe-gallery li", (n) => n.length), 10); await text("10 de 10");
  assert.equal(await page.$eval("#pe-image-url", (e) => e.disabled), true, "límite de 10");
  const mainIndex = await page.$$eval(".pe-gallery li", (n) => n.findIndex((li) => li.innerText.includes("Principal")));
  assert.equal(mainIndex, 1);
  assert.equal(await page.$$eval(".pe-gallery li button", (n) => n.filter((b) => b.getClientRects().length && /Eliminar|Hacer principal/.test(b.textContent)).length), 0, "sin botones repetidos visibles");
  await element("#pe-panel-images", "galeria-1440");
  const trigger = await page.$('button[aria-label="Acciones de la imagen 4"]');
  await trigger.focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Hacer principal");
  await element(".pe-gallery li:nth-child(4)", "galeria-menu-1440");
  await page.keyboard.press("Escape"); assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Acciones de la imagen 4");
  await page.keyboard.press("Enter"); await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem"); await page.keyboard.press("Enter");
  assert.ok((await page.$eval(".pe-gallery li:nth-child(4)", (e) => e.innerText)).includes("Principal"));
  await page.click('button[aria-label="Acciones de la imagen 6"]'); await clickText("Eliminar", ".pe-gallery li:nth-child(6)");
  await text("9 de 10");
  await page.click('button[aria-label="Acciones de la imagen 2"]'); await clickText("Ver ampliada", ".pe-gallery li:nth-child(2)");
  await page.waitForSelector("dialog.pe-preview[open]"); await shot("galeria-ampliada-1440", false);
  await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("dialog.pe-preview[open]"));
  await page.$eval("form.product-form", (f) => f.requestSubmit()); await page.waitForFunction((rt) => location.pathname + location.search === rt, {}, returnTo);
  const gallery = await db(three);
  assert.deepEqual(gallery.images.map((i) => i.url), IMAGES.filter((_, i) => i !== 5)); assert.equal(gallery.mainImage, IMAGES[3]);
  check("E15", "diez imágenes, límite respetado y añadir deshabilitado");
  check("E12", "imagen principal identificada y cambiada desde el menú contextual");
  check("E13", "imagen eliminada sin alterar la principal ni el resto");
  check("E14", "orden real de las imágenes conservado al guardar");
  check("E32", "menú de imagen operable con teclado: Enter, flechas, Escape y retorno de foco");

  // ── E10 add variant, unique SKU, duplicate combination located ──
  await goto(editUrl(one), "Individual de palma"); await toggle("variants");
  await clickText("Agregar variante");
  const skus = await page.$$eval('[aria-label^="SKU variante"]', (n) => n.map((e) => e.value));
  assert.equal(skus.length, 2); assert.equal(skus[0], "IND-01"); assert.notEqual(skus[1], "IND-01"); assert.ok(skus[1]);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Talla variante 2");
  assert.equal(await page.$eval('[aria-label="Stock variante 2"]', (e) => e.readOnly), false);
  // Same size/colour as IND-01 (both empty): the duplicate is located on the new variant.
  await toggle("general"); await submit();
  await page.waitForFunction(() => document.activeElement.getAttribute("aria-label") === "Talla variante 2");
  await text("misma talla y color");
  await shot("variante-nueva-error-1440", false);
  check("E20", "combinación repetida: se abre la variante y se enfoca su talla");
  await page.select('[aria-label="Talla variante 2"]', String(sizes[3]._id));
  await fill('[aria-label="Stock variante 2"]', "1.5"); await toggle("general"); await submit();
  await page.waitForFunction(() => document.activeElement.getAttribute("aria-label") === "Stock variante 2");
  await text("número entero");
  await fill('[aria-label="Stock variante 2"]', "4");
  await shot("variante-nueva-1440", false);
  check("E22", "variante nueva con existencias iniciales enteras (1,5 rechazado antes de enviar)");
  await page.$eval("form.product-form", (f) => f.requestSubmit()); await page.waitForFunction((rt) => location.pathname + location.search === rt, {}, returnTo);
  const added = await db(one);
  assert.equal(added.variants.length, 2); assert.equal(added.variants[0].stock, 12); assert.equal(added.variants[1].stock, 4); assert.equal(added.variants[1].sku, skus[1]);
  check("E18", "agregar variante: formulario bajo demanda y guardado");
  check("E19", "SKU nuevo único; los existentes no se regeneran");

  // ── E11 SKU duplicate and inactive variant ──
  await goto(editUrl(one), "Individual de palma"); await toggle("variants");
  await clickText("Editar variante 2"); await fill('[aria-label="SKU variante 2"]', "IND-01"); await toggle("publication"); await submit();
  await page.waitForFunction(() => document.activeElement.getAttribute("aria-label") === "SKU variante 2"); await text("SKU");
  await fill('[aria-label="SKU variante 2"]', added.variants[1].sku);
  await page.click('[aria-label="Activa variante 2"]');
  assert.ok((await page.$$eval(".pe-variant", (n) => n[1].innerText)).includes("Inactiva"));
  await page.$eval("form.product-form", (f) => f.requestSubmit()); await page.waitForFunction((rt) => location.pathname + location.search === rt, {}, returnTo);
  const inactive = await db(one); assert.equal(inactive.variants[1].isActive, false); assert.equal(inactive.variants[1].stock, 4);
  check("E10", "validaciones de SKU duplicado y existencias, con foco en el campo");
  check("E25", "variante desactivada conserva sus existencias");

  // ── E26–E29 price, cost, publication, SEO ──
  await goto(editUrl(one), "Individual de palma"); await toggle("price");
  assert.equal(await page.$eval("#internalCost", (e) => e.value), "90000");
  const priceWidth = await page.$eval("#salePrice", (e) => e.getBoundingClientRect().width); assert.ok(priceWidth < 320, "campo numérico acotado " + priceWidth);
  await fill("#discountPercent", "20"); await page.click("#onPromotion");
  assert.ok((await page.$eval("#pe-toggle-price .pe-section__summary", (e) => e.textContent)).includes("20 %"));
  await toggle("publication");
  await page.click("#isNew"); await page.click("#allowsCustomization");
  assert.ok((await page.$eval("#pe-toggle-publication .pe-section__summary", (e) => e.textContent)).includes("Nuevo"));
  await fill("#seoDescription", "Individual de palma tejido a mano para la mesa.");
  assert.equal(await page.$eval("#seoTitle", (e) => e.maxLength), 70);
  await element("#pe-panel-publication", "publicacion-1440");
  await page.$eval("form.product-form", (f) => f.requestSubmit()); await page.waitForFunction((rt) => location.pathname + location.search === rt, {}, returnTo);
  const pub = await db(one);
  assert.equal(pub.discountPercent, 20); assert.equal(pub.onPromotion, true); assert.equal(pub.isNew, true); assert.equal(pub.allowsCustomization, true); assert.equal(pub.isActive, true);
  assert.equal(pub.seoDescription, "Individual de palma tejido a mano para la mesa."); assert.equal(pub.internalCost, 90000);
  check("E26", "precio y promoción guardados sin cambiar la lógica de cálculo");
  check("E27", "costo interno visible y conservado para administración");
  check("E28", "SEO: límites del modelo y valores guardados");
  check("E29", "publicación: opciones compactas con su estado en el resumen");

  // ── E31 permissions ──
  await cookie("vendedor"); await page.goto(origin + "/admin/productos/nuevo", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !location.pathname.startsWith("/admin/productos/nuevo"), { timeout: 20000 });
  assert.equal((await api("POST", "/api/admin/catalog/products", { name: "x" }, "vendedor")).status, 403);
  assert.equal((await api("PATCH", `/api/admin/catalog/products/${id(one)}`, { name: "x" }, "vendedor")).status, 403);
  await cookie("admin");
  check("E31", "vendedor sin acceso al editor ni a la API de escritura");

  // ── unsaved changes guard ──
  await goto(editUrl(one), "Individual de palma"); await fill("#name", "Individual cambiado");
  await clickText("← Volver a la lista filtrada"); await page.waitForSelector(".admin-confirm[role=dialog]");
  assert.equal(await page.evaluate(() => location.pathname.endsWith("/editar")), true);
  await clickText("Seguir editando"); assert.equal(await page.$eval("#name", (e) => e.value), "Individual cambiado");
  await page.click(".admin-sidebar a[href='/admin']"); await page.waitForSelector(".admin-confirm[role=dialog]");
  await clickText("Descartar cambios"); await page.waitForFunction(() => location.pathname === "/admin");
  assert.equal((await db(one)).name, "Individual de palma");
  check("E05b", "cambios sin guardar: confirmación al salir por enlace interno; descartar no guarda");

  // ── E07 saving state and edit-ambiguous verification ──
  await goto(editUrl(one), "Individual de palma"); await fill("#name", "Individual de palma editado");
  network.handle = async (r) => { if (r.method() === "PATCH" && r.url().includes("/admin/catalog/products/")) { await sleep(1500); const res = await fetch(r.url(), { method: "PATCH", headers: { "Content-Type": "application/json", cookie: ctx.adminCookie }, body: r.postData() }); await res.text(); await r.respond({ status: 502, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: "{}" }).catch(() => r.abort()); return true; } return false; };
  await submit(); await text("Guardando…"); await shot("guardando-1440", false);
  await vp(390, 844); await shot("guardando-390", false); await vp(1440);
  await text("No se pudo confirmar"); network.handle = null;
  await clickText("Comprobar guardado"); await page.waitForFunction((rt) => location.pathname + location.search === rt, {}, returnTo);
  assert.equal((await db(one)).name, "Individual de palma editado");
  check("E07", "guardado con estado de proceso; respuesta perdida en edición comprobada contra el servidor");

  // ── E33 responsive + mobile length ──
  for (const [w, h] of widths) {
    await vp(w, h);
    for (const [url, wait, name] of [["/admin/productos/nuevo", "Información general", "nuevo"], [editUrl(three), "Sombrero vueltiao fino", "editar"], [editUrl(many), "Bolso iraca grande", "muchas"]]) {
      await goto(url, wait); assert.equal(await noOverflow(), true, `${name} ${w}`); await measure(`${name}-${w}`);
    }
  }
  await vp(390, 844); await goto(editUrl(three), "Sombrero vueltiao fino"); await shot("editar-390"); const editMobile = await measure("editar-390-inicial");
  assert.ok(editMobile.height < 2200, "edición móvil compacta " + editMobile.height);
  assert.deepEqual(await openSections(), ["general"]);
  await toggle("variants"); await shot("variantes-390"); const variants390 = await measure("variantes-390");
  await clickText("Editar variante 2"); await shot("variante-expandida-390");
  await toggle("images"); await shot("galeria-390");
  await goto(editUrl(many), "Bolso iraca grande"); await toggle("variants"); await shot("muchas-variantes-390"); await measure("muchas-variantes-390-abiertas");
  // The sticky save bar never hides the focused field.
  await goto(editUrl(three), "Sombrero vueltiao fino"); await toggle("publication"); await page.focus("#seoDescription");
  const covered = await page.evaluate(() => { const f = document.activeElement.getBoundingClientRect(), b = document.querySelector(".pe-savebar").getBoundingClientRect(); return f.bottom > b.top + 1; });
  assert.equal(covered, false, "barra de guardado sin tapar el campo enfocado");
  await vp(360, 800); await goto(editUrl(three), "Sombrero vueltiao fino"); await shot("editar-360");
  check("E33", `responsive 1440–360 sin desbordes; edición móvil ${editMobile.height}px, variantes abiertas ${variants390.height}px`);
  check("E03b", "formulario inicialmente compacto en móvil: solo Información general abierta");

  // ── E32 keyboard on section toggles and description preview ──
  await vp(1440); await goto(editUrl(three), "Sombrero vueltiao fino");
  await page.focus("#pe-toggle-price"); await page.keyboard.press("Enter"); assert.deepEqual(await openSections(), ["price"]);
  await page.focus("#pe-toggle-general"); await page.keyboard.press(" "); assert.deepEqual(await openSections(), ["general"]);
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle); assert.notEqual(ring, "none");
  const desc = await page.$eval("#fullDescription", (e) => ({ value: e.value, h: e.getBoundingClientRect().height })); assert.equal(desc.value, LONG);
  await clickText("Vista previa"); await page.waitForSelector(".pe-preview-body h3, .pe-preview-body h2"); await text("Ala flexible de 8 cm");
  await element("#pe-panel-general", "descripcion-vista-previa-1440");
  await goto("/admin/productos/nuevo", "Información general");
  const emptyDesc = await page.$eval("#fullDescription", (e) => e.getBoundingClientRect().height); assert.ok(emptyDesc < 180, "descripción vacía sin altura fija gigante " + emptyDesc);
  check("E32b", "teclado en las secciones (Enter y Espacio), foco visible y vista previa con el formato real");
  result.descriptionHeights = { long: desc.h, empty: emptyDesc };
};
