/** Helpers puros de taxonomía de catálogo (seguros en Client Components). */

export function taxonomyId(item) {
  return String(item?._id || item?.id || "");
}

export function categoryHref(category) {
  const id = category?._id || category?.id;
  if (!id) return "/catalogo";
  return `/catalogo?category=${encodeURIComponent(String(id))}`;
}

export function getActiveWeaveTypes(filtersPayload) {
  const list = filtersPayload?.filters?.weaveTypes || [];
  return Array.isArray(list) ? list : [];
}

/**
 * Categorías activas. Orden: el del backend (sortOrder, name).
 */
export function getActiveCategories(filtersPayload) {
  const list = filtersPayload?.filters?.categories || [];
  return Array.isArray(list) ? list : [];
}
