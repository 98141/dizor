/**
 * Catálogo de PRUEBA con fotos reales de Dizor (para revisar diseño).
 *
 *   node src/scripts/demoCatalog.js            → simulación (no escribe)
 *   node src/scripts/demoCatalog.js --apply    → sube fotos a Cloudinary y crea productos
 *   node src/scripts/demoCatalog.js --remove   → borra productos de prueba, sus fotos y
 *                                                 las taxonomías nuevas que queden sin uso
 *
 * Opcional: --photos "<carpeta>" (por defecto ../dizor_fotos junto al repo).
 * Manifiesto (qué se creó): logs/demo-catalog-manifest.json
 *
 * Precios y stock son de muestra. Descripciones basadas en lo que muestran las
 * fotos y en información pública sobre la iraca de Nariño; tejido "apareado",
 * "torcido" y horma "Gomelo" se describen solo por su aspecto visible.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Product = require("../models/product");
const Category = require("../models/category");
const WeaveType = require("../models/weaveType");
const Style = require("../models/style");
const Size = require("../models/size");
const Color = require("../models/color");
const DailyProductPick = require("../models/dailyProductPick");
const { uploadProductImages, deleteImage } = require("../services/cloudinaryService");
const slugifyText = require("../utils/slugifyText");

const ROOT = path.resolve(__dirname, "../../..");
const argPhotos = process.argv.indexOf("--photos");
const PHOTOS = argPhotos > 0 ? process.argv[argPhotos + 1] : path.join(ROOT, "../dizor_fotos");
const MANIFEST = path.join(__dirname, "../../logs/demo-catalog-manifest.json");
const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");

/* ─── Taxonomías que se crean si no existen ─── */
const NEW_TAXONOMY = {
  Category: [{ name: "Abanicos", description: "Abanicos tejidos a mano en palma de iraca.", sortOrder: 3 }],
  WeaveType: [
    { name: "Apareado", description: "Tejido de trama pareja y uniforme.", sortOrder: 5 },
    { name: "Superfino torcido", description: "Fibra fina torcida que da un acabado jaspeado.", sortOrder: 6 },
  ],
  Style: [{ name: "Gomelo", description: "Copa con pliegue central y ala corta, de líneas urbanas.", sortOrder: 13 }],
  Color: [
    { name: "Miel", hexCode: "#C98B3C", sortOrder: 6 },
    { name: "Tostado", hexCode: "#B8875A", sortOrder: 7 },
    { name: "Combinado", hexCode: "#9C7A55", sortOrder: 8 },
    { name: "Jaspeado", hexCode: "#A8A37C", sortOrder: 9 },
    { name: "Rosa", hexCode: "#E48FA5", sortOrder: 10 },
    { name: "Fucsia", hexCode: "#C2185B", sortOrder: 11 },
    { name: "Naranja", hexCode: "#E2731E", sortOrder: 12 },
    { name: "Amarillo", hexCode: "#E5B91E", sortOrder: 13 },
    { name: "Verde oliva", hexCode: "#6E6B2F", sortOrder: 14 },
    { name: "Surtido", hexCode: "#D4527A", sortOrder: 15 },
  ],
};
const MODELS = { Category, WeaveType, Style, Color };

/* ─── Textos comunes ─── */
const ORIGEN_SOMBRERO = `# Material y origen
Tejido a mano en palma de iraca por artesanas de Sandoná, Nariño. La fibra se recolecta, se limpia y se lava antes de tejerse, y el sombrero toma su forma sobre una horma de madera. Por ser un trabajo manual, cada pieza puede tener leves variaciones de tono y textura: es parte de su carácter.`;

const TALLAS = `# Tallas
- S: 54–55 cm de contorno de cabeza
- M: 56–57 cm
- L: 58–59 cm

Mide alrededor de la cabeza, a la altura de la frente y un dedo por encima de las orejas. Si quedas entre dos tallas, elige la mayor.`;

