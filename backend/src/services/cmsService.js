const HomeContent = require("../models/homeContent");
const ContentPage = require("../models/contentPage");
const Banner = require("../models/banner");

const DEFAULT_HOME = {
  key: "default",
  hero: {
    brandClaim: "DIZOR",
    title: "Oficio colombiano, piezas que perduran",
    subtitle:
      "Sombreros de palma de iraca tejidos a mano en Sandoná, Nariño. Tradición, elegancia y calidad en cada pieza.",
    ctaLabel: "Ver catálogo",
    ctaHref: "/catalogo",
    secondaryCtaLabel: "Conoce nuestra historia",
    secondaryCtaHref: "/pagina/sobre-dizor",
    imageUrl: "",
  },
  features: [
    {
      title: "Tejido artesanal",
      text: "Brisa, Común y Súper fino — tipos de tejido para cada ocasión.",
      icon: "",
    },
    {
      title: "Hormas clásicas",
      text: "Indiana, Safari, Panamá Hats y más estilos icónicos.",
      icon: "",
    },
    {
      title: "Hecho a mano",
      text: "Cada pieza nace del oficio de artesanas de Sandoná, Nariño.",
      icon: "",
    },
    {
      title: "Envíos en Colombia",
      text: "Interrapidísimo, Envía y Coordinadora. Pagos en COP.",
      icon: "",
    },
  ],
  featuredSection: {
    title: "Destacados",
    linkLabel: "Ver todos",
    linkHref: "/catalogo?featured=true",
  },
  newSection: {
    title: "Novedades",
    linkLabel: "Ver novedades",
    linkHref: "/catalogo?isNew=true",
    isActive: true,
  },
  craftSection: {
    eyebrow: "COLECCIÓN",
    title: "Nuestros tejidos",
    subtitle:
      "Explora cada línea de Dizor: Brisa, Común y Súper fino — carácter, finura y tiempo de elaboración.",
    linkLabel: "Ver",
  },
  historia: {
    eyebrow: "ORIGEN",
    title: "Del páramo a la fibra, de la fibra a la pieza",
    body: "Desde las manos de las artesanas de Sandoná, Nariño, nace cada sombrero Dizor. La palma de iraca se corta, se blanquea y se teje con una disciplina que se transmite de generación en generación. Cada puntada es un acto de memoria cultural, una forma de decir que lo hecho a mano tiene valor, permanencia y alma.",
    imageUrl: "",
    ctaLabel: "Sobre Dizor",
    ctaHref: "/pagina/sobre-dizor",
  },
  personalizacion: {
    eyebrow: "A TU MEDIDA",
    title: "Personaliza tu sombrero",
    body: "Iniciales, monogramas, ajustes de horma y detalles que hacen única tu pieza. Te acompañamos por WhatsApp para definir cada detalle.",
    bullets: [
      "Iniciales y monogramas",
      "Ajustes de horma y acabado",
      "Pedidos especiales bajo consulta",
    ],
    ctaLabel: "Personalizar",
    ctaHref: "/personalizar",
    whatsappHint: "También puedes escribirnos por WhatsApp",
    imageUrl: "",
    imageOnLeft: true,
  },
  porMayor: {
    eyebrow: "POR VOLUMEN",
    title: "Pedidos al por mayor",
    body: "Para tiendas, eventos o distribución. Cotizamos según cantidades y referencias, con atención directa desde Dizor.",
    bullets: [
      "Mínimo 5 unidades",
      "Cotización personalizada por referencias",
      "Ideal para tiendas, eventos y distribución",
    ],
    ctaLabel: "Solicitar cotización",
    ctaHref: "/pedido-mayor",
    imageUrl: "",
    imageOnLeft: true,
  },
  inspiracion: {
    eyebrow: "INSPIRACIÓN",
    title: "La pieza en la vida real",
    subtitle:
      "Una selección visual del universo Dizor: fotografías curadas del oficio y de nuestras piezas.",
    ctaLabel: "Síguenos en Instagram",
    instagramUrl: "https://www.instagram.com/",
  },
  reseñasSection: {
    eyebrow: "VOCES",
    title: "Quienes ya eligieron Dizor",
    isActive: true,
  },
  randomProductsSection: {
    eyebrow: "DESCUBRE",
    title: "Piezas para explorar hoy",
    subtitle: "Una selección renovada cada día desde nuestro catálogo.",
    isActive: true,
  },
  newsletterSection: {
    eyebrow: "NOVEDADES",
    title: "Entérate de las piezas nuevas",
    subtitle:
      "Avisos puntuales de colecciones, personalización y el oficio detrás de cada trama.",
  },
  bestsellerSection: {
    title: "Más vendidos",
    linkLabel: "Ver todos",
    linkHref: "/catalogo?sort=popular",
    isActive: false,
  },
  announcement: {
    text: "",
    linkHref: "",
    isActive: false,
  },
};

