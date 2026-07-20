const ContentPage = require("../models/contentPage");
const Banner = require("../models/banner");
const HomeContent = require("../models/homeContent");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  getOrCreateHomeContent,
  formatHome,
  formatPage,
  formatPageList,
  formatBanner,
  MAX_ANNOUNCEMENTS,
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
  const previousData = formatHome(doc);

  if (req.body.hero) Object.assign(doc.hero, req.body.hero);
  if (req.body.features) doc.features = req.body.features;
  if (req.body.featuredSection) {
    Object.assign(doc.featuredSection, req.body.featuredSection);
  }
  if (req.body.announcement) {
    const { isActive, items } = req.body.announcement;
    if (typeof isActive === "boolean") doc.announcement.isActive = isActive;
    if (Array.isArray(items)) {
      doc.announcement.items = items
        .filter((item) => item && String(item.text || "").trim())
        .slice(0, MAX_ANNOUNCEMENTS)
        .map((item) => ({
          text: String(item.text).trim(),
          linkHref: String(item.linkHref || "").trim(),
        }));
    }
  }
  if (req.body.newSection) Object.assign(doc.newSection, req.body.newSection);
  if (req.body.craftSection) Object.assign(doc.craftSection, req.body.craftSection);
  if (req.body.historia) Object.assign(doc.historia, req.body.historia);
  if (req.body.personalizacion) {
    Object.assign(doc.personalizacion, req.body.personalizacion);
  }
  if (req.body.porMayor) Object.assign(doc.porMayor, req.body.porMayor);
  if (req.body.inspiracion) Object.assign(doc.inspiracion, req.body.inspiracion);
  if (req.body.reseñasSection) {
    Object.assign(doc.reseñasSection, req.body.reseñasSection);
  }
  if (req.body.randomProductsSection) {
    Object.assign(doc.randomProductsSection, req.body.randomProductsSection);
  }
  if (req.body.newsletterSection) {
    Object.assign(doc.newsletterSection, req.body.newsletterSection);
  }
  if (req.body.bestsellerSection) {
    Object.assign(doc.bestsellerSection, req.body.bestsellerSection);
  }

  await doc.save();

  safeLog(
    logAuditEvent({
      req,
      action: "cms_home_updated",
      module: "cms",
      user: req.user,
      entityId: doc._id,
      entityType: "home_content",
      summary: "Contenido del inicio actualizado",
      previousData,
      newData: formatHome(doc),
    })
  );

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

  safeLog(
    logAuditEvent({
      req,
      action: "cms_page_created",
      module: "cms",
      user: req.user,
      entityId: page._id,
      entityType: "content_page",
      summary: `Página CMS creada · ${page.title}`,
      newData: { title: page.title, slug: page.slug, isPublished: page.isPublished },
    })
  );

  res.status(201).json({
    status: "success",
    page: formatPage(page),
  });
});

exports.updatePage = catchAsync(async (req, res, next) => {
  const previous = await ContentPage.findById(req.params.id).lean();
  if (!previous) return next(new AppError("Página no encontrada", 404));

  const page = await ContentPage.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  safeLog(
    logAuditEvent({
      req,
      action: "cms_page_updated",
      module: "cms",
      user: req.user,
      entityId: page._id,
      entityType: "content_page",
      summary: `Página CMS editada · ${page.title}`,
      previousData: { title: previous.title, slug: previous.slug, isPublished: previous.isPublished },
      newData: { title: page.title, slug: page.slug, isPublished: page.isPublished },
    })
  );

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

  safeLog(
    logAuditEvent({
      req,
      action: "cms_page_deleted",
      module: "cms",
      user: req.user,
      entityId: page._id,
      entityType: "content_page",
      summary: `Página CMS eliminada · ${page.title}`,
      previousData: { title: page.title, slug: page.slug },
    })
  );

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

  safeLog(
    logAuditEvent({
      req,
      action: "cms_banner_created",
      module: "cms",
      user: req.user,
      entityId: banner._id,
      entityType: "banner",
      summary: `Banner creado · ${banner.placement}`,
      newData: { placement: banner.placement, isActive: banner.isActive },
    })
  );

  res.status(201).json({
    status: "success",
    banner: formatBanner(banner),
  });
});

exports.updateBanner = catchAsync(async (req, res, next) => {
  const previous = await Banner.findById(req.params.id).lean();
  if (!previous) return next(new AppError("Banner no encontrado", 404));

  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  safeLog(
    logAuditEvent({
      req,
      action: "cms_banner_updated",
      module: "cms",
      user: req.user,
      entityId: banner._id,
      entityType: "banner",
      summary: `Banner editado · ${banner.placement}`,
      previousData: { placement: previous.placement, isActive: previous.isActive },
      newData: { placement: banner.placement, isActive: banner.isActive },
    })
  );

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

  safeLog(
    logAuditEvent({
      req,
      action: "cms_banner_deleted",
      module: "cms",
      user: req.user,
      entityId: banner._id,
      entityType: "banner",
      summary: `Banner eliminado · ${banner.placement}`,
      previousData: { placement: banner.placement },
    })
  );

  res.status(200).json({
    status: "success",
    message: "Banner eliminado",
  });
});