const CUIDADOS_SOMBRERO = `# Cuidados
- Evita mojarlo: la iraca es una fibra natural y la humedad puede deformarla o mancharla.
- Guárdalo en su caja o en una bolsa de tela, en un lugar seco y ventilado, para protegerlo de la humedad y los hongos.
- Nunca lo dobles ni lo aplastes; apóyalo sobre la copa para cuidar la forma del ala.
- Tómalo por el ala, sin pellizcar la copa.
- Para limpiarlo, usa un cepillo suave o un paño seco.`;

const ORIGEN_ACCESORIO = `# Material y origen
Tejido a mano en palma de iraca por artesanas de Nariño. La fibra se limpia, se lava y, en las piezas de color, se tiñe antes de tejerse. Al ser hecho a mano, cada pieza tiene pequeñas variaciones de tono y trama que la hacen única.`;

const CUIDADOS_FIBRA = `# Cuidados
- Evita mojarlo y no lo laves en lavadora.
- Límpialo con un paño seco o apenas húmedo y déjalo secar a la sombra.
- Guárdalo en un lugar seco y ventilado, sin aplastarlo, para conservar su forma.
- Evita dejarlo al sol directo por largos periodos: los tintes naturales pueden aclararse.`;

const sombrero = (intro, detalles) =>
  [intro, ORIGEN_SOMBRERO, `# Detalles\n${detalles.map((d) => `- ${d}`).join("\n")}`, TALLAS, CUIDADOS_SOMBRERO].join("\n\n");
const accesorio = (intro, detalles, extra = "") =>
  [intro, ORIGEN_ACCESORIO, `# Detalles\n${detalles.map((d) => `- ${d}`).join("\n")}`, extra, CUIDADOS_FIBRA].filter(Boolean).join("\n\n");

const days = (n) => new Date(Date.now() + n * 86400000);
const HAT_SIZES = ["S", "M", "L"];

