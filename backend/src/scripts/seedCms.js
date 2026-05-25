require("dotenv").config();

const connectDB = require("../config/db");
const HomeContent = require("../models/homeContent");
const ContentPage = require("../models/contentPage");
const { DEFAULT_HOME } = require("../services/cmsService");

const seedCms = async () => {
  await connectDB();

  await HomeContent.findOneAndUpdate(
    { key: "default" },
    DEFAULT_HOME,
    { upsert: true, new: true }
  );
  console.log("✓ Contenido de inicio");

  const pages = [
    {
      title: "Nosotros",
      slug: "nosotros",
      excerpt: "Artesanos de Sandoná, Nariño.",
      body:
        "Dizor nace del trabajo de familias tejedoras de Sandoná, Nariño. Cada sombrero en palma de iraca es elaborado a mano, respetando técnicas transmitidas por generaciones.\n\nCreemos en la moda con identidad colombiana, en el comercio justo y en la calidad que se siente al usar una pieza única.",
      isPublished: true,
      showInFooter: true,
      sortOrder: 1,
    },
    {
      title: "Envíos y entregas",
      slug: "envios",
      excerpt: "Cobertura nacional y tiempos de entrega.",
      body:
        "Realizamos envíos a todo Colombia a través de Interrapidísimo, Envía y Coordinadora.\n\nLos tiempos de entrega dependen de la ciudad destino. En el checkout verás el costo de envío según tu departamento.\n\nEnvío gratis en pedidos que superen el monto mínimo configurado en la tienda.",
      isPublished: true,
      showInFooter: true,
      sortOrder: 2,
    },
    {
      title: "Política de cambios",
      slug: "cambios",
      excerpt: "Condiciones para cambios y devoluciones.",
      body:
        "Por tratarse de productos artesanales, las piezas personalizadas no tienen devolución salvo defecto de fabricación.\n\nPara productos de catálogo estándar, contáctanos dentro de los 5 días hábiles posteriores a la entrega si recibes un artículo dañado o incorrecto.",
      isPublished: true,
      showInFooter: true,
      sortOrder: 3,
    },
  ];

  const sizeGuidePage = {
    title: "Guía de tallas",
    slug: "guia-de-tallas",
    excerpt: "Aprende a medir tu cabeza en dos pasos y encuentra la talla perfecta para tu sombrero artesanal.",
    imageUrl: "",
    imageAlt: "Cómo medir la cabeza para elegir la talla de sombrero",
    body:
      "# ¿Cómo medir tu cabeza?\n\n" +
      "Necesitas una cinta métrica flexible (o una tira de papel). Rodea tu cabeza por la parte más ancha: por encima de las orejas y aproximadamente 1 cm sobre las cejas. Mantén la cinta nivelada, ajustada pero sin apretar. Ese número en centímetros es tu talla.\n\n" +
      "# Tabla de tallas\n\n" +
      "Talla XS — 52 a 53 cm\n" +
      "Talla S — 54 a 55 cm\n" +
      "Talla M — 56 a 57 cm\n" +
      "Talla L — 58 a 59 cm\n" +
      "Talla XL — 60 a 61 cm\n" +
      "Talla XXL — 62 cm o más\n\n" +
      "# Consejos para elegir bien\n\n" +
      "- Si tu medida cae entre dos tallas, elige la mayor. Los sombreros de palma de iraca tienen una ligera flexibilidad natural.\n" +
      "- Mide al final del día, cuando la cabeza está en su tamaño máximo.\n" +
      "- Para pedidos personalizados ajustamos la copa exactamente a tu medida sin costo adicional.\n\n" +
      "# ¿Tienes dudas?\n\n" +
      "Escríbenos por WhatsApp o usa el formulario de solicitud personalizada. Con gusto te asesoramos para que tu sombrero quede perfecto.",
    isPublished: true,
    showInFooter: true,
    sortOrder: 0,
    seoTitle: "Guía de tallas — Sombreros artesanales Dizor",
    seoDescription: "Aprende a medir tu cabeza y elige la talla correcta para tu sombrero de palma de iraca. Tabla de tallas XS a XXL.",
  };

  await ContentPage.findOneAndUpdate({ slug: sizeGuidePage.slug }, sizeGuidePage, {
    upsert: true,
    new: true,
  });
  console.log(`✓ Página: ${sizeGuidePage.title}`);

  for (const page of pages) {
    await ContentPage.findOneAndUpdate({ slug: page.slug }, page, {
      upsert: true,
      new: true,
    });
    console.log(`✓ Página: ${page.title}`);
  }

  console.log("\nCMS inicializado.");
  process.exit(0);
};

seedCms().catch((err) => {
  console.error(err);
  process.exit(1);
});