exports.getOrCreateHomeContent = async () => {
  let doc = await HomeContent.findOne({ key: "default" });

  if (!doc) {
    doc = await HomeContent.create(DEFAULT_HOME);
    return doc;
  }

  // Rellenar secciones nuevas en documentos creados antes del rediseño
  let dirty = false;
  const ensure = (path, value) => {
    const parts = path.split(".");
    let cur = doc;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (cur[parts[i]] == null) {
        cur[parts[i]] = {};
        dirty = true;
      }
      cur = cur[parts[i]];
    }
    const leaf = parts[parts.length - 1];
    if (cur[leaf] == null || cur[leaf] === "") {
      cur[leaf] = value;
      dirty = true;
    }
  };

  if (!doc.personalizacion || typeof doc.personalizacion !== "object") {
    doc.personalizacion = DEFAULT_HOME.personalizacion;
    dirty = true;
  }
  if (!doc.porMayor || typeof doc.porMayor !== "object") {
    doc.porMayor = DEFAULT_HOME.porMayor;
    dirty = true;
  }
  if (!doc.inspiracion || typeof doc.inspiracion !== "object") {
    doc.inspiracion = DEFAULT_HOME.inspiracion;
    dirty = true;
  }
  if (!doc.reseñasSection || typeof doc.reseñasSection !== "object") {
    doc.reseñasSection = DEFAULT_HOME.reseñasSection;
    dirty = true;
  }
  if (!doc.randomProductsSection || typeof doc.randomProductsSection !== "object") {
    doc.randomProductsSection = DEFAULT_HOME.randomProductsSection;
    dirty = true;
  }
  if (!doc.newsletterSection || typeof doc.newsletterSection !== "object") {
    doc.newsletterSection = DEFAULT_HOME.newsletterSection;
    dirty = true;
  }

  ensure("hero.brandClaim", DEFAULT_HOME.hero.brandClaim);
  ensure("hero.secondaryCtaLabel", DEFAULT_HOME.hero.secondaryCtaLabel);
  ensure("hero.secondaryCtaHref", DEFAULT_HOME.hero.secondaryCtaHref);
  ensure("craftSection.eyebrow", DEFAULT_HOME.craftSection.eyebrow);
  ensure("historia.eyebrow", DEFAULT_HOME.historia.eyebrow);

  if (!doc.features?.length) {
    doc.features = DEFAULT_HOME.features;
    dirty = true;
  }

  if (dirty) await doc.save();

  return doc;
};

exports.isBannerActive = (banner) => {
  if (!banner.isActive) return false;
  const now = new Date();
  if (banner.startsAt && banner.startsAt > now) return false;
  if (banner.endsAt && banner.endsAt < now) return false;
  return true;
};

exports.getActiveBanners = async (placement) => {
  const filter = { isActive: true };
  if (placement) filter.placement = placement;

  const banners = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 });
  return banners.filter(exports.isBannerActive);
};

exports.formatHome = (doc) => ({
  hero: doc.hero,
  features: doc.features,
  featuredSection: doc.featuredSection,
  newSection: doc.newSection,
  craftSection: doc.craftSection,
  historia: doc.historia,
  personalizacion: doc.personalizacion,
  porMayor: doc.porMayor,
  inspiracion: doc.inspiracion,
  reseñasSection: doc.reseñasSection,
  randomProductsSection: doc.randomProductsSection,
  newsletterSection: doc.newsletterSection,
  bestsellerSection: doc.bestsellerSection,
  announcement: doc.announcement,
});

exports.formatPage = (page) => ({
  id: page._id,
  title: page.title,
  slug: page.slug,
  excerpt: page.excerpt,
  imageUrl: page.imageUrl || "",
  imageAlt: page.imageAlt || "",
  body: page.body,
  isPublished: page.isPublished,
  showInFooter: page.showInFooter,
  sortOrder: page.sortOrder,
  seoTitle: page.seoTitle || page.title,
  seoDescription: page.seoDescription || page.excerpt,
  updatedAt: page.updatedAt,
});

exports.formatPageList = (page) => ({
  id: page._id,
  title: page.title,
  slug: page.slug,
  excerpt: page.excerpt,
  isPublished: page.isPublished,
  showInFooter: page.showInFooter,
  sortOrder: page.sortOrder,
  updatedAt: page.updatedAt,
});

exports.formatBanner = (banner) => ({
  id: banner._id,
  title: banner.title,
  subtitle: banner.subtitle,
  imageUrl: banner.imageUrl,
  linkHref: banner.linkHref,
  ctaLabel: banner.ctaLabel,
  placement: banner.placement,
  sortOrder: banner.sortOrder,
  isActive: banner.isActive,
  startsAt: banner.startsAt,
  endsAt: banner.endsAt,
});

exports.DEFAULT_HOME = DEFAULT_HOME;