/* ─── Productos ─── */
const PRODUCTS = [
  {
    name: "Sombrero Indiana Apareado",
    category: "Sombreros", weave: "Apareado", style: "Indiana",
    price: 185000, flags: { isNew: true },
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/apareado", pad: "all", files: ["IMG_6132.JPG", "IMG_6136.JPG", "IMG_6138.JPG", "IMG_6142.JPG", "IMG_6146.JPG"] },
    short: "Sombrero de ala ancha y copa en lágrima, tejido a mano en palma de iraca con trama apareada y cinta decorativa en tonos tierra. Fresco y liviano para los días de sol.",
    full: sombrero(
      "El Indiana es la horma de los días de sol: ala amplia que da sombra al rostro y al cuello, y copa alta en forma de lágrima. Esta versión en tejido apareado, color natural, lleva una cinta de tres franjas —zigzag claro, naranja y café— que le da un aire artesanal y aventurero.",
      ["Horma Indiana: ala ancha de caída suave y copa en lágrima.", "Tejido apareado de trama pareja, en color natural.", "Cinta decorativa en tonos tierra.", "Ideal para campo, playa, viajes y actividades al aire libre."]
    ),
  },
  {
    name: "Sombrero Indiana Brisa Miel",
    category: "Sombreros", weave: "Brisa", style: "Indiana",
    price: 165000, flags: { isFeatured: true },
    colors: ["Miel"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/brisa", pad: ["IMG_6095.JPG", "IMG_6099.JPG", "indiana3.jpg", "indiana5.jpg"], files: ["IMG_6095.JPG", "IMG_6099.JPG", "IMG_6347.JPG", "indiana3.jpg", "indiana5.jpg"] },
    short: "Sombrero Indiana en tejido brisa color miel, con cinta café. Ala ancha para protegerte del sol y un entramado en rombos, ligero y fresco, que deja respirar.",
    full: sombrero(
      "Un clásico de ala ancha en un tono miel cálido que combina con lino, denim y colores tierra. El tejido brisa —un entramado en rombos, ligero y fresco— lo hace cómodo para llevarlo durante horas bajo el sol.",
      ["Horma Indiana: ala ancha y copa alta con pliegue en lágrima.", "Tejido brisa, ligero y ventilado.", "Color miel con cinta café.", "Un sombrero de uso diario para clima cálido."]
    ),
  },
  {
    name: "Sombrero Gomelo Brisa Calado",
    category: "Sombreros", weave: "Brisa", style: "Gomelo",
    price: 150000, flags: { isNew: true, isFeatured: true },
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "gomelo/brisa", pad: ["IMG_6085.JPG", "IMG_6088.JPG", "gomelo1.jpg", "gomelo8.jpg"], files: ["IMG_6362.JPG", "IMG_6085.JPG", "gomelo1.jpg", "IMG_6088.JPG", "IMG_6367.JPG", "gomelo8.jpg"] },
    short: "Sombrero de copa con pliegue central y franja calada que ventila, ala corta y cinta negra. Tejido brisa en tono natural: fresco, elegante y fácil de combinar.",
    full: sombrero(
      "Una horma de líneas urbanas: copa con pliegue central y pellizcos al frente, ala corta y cinta negra que enmarca el tejido. La franja calada alrededor de la copa deja circular el aire, por eso es un gran aliado para la ciudad en clima cálido y para la playa.",
      ["Horma Gomelo: copa con pliegue central y ala corta.", "Tejido brisa con franja calada de ventilación.", "Tono natural con cinta negra.", "Combina con guayabera, camisa de lino o ropa casual."]
    ),
  },
  {
    name: "Sombrero Borsalino Brisa Combinado",
    category: "Sombreros", weave: "Brisa", style: "Borsalino",
    price: 175000, flags: { onPromotion: true, discountPercent: 15, promotionEndsAt: days(21) },
    colors: ["Combinado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/brisa-combinado", pad: ["IMG_6182.JPG", "IMG_6174.JPG", "IMG_6194.JPG", "IMG_6210.JPG"], files: ["IMG_6182.JPG", "IMG_6174.JPG", "IMG_6194.JPG", "IMG_6210.JPG", "IMG_6389.JPG", "IMG_6394.JPG"] },
    short: "Borsalino de copa calada y ala tejida en dos tonos, natural y café, con cinta de franjas. Una pieza fresca y llamativa, tejida a mano en palma de iraca.",
    full: sombrero(
      "Contraste artesanal: copa en tono natural con franja calada para ventilar, y un ala tejida en diseño combinado natural y café que deja ver la trama a contraluz. La cinta de franjas café y beige completa el conjunto.",
      ["Horma Borsalino: copa con pliegue central y ala media.", "Tejido brisa; ala en diseño combinado de dos tonos.", "Franja calada de ventilación en la copa.", "Cinta de franjas café y beige."]
    ),
  },
  {
    name: "Sombrero Borsalino Clásico Natural",
    category: "Sombreros", weave: "Fino", style: "Borsalino",
    price: 140000, flags: {},
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/comun", files: ["IMG_6339.JPG", "IMG_6335.JPG", "IMG_6337.JPG", "IMG_6341.JPG"] },
    short: "Borsalino de ala media y copa con pliegue central, en tejido de iraca color natural con cinta delgada azul oscuro. Un básico versátil para todos los días.",
    full: sombrero(
      "La silueta Borsalino en su versión más sencilla: tono natural, ala media y una cinta delgada azul oscuro que le da un acabado limpio. Un sombrero fácil de llevar, tanto con ropa casual como con prendas más formales.",
      ["Horma Borsalino: copa con pliegue central y ala media.", "Tejido de iraca en color natural.", "Cinta delgada azul oscuro.", "Liviano y versátil para el uso diario."]
    ),
  },
  {
    name: "Sombrero Borsalino Alón Natural",
    category: "Sombreros", weave: "Fino", style: "Borsalino Alon",
    price: 160000, flags: { onPromotion: true, discountPercent: 10 },
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/comun/alon", files: ["IMG_6317.JPG", "IMG_6314.JPG", "IMG_6320.JPG", "IMG_6315.JPG"] },
    short: "La silueta Borsalino con ala ancha (alón) para más sombra. Tejido de iraca en tono natural con cinta negra: elegante, fresco y pensado para el sol de mediodía.",
    full: sombrero(
      "El alón conserva la copa clásica del Borsalino y amplía el ala para dar más sombra al rostro y al cuello. En tono natural y con cinta negra, es una opción elegante para eventos al aire libre, viajes y días de mucho sol.",
      ["Horma Borsalino Alón: copa con pliegue central y ala ancha.", "Tejido de iraca en color natural.", "Cinta negra.", "Más protección del sol sin perder elegancia."]
    ),
  },
  {
    name: "Sombrero Borsalino Superfino Tostado y Natural",
    category: "Sombreros", weave: "Súper fino", style: "Borsalino",
    price: 320000, flags: { isFeatured: true },
    colors: ["Tostado", "Natural"], sizes: HAT_SIZES,
    photos: [
      { dir: "borsalino/superfino", files: ["IMG_6305.JPG", "IMG_6301.JPG", "IMG_6309.JPG", "IMG_6328.JPG"] },
      { dir: "borsalino/superfino/natural", files: ["IMG_6324.JPG", "IMG_6322.JPG"] },
    ],
    short: "Borsalino en tejido superfino: fibras más delgadas, trama casi imperceptible y un sombrero más liviano y flexible. En tono tostado con cinta vino o en natural con cinta negra.",
    full: sombrero(
      "En el tejido superfino la iraca se trabaja en fibras más delgadas, lo que da una trama cerrada, casi imperceptible, y un sombrero más liviano y flexible. Es un trabajo que exige más horas y más destreza de la tejedora; por eso es una de nuestras piezas más especiales.",
      ["Horma Borsalino: copa con pliegue central y ala media.", "Tejido superfino de trama cerrada.", "Tostado con cinta vino, o natural con cinta negra.", "Liviano y flexible; una pieza para ocasiones especiales."]
    ),
  },
  {
    name: "Sombrero Borsalino Superfino Torcido",
    category: "Sombreros", weave: "Superfino torcido", style: "Borsalino",
    price: 360000, flags: { isNew: true },
    colors: ["Jaspeado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/superfino-torcido", pad: "all", files: ["IMG_6152.JPG", "IMG_6157.JPG", "IMG_6219.JPG", "IMG_6224.JPG", "IMG_6229.JPG"] },
    short: "Borsalino superfino con fibra torcida que crea un acabado jaspeado en tonos verde oliva y beige. Textura única, cinta café y ala amplia.",
    full: sombrero(
      "La fibra torcida le da a este sombrero una textura jaspeada, con matices verdosos y beige que cambian con la luz. Es un superfino distinto, con más carácter visual, que se luce con prendas lisas en tonos neutros.",
      ["Horma Borsalino: copa con pliegue central y ala amplia.", "Tejido superfino torcido, de acabado jaspeado.", "Cinta café.", "Una pieza de colección, distinta a cualquier sombrero liso."]
    ),
  },
  {
    name: "Bolso Caracol de Iraca",
    category: "Bolsos",
    price: 135000, flags: { isFeatured: true },
    colors: ["Natural", "Miel"], sizes: ["Única"],
    photos: { dir: "bolso caracol", files: ["WhatsApp Image 2026-11-17 at 11.59.25 AM.jpeg", "WhatsApp Image 2026-11-17 at 11.59.26 AM.jpeg"] },
    short: "Bolso tote tejido a mano en iraca, con trama en relieve, asas tejidas y cierre de botón. Amplio para el día a día, la playa o el mercado.",
    full: accesorio(
      "Un tote de boca amplia con una trama en relieve que le da textura y cuerpo. Tiene asas tejidas en la misma fibra y un cierre de lengüeta con botón para llevar tus cosas seguras.",
      ["Tejido en relieve, hecho a mano.", "Asas tejidas en iraca.", "Cierre de lengüeta con botón tejido.", "Disponible en natural bicolor y en tono miel."]
    ),
  },
  {
    name: "Bolso Degradé de Iraca",
    category: "Bolsos",
    price: 125000, flags: { isNew: true },
    colors: ["Fucsia", "Miel"], sizes: ["Única"],
    photos: { dir: "bolso degrade", files: ["WhatsApp Image 2026-11-17 at 11.59.25 AM.jpeg", "WhatsApp Image 2026-11-17 at 11.59.26 AM.jpeg"] },
    short: "Bolso tote de iraca con teñido en degradé: el color nace en la base y se desvanece hacia el borde natural. Asas tejidas y cierre de botón.",
    full: accesorio(
      "El color se funde con la fibra: en la versión fucsia, el tono intenso de la base se aclara poco a poco hasta llegar al natural de la iraca. Es una pieza alegre que también existe en un tono miel liso, más sobrio.",
      ["Teñido en degradé (versión fucsia) o miel liso.", "Asas tejidas en iraca.", "Cierre de lengüeta con botón tejido.", "Tamaño amplio para el uso diario."]
    ),
  },
  {
    name: "Bolso Ébano",
    category: "Bolsos",
    price: 98000, flags: { onPromotion: true, discountPercent: 20, promotionEndsAt: days(14) },
    colors: ["Rosa", "Verde oliva", "Naranja", "Amarillo", "Café", "Fucsia"], sizes: ["Única"],
    photos: { dir: "bolso ebano", files: ["2.jpeg", "3.jpeg", "4.jpeg", "5.jpeg", "7.jpeg", "8.jpeg", "WhatsApp Image 2026-10-08 at 12.22.42 PM.jpeg"] },
    short: "Bolso pequeño de tejido bicolor en diagonal, asa redonda y pompón decorativo de fibra. Alegre y liviano, disponible en varios colores.",
    full: accesorio(
      "Un bolso de mano compacto con tejido bicolor en diagonal y un pompón de fibra que le da un toque festivo. Su asa redonda y su tamaño lo hacen ideal para salidas, paseos y como complemento de color.",
      ["Tejido bicolor en diagonal, hecho a mano.", "Asa redonda tejida.", "Pompón decorativo de fibra con botón.", "Disponible en rosa, verde oliva, naranja, amarillo, café y fucsia."]
    ),
  },
  {
    name: "Abanico de Iraca Liso",
    category: "Abanicos",
    price: 28000, flags: { isNew: true },
    colors: ["Surtido"], sizes: ["Única"],
    photos: { dir: "abanicoLiso", files: ["2.jpeg", "WhatsApp Image 2026-11-17 at 11.59.25 AM.jpeg"] },
    short: "Abanico artesanal de iraca con mango recto y diseños tejidos en espiral. Liviano y resistente; se entrega en color surtido.",
    full: accesorio(
      "Un abanico de media luna tejido a mano, con diseños en espiral y círculos concéntricos en colores vivos. Su mango recto lo hace cómodo de usar y fácil de llevar en el bolso.",
      ["Forma de media luna con mango recto.", "Diseños tejidos en espiral y círculos.", "Liviano y resistente.", "Color surtido: cada pieza es distinta."],
      "# Sobre el color\nEl abanico se entrega en color surtido, según disponibilidad. Si prefieres un tono en particular, escríbenos y lo intentamos."
    ),
  },
  {
    name: "Abanico de Iraca con Aro de Madera",
    category: "Abanicos",
    price: 35000, flags: { isFeatured: true },
    colors: ["Surtido"], sizes: ["Única"],
    photos: { dir: "abanicosMadera", files: ["WhatsApp Image 2026-11-17 at 11.59.25 AM.jpeg", "2.jpeg"] },
    short: "Abanico tejido en iraca con agarre de aro de madera y diseños de cuadros en colores vivos. Práctico, liviano y decorativo; color surtido.",
    full: accesorio(
      "Un abanico de media luna con agarre de aro de madera, cómodo para sostenerlo y para colgarlo como pieza decorativa. Sus diseños de cuadros combinan colores vivos sobre la fibra natural.",
      ["Forma de media luna con agarre de aro de madera.", "Diseños tejidos de cuadros en colores vivos.", "Sirve para refrescarte o como decoración.", "Color surtido: cada pieza es distinta."],
      "# Sobre el color\nEl abanico se entrega en color surtido, según disponibilidad. Si prefieres un tono en particular, escríbenos y lo intentamos."
    ),
  },
];

