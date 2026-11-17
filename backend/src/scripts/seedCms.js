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
      excerpt: "Cobertura nacional, transportadoras y envío incluido en el precio.",
      // Nota: la ruta /pagina/envios la sirve una página estática del
      // frontend (app/(shop)/pagina/envios/page.js). Este texto solo se usa
      // si se elimina esa página.
      body:
        "Vendemos y enviamos únicamente dentro de Colombia, con cobertura nacional, a través de Inter Rapidísimo o Servientrega.\n\nEl valor del envío ya está incluido en el precio de cada producto: no se cobra un cargo adicional por envío en el checkout.\n\nEl plazo de entrega aplicable se informa antes de confirmar la compra.",
      isPublished: true,
      showInFooter: true,
      sortOrder: 2,
    },
    {
      title: "Política de cambios",
      slug: "cambios",
      excerpt: "Condiciones para cambios y devoluciones.",
      // Sustituida por /garantias-y-devoluciones (el frontend redirige
      // /pagina/cambios). El texto anterior limitaba los reclamos a 5 días y
      // excluía la garantía de piezas personalizadas: no debe publicarse.
      body:
        "Consulta la información vigente sobre garantía, retracto, reversión del pago y cambios en /garantias-y-devoluciones.",
      isPublished: false,
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
