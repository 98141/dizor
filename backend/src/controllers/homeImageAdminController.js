const HomeImage = require("../models/homeImage");
const { HOME_IMAGE_SECTIONS: SECTIONS } = require("../models/homeImage");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { uploadHomeImages, deleteImage } = require("../services/cloudinaryService");
const { formatHomeImage } = require("../services/homeImageService");
const { logAuditEvent, safeLog } = require("../services/auditService");

exports.listHomeImages = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.seccion && SECTIONS.includes(req.query.seccion)) {
    filter.seccion = req.query.seccion;
  }

  const images = await HomeImage.find(filter).sort({
    seccion: 1,
    orden: 1,
    createdAt: 1,
  });

  res.status(200).json({
    status: "success",
    results: images.length,
    sections: SECTIONS,
    images: images.map(formatHomeImage),
  });
});

exports.createHomeImage = catchAsync(async (req, res, next) => {
  const seccion = String(req.body.seccion || "").trim();
  if (!SECTIONS.includes(seccion)) {
    return next(
      new AppError(
        `Sección inválida. Usa: ${SECTIONS.join(", ")}`,
        400
      )
    );
  }

  if (!req.files?.length) {
    return next(new AppError("Debes subir una imagen desde el dispositivo", 400));
  }

  if (seccion === "inspiracion") {
    const count = await HomeImage.countDocuments({ seccion: "inspiracion" });
    if (count >= 5) {
      return next(
        new AppError(
          "Inspiración admite máximo 5 imágenes. Elimina una para subir otra.",
          400
        )
      );
    }
  }

  const [uploaded] = await uploadHomeImages(req.files);

  const maxOrden = await HomeImage.findOne({ seccion })
    .sort({ orden: -1 })
    .select("orden")
    .lean();

  const image = await HomeImage.create({
    url: uploaded.url,
    publicId: uploaded.publicId,
    altText: req.body.altText || uploaded.alt || "",
    seccion,
    orden: typeof maxOrden?.orden === "number" ? maxOrden.orden + 1 : 0,
    activo: req.body.activo !== "false" && req.body.activo !== false,
    titulo: req.body.titulo || "",
    linkHref: req.body.linkHref || "",
  });

  safeLog(
    logAuditEvent({
      req,
      action: "home_image_created",
      module: "cms",
      user: req.user,
      entityId: image._id,
      entityType: "home_image",
      summary: `Imagen home creada · ${seccion}`,
      newData: { seccion, url: image.url },
    })
  );

  res.status(201).json({
    status: "success",
    image: formatHomeImage(image),
  });
});

exports.updateHomeImage = catchAsync(async (req, res, next) => {
  const image = await HomeImage.findById(req.params.id);
  if (!image) {
    return next(new AppError("Imagen no encontrada", 404));
  }

  const previous = formatHomeImage(image);

  if (req.body.altText !== undefined) image.altText = String(req.body.altText);
  if (req.body.titulo !== undefined) image.titulo = String(req.body.titulo);
  if (req.body.linkHref !== undefined) image.linkHref = String(req.body.linkHref);
  if (req.body.activo !== undefined) {
    image.activo =
      req.body.activo === true ||
      req.body.activo === "true" ||
      req.body.activo === 1;
  }
  if (req.body.orden !== undefined && !Number.isNaN(Number(req.body.orden))) {
    image.orden = Number(req.body.orden);
  }
  if (req.body.seccion && SECTIONS.includes(req.body.seccion)) {
    if (
      req.body.seccion === "inspiracion" &&
      image.seccion !== "inspiracion"
    ) {
      const count = await HomeImage.countDocuments({ seccion: "inspiracion" });
      if (count >= 5) {
        return next(
          new AppError(
            "Inspiración admite máximo 5 imágenes. Elimina una para mover otra aquí.",
            400
          )
        );
      }
    }
    image.seccion = req.body.seccion;
  }

  // Reemplazo de archivo opcional
  if (req.files?.length) {
    const { isCloudinaryConfigured } = require("../config/cloudinary");
    if (!isCloudinaryConfigured()) {
      return next(new AppError("Cloudinary no está configurado", 503));
    }
    const [uploaded] = await uploadHomeImages(req.files);
    const oldPublicId = image.publicId;
    image.url = uploaded.url;
    image.publicId = uploaded.publicId;
    if (oldPublicId) {
      try {
        await deleteImage(oldPublicId);
      } catch {
        /* non-fatal */
      }
    }
  }

  await image.save();

  safeLog(
    logAuditEvent({
      req,
      action: "home_image_updated",
      module: "cms",
      user: req.user,
      entityId: image._id,
      entityType: "home_image",
      summary: `Imagen home editada · ${image.seccion}`,
      previousData: previous,
      newData: formatHomeImage(image),
    })
  );

  res.status(200).json({
    status: "success",
    image: formatHomeImage(image),
  });
});

exports.reorderHomeImages = catchAsync(async (req, res, next) => {
  const items = Array.isArray(req.body.items) ? req.body.items : null;
  if (!items?.length) {
    return next(new AppError("Envía items: [{ id, orden }]", 400));
  }

  const ops = items
    .filter((item) => item?.id != null && item.orden != null)
    .map((item) =>
      HomeImage.updateOne(
        { _id: item.id },
        { $set: { orden: Number(item.orden) } }
      )
    );

  await Promise.all(ops);

  const images = await HomeImage.find().sort({ seccion: 1, orden: 1 });

  res.status(200).json({
    status: "success",
    images: images.map(formatHomeImage),
  });
});

exports.deleteHomeImage = catchAsync(async (req, res, next) => {
  const image = await HomeImage.findByIdAndDelete(req.params.id);
  if (!image) {
    return next(new AppError("Imagen no encontrada", 404));
  }

  if (image.publicId) {
    try {
      await deleteImage(image.publicId);
    } catch {
      /* non-fatal */
    }
  }

  safeLog(
    logAuditEvent({
      req,
      action: "home_image_deleted",
      module: "cms",
      user: req.user,
      entityId: image._id,
      entityType: "home_image",
      summary: `Imagen home eliminada · ${image.seccion}`,
      previousData: { seccion: image.seccion, url: image.url },
    })
  );

  res.status(200).json({
    status: "success",
    message: "Imagen eliminada",
  });
});
