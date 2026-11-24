"use strict";
// Sprint 05: Tienda online real (ContentWorkspace y pestañas), estilos del admin, API local.
// Sin Next, sin Mongo, sin Cloudinary y sin red externa.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."), frontend = path.join(root, "frontend");
const out = path.join(root, "docs/auditoria-admin/rediseño-premium/evidencias-sprint-05");
const puppeteer = require(process.env.DIZOR_BROWSER_TOOLS || "C:/Users/Asus ExpertBook/AppData/Local/Temp/dizor-verify-puppeteer/node_modules/puppeteer-core");
const webpack = require(path.join(frontend, "node_modules/next/dist/compiled/webpack/webpack.js")).webpack;
const srcRoot = path.join(frontend, "src");
fs.mkdirSync(out, { recursive: true });
const stage = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dizor-sprint05-"));
const result = { checks: [], externalRequests: [], pageErrors: [], consoleErrors: [], mutations: [], screenshots: [] };
let browser, server;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [1440, 1024, 820, 390, 360];
const home = { hero: { brandClaim: "DIZOR", title: "Oficio colombiano, piezas que perduran", subtitle: "Palma de iraca tejida en Sandoná.", ctaLabel: "Ver catálogo", ctaHref: "/catalogo", secondaryCtaLabel: "Nuestra historia", secondaryCtaHref: "/pagina/sobre-dizor" }, features: [{ title: "Hecho a mano", text: "En Sandoná" }], announcement: { isActive: true, items: [{ text: "Envíos a toda Colombia", linkHref: "" }] }, newSection: { eyebrow: "LO NUEVO", title: "Novedades", subtitle: "Piezas recién marcadas.", linkLabel: "Ver novedades", linkHref: "/catalogo?isNew=true", isActive: true }, craftSection: { eyebrow: "COLECCIÓN", title: "Nuestros tejidos", subtitle: "Brisa, Común y Súper fino.", linkLabel: "Ver" }, historia: { eyebrow: "ORIGEN", title: "Del páramo a la fibra", body: "Cada puntada es memoria.", ctaLabel: "Sobre Dizor", ctaHref: "/pagina/sobre-dizor" }, personalizacion: { eyebrow: "A TU MEDIDA", title: "Personaliza", body: "Iniciales y horma.", bullets: ["Iniciales"], ctaLabel: "Personalizar", ctaHref: "/personalizar", whatsappHint: "Escríbenos", imageOnLeft: true }, porMayor: { eyebrow: "POR VOLUMEN", title: "Por mayor", body: "Para tiendas.", bullets: ["Mínimo 5"], ctaLabel: "Cotizar", ctaHref: "/pedido-mayor", imageOnLeft: false }, reseñasSection: { eyebrow: "VOCES", title: "Quienes ya eligieron Dizor", isActive: true }, randomProductsSection: { eyebrow: "CURADURÍA", title: "Descubre hoy", subtitle: "Cinco piezas.", linkLabel: "Ver más", linkHref: "/catalogo", itemLinkLabel: "Ver", isActive: true }, inspiracion: { eyebrow: "INSPIRACIÓN", title: "La pieza en la vida real", subtitle: "Fotografías del oficio.", ctaLabel: "Instagram", instagramUrl: "https://www.instagram.com/sombrereriadizor/" }, newsletterSection: { eyebrow: "NOVEDADES", title: "Entérate", subtitle: "Avisos puntuales." } };
const appearance = { siteName: "Dizor", logoUrl: "", primaryColor: "#252725", accentColor: "#B87305", bgColor: "#F7F6F2", faviconUrl: "" };
const marketing = { key: "default", popup: { title: "Aviso", text: "Texto", ctaLabel: "", ctaHref: "", imageUrl: "", variant: "newsletter", couponCode: "", enabled: false, showNewsletterForm: true, delaySeconds: 4 }, newsletter: { footerTitle: "Correo", footerText: "Avisos", successMessage: "Listo" }, abandonedCart: { emailSubject: "Carrito", enabled: false, featureEnabled: false, delayHours: 24, maxReminders: 2 } };
(async () => {
 try {
  const w = (name, body) => { const file = path.join(stage, name); fs.writeFileSync(file, body); return file; };
  const loader = w("jsx.cjs", `const swc=require(${JSON.stringify(path.join(frontend, "node_modules/@next/swc-win32-x64-msvc"))});module.exports=function(source){return swc.transformSync(source,false,Buffer.from(JSON.stringify({filename:this.resourcePath,jsc:{parser:{syntax:"ecmascript",jsx:true},transform:{react:{runtime:"automatic"}}},module:{type:"commonjs"}}))).code;};`);
  const cssLoader = w("css.cjs", `module.exports=function(source){if(!this.resourcePath.endsWith('.module.css'))return 'module.exports={}';return 'module.exports={}';};`);
  const navigation = w("navigation.js", `import {useSyncExternalStore} from 'react';const subscribe=(fn)=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const useSearchParams=()=>{const s=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(s);};export const navigate=(url,replace)=>{history[replace?'replaceState':'pushState']({},'',url);dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:(u)=>navigate(u),replace:(u)=>navigate(u,true),prefetch(){}});`);
  const link = w("link.jsx", `import React from 'react';import {navigate} from './navigation';export default function Link({href,onClick,children,prefetch,scroll,...props}){return <a href={href} {...props} onClick={e=>{if(onClick)onClick(e);if(!e.defaultPrevented && String(href).startsWith('/')&&!e.metaKey&&!e.ctrlKey){e.preventDefault();navigate(href);}}}>{children}</a>}`);
  const image = w("image.jsx", `import React from 'react';export default function Image({src,alt,width,height,unoptimized,fill,priority,sizes,...p}){return <img src={src} alt={alt||''} width={width} height={height} {...p}/>}`);
  const auth = w("auth.js", `export const useAuth=()=>({user:{name:'Operadora ficticia',role:sessionStorage.getItem('role')||'admin'},loadingAuth:false,logout:async()=>{}});`);
  const site = w("site.js", `export const useSiteConfig=()=>({siteName:'DIZOR'});`);
  const alerts = w("alerts.js", `export const getAlerts=async()=>({alerts:{},totalCount:0});`);
  const services = w("services.js", `async function call(url,method='GET',data){const r=await fetch('/mock'+url,{method,headers:{'Content-Type':'application/json'},...(data!==undefined?{body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok){const e=new Error('fixture');e.response={status:r.status,data:body};throw e;}return body;}
export const getAdminHomeContent=()=>call('/content/home');
export const updateAdminHomeContent=(data)=>call('/content/home','PATCH',data);
export const getAdminPages=()=>call('/content/pages');
export const getAdminPage=(id)=>call('/content/pages/'+id);
export const createAdminPage=(data)=>call('/content/pages','POST',data);
export const updateAdminPage=(id,data)=>call('/content/pages/'+id,'PATCH',data);
export const deleteAdminPage=(id)=>call('/content/pages/'+id,'DELETE',{});
export const getAdminBanners=()=>call('/content/banners');
export const createAdminBanner=(data)=>call('/content/banners','POST',data);
export const updateAdminBanner=(id,data)=>call('/content/banners/'+id,'PATCH',data);
export const deleteAdminBanner=(id)=>call('/content/banners/'+id,'DELETE',{});
export const uploadCmsImage=async()=>({url:'https://res.cloudinary.com/demo/image/upload/ficticia.jpg'});
export const getMarketingSettings=async()=>call('/marketing');
export const updateMarketingSettings=(data)=>call('/marketing','PATCH',data);
export const getNewsletterSubscribers=async()=>({status:'success',subscribers:[]});
export const getAbandonedCarts=async()=>({status:'success',carts:[]});
export const sendAbandonedReminders=async()=>({message:'ok'});
export const exportNewsletterCsv=async()=>new Blob();
export const exportOrdersCsv=async()=>new Blob();
export const exportAbandonedCartsCsv=async()=>new Blob();
export const getStoreSettings=async()=>call('/settings');
export const updateStoreSettings=(data)=>call('/settings','PATCH',data);
export const getCoupons=async()=>({coupons:[]});
export const getAdminHomeImages=()=>call('/home-images');
export const createAdminHomeImage=(data)=>call('/home-images','POST',{seccion:data.seccion,altText:data.altText,titulo:data.titulo});
export const updateAdminHomeImage=(id,data)=>call('/home-images/'+id,'PATCH',data);
export const reorderAdminHomeImages=(items)=>call('/home-images/reorder','PATCH',{items});
export const deleteAdminHomeImage=(id)=>call('/home-images/'+id,'DELETE',{});
export const getCatalogFilters=async()=>({filters:{weaveTypes:[{_id:'weave1',name:'Brisa'}]}});
export const getAdminReviews=(params)=>call('/reviews?'+new URLSearchParams(params));
export const approveAdminReview=(id)=>call('/reviews/'+id+'/approve','PATCH',{});
export const rejectAdminReview=(id)=>call('/reviews/'+id,'DELETE',{});
export const createBrandReview=(data)=>call('/reviews/brand','POST',data);`);
  const entry = w("entry.jsx", `import React from 'react';import {createRoot} from 'react-dom/client';import Page from ${JSON.stringify(path.join(srcRoot, "app/admin/contenido/page.js"))};createRoot(document.getElementById('app')).render(<React.Suspense fallback={<p>Cargando…</p>}><Page/></React.Suspense>);`);
  const compiler = webpack({ mode: "production", optimization: { minimize: false }, context: frontend, entry, output: { path: stage, filename: "bundle.js" }, performance: { hints: false },
    resolve: { extensions: [".js", ".jsx", ".mjs", ".json"], modules: [path.join(frontend, "node_modules"), "node_modules"], alias: { "next/link": link, "next/navigation": navigation, "next/image": image, "@/context/AuthContext": auth, "@/context/SiteConfigContext": site, "@/services/adminAlertService": alerts, "@/services/adminCmsService": services, "@/services/adminMarketingService": services, "@/services/adminSettingsService": services, "@/services/adminCouponService": services, "@/services/adminHomeImageService": services, "@/services/productService": services, "@/services/reviewService": services, "@": srcRoot } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }, { test: /\.css$/, use: cssLoader }] } });
  await new Promise((resolve, reject) => compiler.run((err, stats) => { compiler.close(() => {}); err || stats.hasErrors() ? reject(err || new Error(stats.toString({ all: false, errors: true }))) : resolve(); }));
  const bundle = fs.readFileSync(path.join(stage, "bundle.js"));
  const layout = fs.readFileSync(path.join(srcRoot, "app/admin/layout.js"), "utf8");
  const sheets = ["styles/base/variables.css", "styles/base/globals.css", ...[...layout.matchAll(/@\/(styles\/[^"]+\.css)/g)].map((m) => m[1])];
  const css = sheets.map((file) => fs.readFileSync(path.join(srcRoot, file), "utf8")).join("\n");
  let images = [
    { id: "img1", url: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='60'><rect width='80' height='60' fill='#e8e4db'/></svg>"), publicId: "dizor/hero-a", altText: "Sombrero de iraca al amanecer", seccion: "hero", orden: 0, activo: true, titulo: "", linkHref: "" },
    { id: "img2", url: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='60'><rect width='80' height='60' fill='#f5c37b'/></svg>"), publicId: "dizor/hero-b", altText: "Detalle de la trama", seccion: "hero", orden: 1, activo: false, titulo: "", linkHref: "" },
  ];
  let pages = [{ id: "pg1", title: "Sobre Dizor", slug: "sobre-dizor", excerpt: "El oficio", isPublished: true, showInFooter: true, body: "# Origen", seoTitle: "Sobre Dizor", seoDescription: "Historia" }];
  let banners = [{ id: "bn1", title: "Colección Brisa", subtitle: "Tejido fino", imageUrl: images[0].url, linkHref: "/catalogo", ctaLabel: "Ver más", placement: "home_mid", sortOrder: 0, isActive: true }];
  const same = "2026-11-24T18:00:00.000Z";
  let reviews = Array.from({ length: 25 }, (_, i) => ({ id: `rv${String(i).padStart(2, "0")}`, authorName: i === 1 ? "María Fernanda de los Ángeles Quiñones de Sandoná" : `Autora ${i}`, city: "Sandoná", rating: (i % 5) + 1, comment: i === 2 ? "Esta reseña ficticia es deliberadamente extensa para comprobar que el listado resume el texto y que la acción Ver comentario conserva el comentario completo sin cortarlo del registro. ".repeat(3) : `Comentario de prueba ${i}`, aprobado: i >= 12, isBrandReview: i === 14, product: i % 2 ? { id: "prod1", name: "Sombrero Brisa" } : null, user: { id: "u", name: "Cliente", email: "cliente.con.correo.muy.largo@example.test" }, createdAt: i === 0 || i === 1 ? same : new Date(Date.UTC(2026, 10, 20, 12, 0, 25 - i)).toISOString() }));
  const scenario = { failHome: 0, slow: 0 };
  const sortReviews = (rows) => rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle); }
    if (url.pathname.startsWith("/mock")) {
      res.setHeader("Content-Type", "application/json");
      const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)); };
      const parts = url.pathname.split("/").slice(2);
      let raw = ""; for await (const c of req) raw += c; const data = raw ? JSON.parse(raw) : {};
      if (req.method !== "GET") result.mutations.push({ method: req.method, path: url.pathname.slice(5), body: data });
      if (scenario.slow && req.method !== "GET") await delay(scenario.slow);
      if (parts[0] === "content" && parts[1] === "home") { if (scenario.failHome && req.method === "GET") { scenario.failHome--; return send({ message: "Fallo CMS de prueba" }, 503); } if (req.method === "PATCH") return send({ status: "success", home: data }); return send({ status: "success", home }); }
      if (parts[0] === "content" && parts[1] === "pages") { if (parts[2] && req.method === "GET") return send({ page: pages.find((p) => p.id === parts[2]) }); if (req.method === "POST") { const page = { ...data, id: "pg-new", slug: "pagina-nueva" }; pages.push(page); return send({ page }); } if (req.method === "PATCH") { pages = pages.map((p) => p.id === parts[2] ? { ...p, ...data } : p); return send({ page: pages.find((p) => p.id === parts[2]) }); } if (req.method === "DELETE") { pages = pages.filter((p) => p.id !== parts[2]); return send({ status: "success" }); } return send({ pages }); }
      if (parts[0] === "content" && parts[1] === "banners") { if (req.method === "POST") { banners.push({ ...data, id: "bn-new" }); return send({ banner: banners.at(-1) }); } if (req.method === "DELETE") { banners = banners.filter((b) => b.id !== parts[2]); return send({ status: "success" }); } return send({ banners }); }
      if (parts[0] === "marketing") return send({ status: "success", settings: marketing });
      if (parts[0] === "settings") { if (req.method === "PATCH") return send({ status: "success", settings: { id: "settings-1", appearance: data.appearance } }); return send({ status: "success", settings: { id: "settings-1", appearance } }); }
      if (parts[0] === "home-images") {
        if (req.method === "POST" && parts[1] !== "reorder") { images.push({ id: "img-new", url: images[0].url, publicId: "dizor/nueva", altText: data.altText || "", seccion: data.seccion, orden: images.filter((i) => i.seccion === data.seccion).length, activo: true, titulo: data.titulo || "", linkHref: "" }); return send({ image: images.at(-1) }); }
        if (parts[1] === "reorder") { for (const item of data.items || []) { const img = images.find((i) => i.id === item.id); if (img) img.orden = item.orden; } return send({ images }); }
        if (req.method === "PATCH") { images = images.map((img) => img.id === parts[1] ? { ...img, ...data } : img); return send({ image: images.find((i) => i.id === parts[1]) }); }
        if (req.method === "DELETE") { images = images.filter((img) => img.id !== parts[1]); return send({ status: "success" }); }
        return send({ images });
      }
      if (parts[0] === "reviews") {
        if (parts[2] === "approve") { const review = reviews.find((r) => r.id === parts[1]); review.aprobado = true; return send({ review }); }
        if (req.method === "DELETE") { reviews = reviews.filter((r) => r.id !== parts[1]); return send({ status: "success", message: "Reseña eliminada" }); }
        if (parts[1] === "brand") { const review = { id: "brand-new", ...data, aprobado: true, isBrandReview: true, createdAt: new Date().toISOString(), product: null, user: null }; reviews.push(review); return send({ review }); }
        const aprobado = url.searchParams.get("aprobado");
        const filtered = sortReviews(reviews.filter((r) => (aprobado === "true" ? r.aprobado : aprobado === "false" ? !r.aprobado : true)));
        const limit = Number(url.searchParams.get("limit")), page = Number(url.searchParams.get("page"));
        if (![10, 20].includes(limit) || !Number.isInteger(page) || page < 1) return send({ message: "El tamaño de página debe ser 10 o 20" }, 400);
        const pagesCount = Math.max(1, Math.ceil(filtered.length / limit));
        const safe = Math.min(page, pagesCount);
        return send({ status: "success", results: Math.min(limit, Math.max(0, filtered.length - (safe - 1) * limit)), total: filtered.length, page: safe, pages: pagesCount, limit, reviews: filtered.slice((safe - 1) * limit, safe * limit) });
      }
      return send({ message: "No encontrado" }, 404);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIZOR · Sprint 05</title><style>${css}</style></head><body><script>sessionStorage.setItem('role','admin')</script><div id="app"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.DIZOR_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", userDataDir: path.join(stage, "profile"), args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => result.pageErrors.push(e.stack || e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) result.consoleErrors.push(m.text()); });
  await page.setRequestInterception(true);
  page.on("request", (r) => { if (r.url().startsWith(origin) || r.url().startsWith("data:")) r.continue(); else { result.externalRequests.push(r.url()); r.abort(); } });
  const text = async (s, timeout = 15000) => { try { await page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, s); } catch (error) { result.failure = { waiting: s, body: await page.evaluate(() => document.body.innerText.slice(0, 1500)) }; await page.screenshot({ path: path.join(out, "fallo.png"), fullPage: true }); throw error; } };
  const goto = async (url, ready) => { await page.goto(origin + url, { waitUntil: "networkidle0" }); if (ready) await text(ready); await delay(150); };
  const shot = async (name) => { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); result.screenshots.push(`${name}.png`); };
  const check = (label) => { result.checks.push(label); process.stdout.write(`ok - ${label}\n`); };
  const click = async (label) => { const handle = await page.waitForFunction((l) => [...document.querySelectorAll("button,a")].find((e) => e.getClientRects().length && (e.textContent.trim() === l || e.getAttribute("aria-label") === l)), { timeout: 10000 }, label); await handle.click(); await handle.dispose(); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shop = fs.readFileSync(path.join(srcRoot, "app/(shop)/layout.js"), "utf8") + fs.readFileSync(path.join(srcRoot, "app/layout.js"), "utf8");
  assert.equal(/admin-store|admin-buttons/.test(shop), false);
  check("T01 la tienda pública no importa estilos del administrador");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/contenido?tab=home", "Marca / claim");
  assert.equal(await page.$$eval('nav[aria-label="Secciones de Tienda online"] a', (n) => n.length), 6);
  assert.equal(await page.$$eval(".cms-tabs--sub button", (n) => n.length), 12);
  const heroGrid = await page.$eval(".st-fields", (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
  assert.ok(heroGrid >= 2, "el hero usa más de una columna");
  await text("No reproduce la tienda pública");
  await shot("inicio-1440");
  await click("Historia"); await text("Del páramo a la fibra"); await shot("inicio-historia-1440");
  const before = result.mutations.length;
  await click("Guardar inicio"); await text("Inicio guardado");
  assert.equal(result.mutations.filter((m) => m.path === "/content/home").length, 1);
  assert.equal(result.mutations[before].body.hero.title, "Oficio colombiano, piezas que perduran");
  check("T02 inicio: doce secciones, rejilla, borrador y guardado sin perder el título");

  scenario.failHome = 1; await goto("/admin/contenido?tab=home", "Error al cargar contenido CMS");
  assert.equal(await page.$("form.admin-form"), null);
  await click("Reintentar contenido CMS"); await text("Marca / claim");
  check("T03 error de CMS bloquea el formulario y se recupera");

  for (const width of [390, 360]) { await page.setViewport({ width, height: 900 }); await goto("/admin/contenido?tab=home", "Marca / claim"); assert.equal(await overflow(), true); await shot(`inicio-${width}`); }
  check("T04 inicio móvil sin desborde de página");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/contenido?tab=imagenes", "Subir imagen");
  await text("Principal (LCP)"); await text("dizor/hero-a");
  assert.equal(await page.$$eval(".st-thumb", (n) => n.length), 2);
  await shot("imagenes-1440");
  await click("Bajar imagen 1"); await delay(200);
  assert.ok(result.mutations.some((m) => m.path === "/home-images/reorder"));
  const orders = await page.$$eval(".st-card .st-meta", (nodes) => nodes.map((n) => n.textContent));
  assert.ok(orders.some((line) => line.includes("Orden 0")) && orders.some((line) => line.includes("Orden 1")));
  check("T05 imágenes: miniatura, LCP, identificador y reorden");
  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/contenido?tab=imagenes", "Subir imagen"); assert.equal(await overflow(), true); await shot("imagenes-390");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/contenido?tab=banners", "Colección Brisa");
  assert.ok(await page.$("form.admin-form"));
  await shot("banners-1440");
  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/contenido?tab=banners", "Colección Brisa");
  assert.equal(await page.$eval(".st-banners .st-composer", (e) => getComputedStyle(e).display), "none");
  await click("Nuevo banner"); await text("Crear");
  assert.notEqual(await page.$eval(".st-banners .st-composer", (e) => getComputedStyle(e).display), "none");
  await shot("banners-nuevo-390");
  check("T06 banners: lista primero en móvil y formulario al pedirlo");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/contenido?tab=pages", "Sobre Dizor");
  assert.equal(await page.$("textarea#cms-page-body"), null);
  await shot("paginas-1440");
  await click("Nueva página"); await text("La URL se genera sola");
  assert.ok(await page.$("textarea#cms-page-body"));
  await page.type("input[name=pTitle]", "Envíos");
  await click("Crear"); await text("Página guardada");
  check("T07 páginas: el listado antecede al editor y el cuerpo sigue siendo texto");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/contenido?tab=resenas", "Escribir reseña de marca");
  assert.equal(await page.$("#brand-review-form"), null);
  await text("Página 1 de 2"); await text("12 reseñas");
  const pendingIds = await page.$$eval(".st-reviews tbody tr td:first-child", (nodes) => nodes.map((n) => n.innerText));
  assert.equal(pendingIds.length, 10);
  const newer = pendingIds.findIndex((line) => line.includes("Quiñones"));
  const older = pendingIds.findIndex((line) => line.includes("Autora 0"));
  assert.ok(newer >= 0 && older > newer, "misma fecha: id mayor primero");
  await page.evaluate(() => document.querySelector(".st-reviews details summary").click()); await text("comentario completo");
  await shot("resenas-1440");
  await click("Siguiente"); await text("Página 2 de 2");
  assert.ok(page.url().includes("reviewPage=2"));
  check("T08 reseñas paginadas en servidor, desempate y texto completo");
  await click("Escribir reseña de marca"); await text("Publicar reseña"); await shot("resenas-marca-1440");
  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/contenido?tab=resenas&reviewPage=1", "Pendientes"); assert.equal(await overflow(), true); await shot("resenas-390");

  await page.setViewport({ width: 1440, height: 900 });
  await goto("/admin/contenido?tab=appearance", "Guardar apariencia");
  await text("Nombre del sitio");
  assert.ok(await page.$("input[name=siteName]"));
  assert.ok(await page.$("button.auth-submit"));
  await shot("apariencia-1440");
  check("T09 apariencia compacta; el guardado sigue en la máquina de carga confirmada");
  await page.setViewport({ width: 390, height: 900 }); await goto("/admin/contenido?tab=appearance", "Guardar apariencia"); assert.equal(await overflow(), true); await shot("apariencia-390");

  for (const width of [1024, 820]) { await page.setViewport({ width, height: 900 }); await goto("/admin/contenido?tab=imagenes", "Subir imagen"); assert.equal(await overflow(), true, String(width)); }
  check("T10 1024 y 820 sin desborde de página");
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.externalRequests, []);
  result.passed = true;
 } catch (error) {
  result.passed = false; result.error = error.stack || error.message; console.error(result.error); if (result.failure) console.error(JSON.stringify(result.failure));
 } finally {
  if (browser) await browser.close(); if (server) await new Promise((r) => server.close(r));
  fs.writeFileSync(path.join(out, "navegador.json"), JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
 }
})();
