const ContentPage = require("../models/contentPage");
const Banner = require("../models/banner");
const HomeContent = require("../models/homeContent");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const {
  getOrCreateHomeContent,
  formatHome,
  formatPage,
  formatPageList,
  formatBanner,
} = require("../services/cmsService");

exports.getHomeContent = catchAsync(async (req, res) => {
  const doc = await getOrCreateHomeContent();

  res.status(200).json({
    status: "success",
    home: formatHome(doc),
  });
});

exports.updateHomeContent = catchAsync(async (req, res) => {
  const doc = await getOrCreateHomeContent();

  if (req.body.hero) Object.assign(doc.hero, req.body.hero);
  if (req.body.features) doc.features = req.body.features;
  if (req.body.featuredSection) {
    Object.assign(doc.featuredSection, req.body.featuredSection);
  }
  if (req.body.announcement) {
    Object.assign(doc.announcement, req.body.announcement);
  }

  await doc.save();

  res.status(200).json({
    status: "success",
    home: formatHome(doc),
  });
});

exports.getPages = catchAsync(async (req, res) => {
  const pages = await ContentPage.find().sort({ sortOrder: 1, title: 1 });

  res.status(200).json({
    status: "success",
    results: pages.length,
    pages: pages.map(formatPageList),
  });
});

exports.getPage = catchAsync(async (req, res, next) => {
  const page = await ContentPage.findById(req.params.id);

  if (!page) {
    return next(new AppError("Página no encontrada", 404));
  }

  res.status(200).json({
    status: "success",
    page: formatPage(page),
  });
});

exports.createPage = catchAsync(async (req, res) => {
  const page = await ContentPage.create(req.body);

  res.status(201).json({
    status: "success",
    page: formatPage(page),
  });
});

exports.updatePage = catchAsync(async (req, res, next) => {
  const page = await ContentPage.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!page) {
    return next(new AppError("Página no encontrada", 404));
  }

  res.status(200).json({
    status: "success",
    page: formatPage(page),
  });
});

exports.deletePage = catchAsync(async (req, res, next) => {
  const page = await ContentPage.findByIdAndDelete(req.params.id);

  if (!page) {
    return next(new AppError("Página no encontrada", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Página eliminada",
  });
});

exports.getBanners = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.placement) filter.placement = req.query.placement;

  const banners = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: banners.length,
    banners: banners.map(formatBanner),
  });
});

exports.createBanner = catchAsync(async (req, res) => {
  const banner = await Banner.create(req.body);

  res.status(201).json({
    status: "success",
    banner: formatBanner(banner),
  });
});

exports.updateBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!banner) {
    return next(new AppError("Banner no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    banner: formatBanner(banner),
  });
});

exports.deleteBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);

  if (!banner) {
    return next(new AppError("Banner no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Banner eliminado",
  });
});
