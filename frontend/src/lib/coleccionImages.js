/**
 * Asociación tejido ↔ imágenes CMS (sección homeImages.coleccion).
 *
 * Prioridad de match (primera que aplique):
 * 1. weaveTypeId explícito (campo CMS nuevo)
 * 2. linkHref contiene weaveType=<ObjectId>
 * 3. título normalizado === nombre del tejido (sin acentos, case-insensitive)
 * 4. slug del tejido en linkHref o como título
 */

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeLabel(value) {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function weaveIdOf(wt) {
  return String(wt?._id || wt?.id || "").trim();
}

export function extractWeaveTypeIdFromHref(href) {
  const raw = String(href || "");
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://dizor.local");
    const fromQuery = url.searchParams.get("weaveType");
    if (fromQuery) return String(fromQuery).trim();
  } catch {
    /* ignore */
  }
  const m = raw.match(/[?&]weaveType=([^&]+)/i);
  return m ? decodeURIComponent(m[1]).trim() : "";
}

function imageMatchesWeave(img, wt) {
  const id = weaveIdOf(wt);
  const name = normalizeLabel(wt?.name);
  const slug = normalizeLabel(wt?.slug);

  const imgWeaveId = String(img?.weaveTypeId || "").trim();
  if (id && imgWeaveId && imgWeaveId === id) return true;

  const hrefId = extractWeaveTypeIdFromHref(img?.linkHref);
  if (id && hrefId && hrefId === id) return true;

  const titulo = normalizeLabel(img?.titulo);
  if (name && titulo && titulo === name) return true;
  if (slug && titulo && titulo === slug) return true;

  const href = String(img?.linkHref || "").toLowerCase();
  if (slug && href.includes(`weaveType=${slug}`)) return true;

  return false;
}

/** Todas las imágenes de colección asociadas a un tejido, en orden. */
export function matchColeccionImagesForWeave(wt, coleccionImages = []) {
  return (coleccionImages || [])
    .filter((img) => img?.url && imageMatchesWeave(img, wt))
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

export function primaryColeccionImage(wt, coleccionImages = []) {
  const matches = matchColeccionImagesForWeave(wt, coleccionImages);
  return matches[0] || null;
}

/**
 * Construye tarjetas para "Nuestros tejidos".
 * `weaveTypes` debe venir ya filtrado (p. ej. los 3 del sample diario a medianoche Bogotá).
 * Incluye `images[]` para galería; `img` = primaria.
 */
export function buildWeaveCards(weaveTypes = [], coleccionImages = []) {
  return (weaveTypes || [])
    .slice(0, 3)
    .map((wt) => {
      const images = matchColeccionImagesForWeave(wt, coleccionImages);
      return {
        wt,
        images,
        img: images[0] || null,
        href: `/catalogo?weaveType=${encodeURIComponent(weaveIdOf(wt))}`,
      };
    })
    .filter((card) => weaveIdOf(card.wt));
}
