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
