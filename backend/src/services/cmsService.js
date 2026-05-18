const HomeContent = require("../models/homeContent");
const ContentPage = require("../models/contentPage");
const Banner = require("../models/banner");

const DEFAULT_HOME = {
  key: "default",
  hero: {
    title: "Sombreros artesanales de Sandoná",
    subtitle:
      "Palma de iraca tejida a mano en Nariño, Colombia. Tradición, elegancia y calidad en cada pieza.",
    ctaLabel: "Ver catálogo",
    ctaHref: "/catalogo",
    imageUrl: "",
  },
  features: [
    {
      title: "Tejido artesanal",
      text: "Brisa, Común y Súper fino — tipos de tejido para cada ocasión.",
    },
    {
      title: "Hormas clásicas",
      text: "Indiana, Safari, Panamá Hats y más estilos icónicos.",
    },
    {
      title: "Envíos en Colombia",
      text: "Interrapidísimo, Envía y Coordinadora. Pagos en COP.",
    },
  ],
  featuredSection: {
    title: "Destacados",
    linkLabel: "Ver todos",
    linkHref: "/catalogo?featured=true",
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
  }

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
  announcement: doc.announcement,
});

exports.formatPage = (page) => ({
  id: page._id,
  title: page.title,
  slug: page.slug,
  excerpt: page.excerpt,
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
