const HomeImage = require("../models/homeImage");

exports.formatHomeImage = (doc) => ({
  id: String(doc._id),
  url: doc.url,
  publicId: doc.publicId || "",
  altText: doc.altText || "",
  seccion: doc.seccion,
  orden: doc.orden ?? 0,
  activo: doc.activo !== false,
  titulo: doc.titulo || "",
  linkHref: doc.linkHref || "",
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

exports.getActiveHomeImages = async (seccion) => {
  const filter = { activo: true };
  if (seccion) filter.seccion = seccion;

  const images = await HomeImage.find(filter).sort({ orden: 1, createdAt: 1 });
  return images.map(exports.formatHomeImage);
};

exports.groupHomeImagesBySection = (images) => {
  const grouped = {
    hero: [],
    historia: [],
    personalizacion: [],
    pormayor: [],
    inspiracion: [],
    coleccion: [],
  };

  for (const img of images) {
    if (grouped[img.seccion]) {
      grouped[img.seccion].push(img);
    }
  }

  return grouped;
};

/** Primera imagen activa de una sección (hero / historia / personalización). */
exports.primaryImageUrl = (grouped, seccion, fallback = "") => {
  const list = grouped?.[seccion];
  if (list?.length) return list[0].url || fallback;
  return fallback;
};
