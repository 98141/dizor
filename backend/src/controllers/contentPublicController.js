const ContentPage = require("../models/contentPage");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  getOrCreateHomeContent,
  getActiveBanners,
  formatHome,
  formatPage,
  formatBanner,
} = require("../services/cmsService");
const {
  getActiveHomeImages,
  groupHomeImagesBySection,
  primaryImageUrl,
} = require("../services/homeImageService");
const { getStoreSettings } = require("../services/settingsService");

exports.getHomeContent = catchAsync(async (req, res) => {
  const doc = await getOrCreateHomeContent();
  const banners = await getActiveBanners("home_mid");
  const images = await getActiveHomeImages();
  const homeImages = groupHomeImagesBySection(images);
  const home = formatHome(doc);

  // Las imágenes del CMS HomeImage tienen prioridad sobre imageUrl legacy
  if (home.hero) {
    home.hero.imageUrl = primaryImageUrl(homeImages, "hero", home.hero.imageUrl);
  }
  if (home.historia) {
    home.historia.imageUrl = primaryImageUrl(
      homeImages,
      "historia",
      home.historia.imageUrl
    );
  }
  if (home.personalizacion) {
    home.personalizacion.imageUrl = primaryImageUrl(
      homeImages,
      "personalizacion",
      home.personalizacion.imageUrl
    );
  }
  if (home.porMayor) {
    home.porMayor.imageUrl = primaryImageUrl(
      homeImages,
      "pormayor",
      home.porMayor.imageUrl
    );
  }

  res.status(200).json({
    status: "success",
    home,
    homeImages,
    banners: banners.map(formatBanner),
  });
});

exports.getBanners = catchAsync(async (req, res) => {
  const banners = await getActiveBanners(req.query.placement);

  res.status(200).json({
    status: "success",
    results: banners.length,
    banners: banners.map(formatBanner),
  });
});

exports.getPages = catchAsync(async (req, res) => {
  const pages = await ContentPage.find({ isPublished: true })
    .select("title slug excerpt sortOrder showInFooter")
    .sort({ sortOrder: 1, title: 1 });

  res.status(200).json({
    status: "success",
    results: pages.length,
    pages: pages.map((p) => ({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      showInFooter: p.showInFooter,
    })),
  });
});

exports.getAppearance = catchAsync(async (req, res) => {
  const settings = await getStoreSettings();
  const a = settings.appearance || {};

  res.status(200).json({
    status: "success",
    appearance: {
      siteName: a.siteName || "",
      primaryColor: a.primaryColor || "",
      accentColor: a.accentColor || "",
      bgColor: a.bgColor || "",
      faviconUrl: a.faviconUrl || "",
      logoUrl: a.logoUrl || "",
    },
  });
});

exports.getPageBySlug = catchAsync(async (req, res, next) => {
  const slug = String(req.params.slug || "")
    .trim()
    .toLowerCase();

  const page = await ContentPage.findOne({ slug, isPublished: true });

  if (!page) {
    return next(new AppError("Página no encontrada", 404));
  }

  res.status(200).json({
    status: "success",
    page: formatPage(page),
  });
});
