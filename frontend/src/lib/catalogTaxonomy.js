/** Helpers puros de taxonomía de catálogo (seguros en Client Components). */

export function taxonomyId(item) {
  return String(item?._id || item?.id || "");
}

/**
 * Valor público de una opción de taxonomía en la URL: el slug (legible,
 * `?category=bolsos`); el id solo como respaldo. El backend acepta ambos.
 */
export function taxonomyValue(item) {
  return String(item?.slug || item?._id || item?.id || "");
}

/** ¿`value` (slug o id) identifica a `item`? */
export function matchesTaxonomy(item, value) {
  const v = String(value || "").toLowerCase();
  if (!v || !item) return false;
  return (
    String(item.slug || "").toLowerCase() === v ||
    taxonomyId(item).toLowerCase() === v
  );
}

/** Lista de valores de un parámetro multiselección (`size=s,m`). */
export function parseValueList(raw) {
  return [
    ...new Set(
      String(raw || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    ),
  ];
}

export function categoryHref(category) {
  const value = taxonomyValue(category);
  if (!value) return "/catalogo";
  return `/catalogo?category=${encodeURIComponent(value)}`;
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
