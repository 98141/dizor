/**
 * Catálogo de PRUEBA con fotos reales de Dizor (para revisar diseño).
 *
 *   node src/scripts/demoCatalog.js            → simulación (no escribe)
 *   node src/scripts/demoCatalog.js --apply    → sube fotos a Cloudinary y crea productos
 *   node src/scripts/demoCatalog.js --remove   → borra productos de prueba, sus fotos, sus
 *                                                 reseñas y las taxonomías nuevas sin uso
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
const Review = require("../models/review");
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

  /* ─── Lote 2: referencias INVENTADAS para probar el diseño ───
   * Reutilizan fotos de las mismas carpetas (otros ángulos); horma/tejido
   * asignados a propósito para poblar filtros sin productos. Incluyen casos
   * límite: agotado, últimas unidades, nombre largo, 1 sola foto, todos los
   * sellos a la vez, promoción que vence pronto y precios extremos.
   * `stock`: número fijo, "low" (1–2 por variante) o { Color: n }.          */
  {
    name: "Sombrero Safari Brisa Combinado",
    category: "Sombreros", weave: "Brisa", style: "Safari",
    price: 168000, flags: { isNew: true },
    colors: ["Combinado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/brisa-combinado", pad: "all", files: ["IMG_6208.JPG", "IMG_6214.JPG", "IMG_6195.JPG"] },
    short: "Sombrero de ala amplia y copa alta con pliegue en lágrima, en tejido brisa con ala combinada natural y café. Cinta de franjas y franja calada para ventilar.",
    full: sombrero(
      "Pensado para el campo y los viajes: la copa alta con pliegue en lágrima deja espacio para que circule el aire, y el ala amplia protege del sol. El ala combinada en dos tonos le da un aspecto artesanal muy marcado.",
      ["Horma Safari: copa alta y ala amplia.", "Tejido brisa; ala combinada natural y café.", "Franja calada de ventilación en la copa.", "Cinta de franjas café y beige."]
    ),
  },
  {
    name: "Sombrero Gardeliano Brisa Combinado",
    category: "Sombreros", weave: "Brisa", style: "Gardeliano",
    price: 172000, flags: { isFeatured: true }, stock: 0,
    colors: ["Combinado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/brisa-combinado", files: ["IMG_6391.JPG", "IMG_6388.JPG", "IMG_6395.JPG", "IMG_6396.JPG"] },
    short: "Sombrero de copa pellizcada y ala de caída suave, tejido brisa combinado natural y café. Una silueta clásica con un ala llamativa a contraluz.",
    full: sombrero(
      "La silueta gardeliana es la del sombrero de copa pellizcada al frente y ala que cae suavemente hacia adelante. En esta versión el ala combinada deja ver la trama a contraluz y la cinta de franjas completa el conjunto.",
      ["Horma Gardeliano: copa pellizcada y ala de caída suave.", "Tejido brisa; ala combinada en dos tonos.", "Franja calada en la copa.", "Cinta de franjas café y beige."]
    ),
  },
  {
    name: "Sombrero Gomelo Brisa Clásico",
    category: "Sombreros", weave: "Brisa", style: "Gomelo",
    price: 145000, flags: {}, stock: "low",
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "gomelo/brisa", pad: "all", files: ["gomelo4.jpg", "gomelo3.jpg", "gomelo6.jpg", "gomelo10.jpg"] },
    short: "Gomelo en tejido brisa color natural, con copa calada y cinta negra ancha. Fresco, liviano y fácil de combinar con ropa clara.",
    full: sombrero(
      "Un sombrero de ciudad para clima cálido: copa con pliegue central y calado de ventilación, ala corta y una cinta negra ancha que hace contraste con el tono natural del tejido.",
      ["Horma Gomelo: copa con pliegue central y ala corta.", "Tejido brisa con calado de ventilación.", "Color natural con cinta negra ancha.", "Liviano para el uso diario."]
    ),
  },
  {
    name: "Sombrero Cubano Brisa Natural",
    category: "Sombreros", weave: "Brisa", style: "Cubano",
    price: 138000, flags: { onPromotion: true, discountPercent: 25, promotionEndsAt: days(2) },
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "gomelo/brisa", files: ["IMG_6370.JPG", "IMG_6358.JPG", "IMG_6373.JPG", "IMG_6375.JPG"] },
    short: "Sombrero de ala corta y copa baja con calado, en tejido brisa natural y cinta negra. Un estilo caribeño, fresco y desenfadado.",
    full: sombrero(
      "El estilo cubano apuesta por un ala corta y una copa compacta: un sombrero que no estorba, ideal para la ciudad, la playa y las noches de música. El calado de la copa lo mantiene fresco.",
      ["Horma Cubano: ala corta y copa compacta.", "Tejido brisa con calado.", "Natural con cinta negra.", "Combina con guayabera, lino y camisas estampadas."]
    ),
  },
  {
    name: "Sombrero Tres Canales Brisa",
    category: "Sombreros", weave: "Brisa", style: "Tres Canales",
    price: 155000, flags: { isNew: true },
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "gomelo/brisa", pad: "all", files: ["IMG_6084.JPG", "IMG_6082.JPG", "IMG_6087.JPG", "IMG_6089.JPG"] },
    short: "Sombrero de copa marcada con hendiduras y ala media, en tejido brisa natural con calado y cinta negra. Una silueta con mucha presencia.",
    full: sombrero(
      "Las hendiduras de la copa le dan a este sombrero un perfil definido que se nota desde cualquier ángulo. El tejido brisa con calado lo mantiene fresco y la cinta negra le da el contraste.",
      ["Horma Tres Canales: copa con hendiduras marcadas.", "Tejido brisa con calado de ventilación.", "Natural con cinta negra.", "Ala media, cómoda para el día a día."]
    ),
  },
  {
    name: "Sombrero Rebelde Brisa Miel",
    category: "Sombreros", weave: "Brisa", style: "Rebelde",
    price: 172000, flags: { isFeatured: true },
    colors: ["Miel"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/brisa", files: ["IMG_6345.JPG", "IMG_6343.JPG", "IMG_6350.JPG", "IMG_6355.JPG"] },
    short: "Sombrero de ala ancha y copa alta en tejido brisa color miel, con cinta café. Un ala con caída libre para un look relajado y protector.",
    full: sombrero(
      "Ala ancha que se deja moldear y copa alta con pliegue: un sombrero con actitud, cómodo para el campo y los viajes. El color miel combina con tonos tierra, blanco y denim.",
      ["Horma Rebelde: ala ancha de caída libre y copa alta.", "Tejido brisa, ligero y fresco.", "Color miel con cinta café.", "Protege rostro y cuello del sol."]
    ),
  },
  {
    name: "Sombrero Indiana Brisa Miel Edición Especial de Ala Extra Ancha para Sol Intenso",
    category: "Sombreros", weave: "Brisa", style: "Indiana",
    price: 199000, flags: {},
    colors: ["Miel", "Habano"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/brisa", pad: "all", files: ["IMG_6096.JPG", "IMG_6090.JPG", "IMG_6092.JPG", "IMG_6100.JPG", "IMG_6102.JPG"] },
    short: "Indiana de ala extra ancha en tejido brisa, en tono miel o habano, con cinta café. Máxima sombra para jornadas largas bajo el sol.",
    full: sombrero(
      "La horma Indiana llevada al máximo: un ala más amplia que la versión clásica para dar sombra al rostro, el cuello y los hombros. Pensado para el campo, la finca y los viajes de playa.",
      ["Horma Indiana con ala extra ancha.", "Tejido brisa, ligero y fresco.", "Disponible en miel y habano, con cinta café.", "Ideal para jornadas largas al aire libre."]
    ),
  },
  {
    name: "Sombrero Pava Reina Brisa Tostado",
    category: "Sombreros", weave: "Brisa", style: "Pava Reina",
    price: 210000, flags: { isNew: true, isFeatured: true, onPromotion: true, discountPercent: 10, promotionEndsAt: days(30) },
    colors: ["Tostado"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/brisa", pad: "all", files: ["indiana1.jpg", "indiana2.jpg", "indiana4.jpg", "indiana6.jpg"] },
    short: "Pava de ala amplia y flexible en tejido brisa color tostado, con cinta café. Elegante y fresca para eventos al aire libre.",
    full: sombrero(
      "La pava es el sombrero de ala amplia y flexible que acompaña los días de fiesta y los paseos al sol. Este tono tostado se ve cálido con vestidos claros, lino y prendas en tonos tierra.",
      ["Horma Pava Reina: ala amplia y flexible.", "Tejido brisa, ligero y ventilado.", "Color tostado con cinta café.", "Para matrimonios al aire libre, paseos y viajes."]
    ),
  },
  {
    name: "Sombrero Pava Reina Alona Apareado",
    category: "Sombreros", weave: "Apareado", style: "Pava Reina Alona",
    price: 205000, flags: {},
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/apareado", pad: "all", files: ["IMG_6134.JPG"] },
    short: "Pava de ala muy amplia en tejido apareado color natural, con cinta de tres franjas en tonos tierra.",
    full: sombrero(
      "La versión alona de la pava amplía aún más el ala para dar sombra generosa. El tejido apareado, de trama pareja, y la cinta de franjas en zigzag claro, naranja y café le dan un aire artesanal.",
      ["Horma Pava Reina Alona: ala muy amplia.", "Tejido apareado de trama pareja.", "Cinta de tres franjas en tonos tierra.", "Sombra generosa para playa y campo."]
    ),
  },
  {
    name: "Sombrero Indiana Doble Paja",
    category: "Sombreros", weave: "Doble Paja", style: "Indiana",
    price: 230000, flags: { isNew: true },
    colors: ["Natural"], sizes: HAT_SIZES,
    photos: { dir: "Indiana/apareado", pad: ["IMG_6130.JPG", "IMG_6133.JPG", "IMG_6140.JPG", "IMG_6145.JPG"], files: ["IMG_6130.JPG", "IMG_6133.JPG", "IMG_6140.JPG", "IMG_6145.JPG", "IMG_6147.JPG"] },
    short: "Indiana de ala ancha en tejido doble paja color natural, más firme y con más cuerpo. Cinta de franjas en tonos tierra.",
    full: sombrero(
      "Un Indiana con más cuerpo: el tejido doble paja le da firmeza al ala y a la copa, para que conserve la forma con el uso. La cinta de franjas en tonos tierra completa una pieza robusta para el trabajo de campo.",
      ["Horma Indiana: ala ancha y copa en lágrima.", "Tejido doble paja, firme y resistente.", "Cinta de tres franjas en tonos tierra.", "Conserva su forma con el uso diario."]
    ),
  },
  {
    name: "Sombrero Safari Superfino Torcido",
    category: "Sombreros", weave: "Superfino torcido", style: "Safari",
    price: 345000, flags: { isFeatured: true },
    colors: ["Jaspeado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/superfino-torcido", pad: "all", files: ["IMG_6154.JPG", "IMG_6155.JPG", "IMG_6158.JPG", "IMG_6223.JPG"] },
    short: "Safari en tejido superfino torcido de acabado jaspeado verde oliva y beige, con cinta café ancha. Liviano, fresco y con mucha textura.",
    full: sombrero(
      "La textura jaspeada de la fibra torcida le da a este Safari un aspecto natural, casi de paisaje. Ala amplia para el sol y una copa alta con pliegue que deja respirar la cabeza.",
      ["Horma Safari: copa alta y ala amplia.", "Tejido superfino torcido, acabado jaspeado.", "Cinta café ancha.", "Liviano para viajes y caminatas."]
    ),
  },
  {
    name: "Sombrero Borsalino Alón Superfino Torcido",
    category: "Sombreros", weave: "Superfino torcido", style: "Borsalino Alon",
    price: 480000, flags: { isNew: true },
    colors: ["Jaspeado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/superfino-torcido", pad: "all", files: ["IMG_6288.JPG", "IMG_6282.JPG", "IMG_6285.JPG", "IMG_6291.JPG", "IMG_6294.JPG"] },
    short: "Borsalino de ala ancha en superfino torcido, la pieza de más horas de tejido de la colección. Acabado jaspeado y cinta café.",
    full: sombrero(
      "Un alón tejido en superfino torcido: fibras delgadas, torcidas a mano, que forman una trama cerrada con matices verdosos y beige. Es la pieza que más horas de trabajo exige en nuestra colección.",
      ["Horma Borsalino Alón: copa con pliegue central y ala ancha.", "Tejido superfino torcido de trama cerrada.", "Acabado jaspeado con cinta café.", "Pieza de colección."]
    ),
  },
  {
    name: "Sombrero Gardeliano Súper Fino Tostado",
    category: "Sombreros", weave: "Súper fino", style: "Gardeliano",
    price: 298000, flags: {},
    colors: ["Tostado"], sizes: HAT_SIZES,
    photos: { dir: "borsalino/superfino", files: ["IMG_6310.JPG", "IMG_6302.JPG", "IMG_6306.JPG", "IMG_6330.JPG", "IMG_6332.JPG"] },
    short: "Gardeliano en tejido súper fino color tostado, con cinta vino. Trama cerrada, liviano y elegante para ocasiones especiales.",
    full: sombrero(
      "Copa pellizcada al frente, ala de caída suave y una trama tan cerrada que casi no se ve: un sombrero elegante que acompaña un traje de lino o una guayabera de fiesta.",
      ["Horma Gardeliano: copa pellizcada y ala de caída suave.", "Tejido súper fino de trama cerrada.", "Tostado con cinta vino.", "Para eventos y ocasiones especiales."]
    ),
  },
  {
    name: "Bolso Ébano Atardecer",
    category: "Bolsos",
    price: 105000, flags: { isNew: true },
    colors: ["Naranja"], sizes: ["Única"],
    photos: { dir: "bolso ebano", files: ["7.jpeg"] },
    short: "Bolso de mano en tejido bicolor naranja y amarillo, con asa redonda y pompón de fibra. Un color cálido que alegra cualquier atuendo.",
    full: accesorio(
      "Los tonos del atardecer en un bolso de mano: tejido en diagonal naranja y amarillo, asa redonda y un pompón de fibra con botón.",
      ["Tejido bicolor en diagonal, hecho a mano.", "Asa redonda tejida.", "Pompón decorativo de fibra.", "Tamaño compacto para salidas y paseos."]
    ),
  },
  {
    name: "Bolso Ébano Sol",
    category: "Bolsos",
    price: 98000, flags: {}, stock: "low",
    colors: ["Amarillo"], sizes: ["Única"],
    photos: { dir: "bolso ebano", files: ["6.jpeg"] },
    short: "Bolso de mano en tejido bicolor amarillo y negro, con asa redonda y pompón de fibra.",
    full: accesorio(
      "Un amarillo intenso cruzado por líneas oscuras en diagonal: un bolso que se nota. Asa redonda tejida y pompón de fibra con botón.",
      ["Tejido bicolor en diagonal, hecho a mano.", "Asa redonda tejida.", "Pompón decorativo de fibra.", "Tamaño compacto."]
    ),
  },
  {
    name: "Mini Bolso Ébano Rosa y Fucsia",
    category: "Bolsos",
    price: 89000, flags: { isFeatured: true }, stock: { Fucsia: 0 },
    colors: ["Rosa", "Fucsia"], sizes: ["Única"],
    photos: { dir: "bolso ebano", files: ["2.jpeg", "WhatsApp Image 2026-10-08 at 12.22.42 PM.jpeg"] },
    short: "Bolso pequeño de iraca en rosa o fucsia, con tejido bicolor en diagonal, asa redonda y pompón de fibra.",
    full: accesorio(
      "La versión más alegre del Ébano, en dos tonos rosados. Tejido en diagonal, asa redonda y pompón de fibra.",
      ["Tejido bicolor en diagonal.", "Asa redonda tejida.", "Pompón decorativo de fibra.", "Disponible en rosa; fucsia agotado temporalmente."]
    ),
  },
  {
    name: "Bolso Ébano Tierra",
    category: "Bolsos",
    price: 102000, flags: { onPromotion: true, discountPercent: 30, promotionEndsAt: days(5) },
    colors: ["Café", "Verde oliva"], sizes: ["Única"],
    photos: { dir: "bolso ebano", files: ["8.jpeg", "3.jpeg"] },
    short: "Bolso de mano en tonos tierra: café o verde oliva, con tejido bicolor en diagonal, asa redonda y pompón de fibra.",
    full: accesorio(
      "Los tonos más sobrios del Ébano, fáciles de combinar con ropa neutra. Tejido en diagonal, asa redonda y pompón de fibra.",
      ["Tejido bicolor en diagonal.", "Asa redonda tejida.", "Pompón decorativo de fibra.", "Disponible en café y verde oliva."]
    ),
  },
  {
    name: "Abanico de Iraca Liso Pequeño",
    category: "Abanicos",
    price: 18000, flags: {},
    colors: ["Surtido"], sizes: ["Única"],
    photos: { dir: "abanicoLiso", files: ["WhatsApp Image 2026-11-17 at 11.59.25 AM.jpeg", "2.jpeg"] },
    short: "Abanico de iraca en tamaño pequeño, con mango recto y diseños tejidos en espiral. Cabe en cualquier bolso; color surtido.",
    full: accesorio(
      "La misma pieza de nuestro abanico liso en un formato más pequeño, para llevar siempre a mano.",
      ["Formato pequeño con mango recto.", "Diseños tejidos en espiral.", "Liviano y resistente.", "Color surtido."]
    ),
  },
  {
    name: "Abanicos de Iraca para Eventos x 12",
    category: "Abanicos",
    price: 300000, flags: { isNew: true },
    colors: ["Surtido"], sizes: ["Única"],
    photos: { dir: "abanicosMadera", files: ["2.jpeg", "WhatsApp Image 2026-11-17 at 11.59.25 AM.jpeg"] },
    short: "Paquete de 12 abanicos de iraca con aro de madera, en colores surtidos. Un detalle artesanal para matrimonios, primeras comuniones y eventos al aire libre.",
    full: accesorio(
      "Un recuerdo útil y hecho a mano para tus invitados: 12 abanicos de iraca con agarre de aro de madera, en diseños y colores surtidos.",
      ["Paquete de 12 unidades.", "Agarre de aro de madera.", "Colores y diseños surtidos.", "Ideal como recordatorio de eventos."],
      "# Pedidos por cantidad\nPara pedidos de más de 5 paquetes o colores específicos, escríbenos antes de comprar para confirmar disponibilidad y tiempos de entrega."
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
const stockFor = (def, colorName) => {
  const rule = def.stock && typeof def.stock === "object" ? def.stock[colorName] : def.stock;
  if (rule === "low") return rand(1, 2);
  if (typeof rule === "number") return rule;
  return rand(3, def.category === "Abanicos" ? 40 : 15);
};
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
        stock: stockFor(def, c.name),
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

  await seedReviews(manifest);

  // Regenerar la curaduría de hoy del home para que incluya los nuevos.
  await DailyProductPick.deleteMany({ dateKey: todayBogota() });
  console.log(`\nManifiesto: ${MANIFEST}`);
}

/* ─── Reseñas de PRUEBA (inventadas) ───
 * 0–5 por producto, aprobadas. Las "historias" (largas) quedan como las más
 * recientes para que el home las muestre. Ninguna tiene usuario asociado. */
const REVIEW_TEXTS = {
  Sombreros: [
    [5, "Lo compré para el matrimonio de mi hermana en Santa Fe de Antioquia y fue el sombrero más comentado de la fiesta. Aguantó todo el día de sol sin perder la forma y es tan liviano que se me olvidaba que lo tenía puesto. Ya le encargué otro a mi papá para su cumpleaños.", true],
    [5, "Se nota el trabajo a mano. El tejido es parejo y la cinta viene muy bien cosida."],
    [4, "Muy bonito y fresco. Pedí talla M siguiendo la guía y me quedó un poquito justo; si estás entre dos tallas, hazle caso a la recomendación y pide la grande."],
    [5, "Mi abuelo usó sombrero de iraca toda la vida en Sandoná y quería regalarle uno que estuviera a la altura. Cuando lo abrió, lo primero que hizo fue mirarle el tejido por dentro y dijo que estaba bien hecho. Para mí no hay mejor reseña que esa.", true],
    [5, "Llegó en tres días, en caja y sin una sola marca. Excelente empaque."],
    [4, "El color es un poco más claro que en las fotos, pero igual me encantó. Muy buena calidad."],
    [5, "Lo uso para ir a la finca todos los fines de semana y sigue como nuevo."],
    [3, "El sombrero es bonito, pero el envío se demoró dos días más de lo prometido. La atención por WhatsApp sí fue rápida y me mantuvieron informado."],
    [5, "Viajé a Cartagena con este sombrero y me salvó del sol del mediodía. Lo que más me sorprendió fue lo fresco que es: no sudé la cabeza en ningún momento. Lo guardé en la maleta con papel por dentro, como recomiendan, y volvió a Bogotá sin deformarse.", true],
    [5, "Excelente."],
    [4, "Me gusta mucho la horma. Le pondría una cinta interior un poco más gruesa para que ajuste mejor."],
    [5, "Es el segundo sombrero que compro en Dizor. Igual de bien hecho que el primero."],
    [5, "Lo pedí como regalo de grado y le encantó. Me ayudaron por WhatsApp a escoger la talla sin saber la medida exacta."],
  ],
  Bolsos: [
    [5, "Lo llevé a un paseo a San Andrés y fue perfecto: cabe el bloqueador, el celular, una toalla pequeña y la billetera. La fibra no se maltrató con la arena y se limpia fácil con un paño seco.", true],
    [5, "Los colores son más vivos en persona. Me han preguntado varias veces dónde lo compré."],
    [4, "Muy lindo y bien terminado. Es un poco más pequeño de lo que imaginaba."],
    [5, "Las asas son firmes y no se deforma aunque lo llene."],
    [5, "Se lo regalé a mi mamá y ahora lo usa para todo."],
    [3, "Bonito, pero el tono que me llegó era más oscuro que el de la foto."],
  ],
  Abanicos: [
    [5, "Los compré para los recordatorios de la primera comunión de mi hija y todos los invitados se los llevaron. Llegaron bien empacados y cada uno con un diseño distinto.", true],
    [5, "Livianos y resistentes. En Barranquilla es indispensable."],
    [4, "Muy lindo, aunque el color surtido que me llegó no era el que esperaba. Igual es precioso."],
    [5, "Perfecto para la cartera. Lo uso todos los días."],
  ],
};
const REVIEW_AUTHORS = [
  ["Laura M.", "Bogotá"], ["Andrés P.", "Medellín"], ["Catalina R.", "Cali"], ["Jorge E.", "Pasto"],
  ["María Fernanda G.", "Barranquilla"], ["Santiago L.", "Cartagena"], ["Paola V.", "Bucaramanga"],
  ["Camilo T.", "Pereira"], ["Diana C.", ""], ["Ricardo O.", "Manizales"], ["Valentina S.", "Santa Marta"],
  ["Hernán Z.", "Popayán"], ["Juliana B.", "Ibagué"], ["Felipe A.", "Bogotá"], ["Natalia Q.", "Medellín"],
  ["Óscar M.", "Sandoná"], ["Luisa F.", "Cali"], ["Mauricio D.", "Neiva"],
];
// Cantidad por producto (en orden del manifiesto): incluye 0 y 1 a propósito.
const REVIEW_COUNTS = [5, 3, 4, 0, 2, 5, 1, 4, 3, 5, 2, 4, 0, 3, 5, 1, 4, 2];

async function seedReviews(manifest) {
  if (manifest.reviews?.length) {
    console.log(`  = ${manifest.reviews.length} reseñas de prueba ya existen, se omiten`);
    return;
  }
  const products = await Product.find({ _id: { $in: manifest.products.map((p) => p.id) } })
    .populate("category", "name").select("name category");
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const now = Date.now();
  const docs = [];
  let author = 0;
  manifest.products.forEach((entry, i) => {
    const product = byId.get(entry.id);
    if (!product) return;
    const pool = REVIEW_TEXTS[product.category?.name] || REVIEW_TEXTS.Sombreros;
    const count = Math.min(REVIEW_COUNTS[i % REVIEW_COUNTS.length], pool.length);
    for (let k = 0; k < count; k++) {
      const [rating, comment, story] = pool[(i * 3 + k) % pool.length];
      const [authorName, city] = REVIEW_AUTHORS[author++ % REVIEW_AUTHORS.length];
      // Historias: últimos 1–3 días (salen en el home). Resto: 5–120 días atrás.
      const ageDays = story ? rand(1, 3) + Math.random() : rand(5, 120) + Math.random();
      const date = new Date(now - ageDays * 86400000);
      docs.push({
        product: product._id, user: null, authorName, city, rating, comment,
        aprobado: true, isBrandReview: false, createdBy: null,
        createdAt: date, updatedAt: date, __v: 0,
      });
    }
  });
  if (!docs.length) return;
  // Inserción directa para conservar las fechas escalonadas (timestamps de Mongoose las pisarían).
  const res = await Review.collection.insertMany(docs);
  manifest.reviews = Object.values(res.insertedIds).map(String);
  writeManifest(manifest);
  console.log(`  + ${docs.length} reseñas de prueba en ${new Set(docs.map((d) => String(d.product))).size} productos`);
}

async function remove() {
  const manifest = readManifest();
  if (manifest.reviews?.length) {
    const { deletedCount } = await Review.deleteMany({ _id: { $in: manifest.reviews } });
    console.log(`  - ${deletedCount} reseñas de prueba`);
  }
  for (const p of manifest.products) {
    await Review.deleteMany({ product: p.id }); // por si alguien reseñó un producto de prueba
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