/* ─── Utilidades ─── */
const loadSharp = () =>
  require(require.resolve("sharp", { paths: [path.join(ROOT, "frontend")] }));

const readManifest = () =>
  fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { products: [], taxonomies: [] };
const writeManifest = (m) => {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
};

const photoList = (p) =>
  (Array.isArray(p.photos) ? p.photos : [p.photos]).flatMap((g) =>
    g.files.map((f) => ({ file: path.join(PHOTOS, g.dir, f), pad: g.pad === "all" || (g.pad || []).includes(f) }))
  );

/**
 * Redimensiona (máx. 1800px). Fotos de estudio horizontales (pad): se extienden
 * arriba/abajo repitiendo el borde del fondo hasta 4:5, para que la tarjeta y la
 * ficha (4:5, cover) muestren el sombrero completo sin cortar el ala.
 */
async function preparePhoto(sharp, { file, pad }) {
  const base = await sharp(file).rotate()
    .resize(1800, 1800, { fit: "inside", withoutEnlargement: true }).toBuffer();
  const meta = await sharp(base).metadata();
  const target = Math.round(meta.width * 1.25);
  if (!pad || meta.height >= target) return sharp(base).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  // Quita un 3% de los bordes superior/inferior (viñeteo, objetos) antes de repetirlos.
  const trim = Math.round(meta.height * 0.03);
  const cut = await sharp(base)
    .extract({ left: 0, top: trim, width: meta.width, height: meta.height - 2 * trim }).toBuffer();
  const extra = target - (meta.height - 2 * trim);
  return sharp(cut)
    .extend({ top: Math.floor(extra / 2), bottom: Math.ceil(extra / 2), extendWith: "copy" })
    .jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}
