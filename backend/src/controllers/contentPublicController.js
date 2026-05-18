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

exports.getHomeContent = catchAsync(async (req, res) => {
  const doc = await getOrCreateHomeContent();
  const banners = await getActiveBanners("home_mid");

  res.status(200).json({
    status: "success",
    home: formatHome(doc),
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