const skuPrefix = (cat) => ({ Sombreros: "SOM", Bolsos: "BOL", Abanicos: "ABA" }[cat] || "DZR");
const seed = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const todayBogota = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

async function byName(Model, name) {
  const doc = await Model.findOne({ $or: [{ name }, { slug: slugifyText(name) }] });
  if (!doc) throw new Error(`${Model.modelName} "${name}" no existe`);
  return doc;
}

async function apply() {
  const manifest = readManifest();
  const sharp = loadSharp();

  // Taxonomías nuevas
  for (const [modelName, items] of Object.entries(NEW_TAXONOMY)) {
    for (const item of items) {
      const Model = MODELS[modelName];
      const exists = await Model.findOne({ slug: slugifyText(item.name) });
      if (exists) continue;
      const doc = await Model.create(item);
      manifest.taxonomies.push({ model: modelName, id: String(doc._id), name: doc.name });
      console.log(`  + ${modelName} "${doc.name}"`);
    }
  }
  writeManifest(manifest);

  for (const def of PRODUCTS) {
    const slug = slugifyText(def.name);
    if (await Product.exists({ slug })) {
      console.log(`  = "${def.name}" ya existe, se omite`);
      continue;
    }
    const files = photoList(def);
    const buffers = await Promise.all(files.map((f) => preparePhoto(sharp, f)));
    const uploaded = await uploadProductImages(buffers.map((buffer) => ({ buffer })));
    const images = uploaded.map((u, i) => ({
      url: u.url,
      publicId: u.publicId,
      alt: i === 0 ? def.name : `${def.name} — vista ${i + 1}`,
    }));

    const [category, weaveType, style] = await Promise.all([
      byName(Category, def.category),
      def.weave ? byName(WeaveType, def.weave) : null,
      def.style ? byName(Style, def.style) : null,
    ]);
    const sizes = await Promise.all(def.sizes.map((n) => byName(Size, n)));
    const colors = await Promise.all(def.colors.map((n) => byName(Color, n)));
    const s = seed();
    let n = 0;
    const variants = colors.flatMap((c) =>
      sizes.map((z) => ({
        size: z._id, color: c._id,
        sku: `${skuPrefix(def.category)}-${s}-${String(++n).padStart(2, "0")}`,
        stock: rand(3, def.category === "Abanicos" ? 40 : 15),
        isActive: true,
      }))
    );

    const product = await Product.create({
      name: def.name,
      shortDescription: def.short,
      fullDescription: def.full,
      category: category._id,
      weaveType: weaveType?._id || null,
      style: style?._id || null,
      material: "Palma de iraca",
      variants,
      salePrice: def.price,
      discountPercent: def.flags.discountPercent || 0,
      onPromotion: Boolean(def.flags.onPromotion),
      promotionEndsAt: def.flags.promotionEndsAt || null,
      isNew: Boolean(def.flags.isNew),
      isFeatured: Boolean(def.flags.isFeatured),
      images,
      mainImage: images[0].url,
      seoTitle: `${def.name} | Dizor`.slice(0, 70),
      seoDescription: def.short.slice(0, 157).replace(/\s+\S*$/, "") + "…",
    });
    manifest.products.push({
      id: String(product._id), name: product.name,
      publicIds: images.map((i) => i.publicId).filter(Boolean),
    });
    writeManifest(manifest);
    console.log(`  + "${product.name}" (${images.length} fotos, ${variants.length} variantes)`);
  }

  // Regenerar la curaduría de hoy del home para que incluya los nuevos.
  await DailyProductPick.deleteMany({ dateKey: todayBogota() });
  console.log(`\nManifiesto: ${MANIFEST}`);
}

async function remove() {
  const manifest = readManifest();
  for (const p of manifest.products) {
    await Product.deleteOne({ _id: p.id });
    for (const id of p.publicIds) await deleteImage(id).catch(() => {});
    console.log(`  - "${p.name}"`);
  }
  const usage = { Category: "category", WeaveType: "weaveType", Style: "style", Color: "variants.color" };
  const kept = [];
  for (const t of manifest.taxonomies) {
    const inUse = await Product.countDocuments({ [usage[t.model]]: t.id });
    if (inUse) { kept.push(t); console.log(`  = ${t.model} "${t.name}" en uso por ${inUse} producto(s), se conserva`); continue; }
    await MODELS[t.model].deleteOne({ _id: t.id });
    console.log(`  - ${t.model} "${t.name}"`);
  }
  await DailyProductPick.deleteMany({ dateKey: todayBogota() });
  writeManifest({ products: [], taxonomies: kept });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`DB: ${mongoose.connection.name} · fotos: ${PHOTOS}`);
  if (REMOVE) return remove();
  if (APPLY) return apply();

  // Simulación: valida fotos y taxonomías
  let missing = 0;
  for (const def of PRODUCTS) {
    const files = photoList(def);
    const absent = files.map((f) => f.file).filter((f) => !fs.existsSync(f));
    missing += absent.length;
    console.log(`  • ${def.name} — ${def.category}${def.weave ? ` · ${def.weave}` : ""}${def.style ? ` · ${def.style}` : ""} · $${def.price} · ${files.length} fotos (${files.filter((f) => f.pad).length} con relleno 4:5) · ${def.colors.join("/")} × ${def.sizes.join("/")}${absent.length ? `  FALTAN: ${absent.map((a) => path.basename(a)).join(", ")}` : ""}`);
    if (def.short.length > 300) console.log(`    ! descripción corta ${def.short.length} > 300`);
  }
  const pending = [];
  for (const [m, items] of Object.entries(NEW_TAXONOMY))
    for (const i of items) if (!(await MODELS[m].exists({ slug: slugifyText(i.name) }))) pending.push(`${m}:${i.name}`);
  console.log(`\nTaxonomías a crear: ${pending.join(", ") || "ninguna"}`);
  console.log(missing ? `\n${missing} foto(s) faltante(s).` : "\nTodo listo. Ejecuta con --apply.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
