import { getHomeContent } from "@/services/cmsService";
import InspirationGallery from "@/components/home/InspirationGallery";

const MAX_IMAGES = 5;
const DIZOR_INSTAGRAM_URL = "https://www.instagram.com/sombrereriadizor/";

/** URL del CMS si apunta a un perfil; si está vacía o es la raíz genérica, el perfil de Dizor. */
function resolveInstagramUrl(url) {
  const value = (url || "").trim();
  const isGenericRoot = /^https?:\/\/(www\.)?instagram\.com\/?$/i.test(value);
  return value && !isGenericRoot ? value : DIZOR_INSTAGRAM_URL;
}
const CLOUDINARY_UPLOAD_RE =
  /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/;

/**
 * Relación ancho/alto real de una imagen de Cloudinary (fl_getinfo).
 * Permite renderizar la galería en servidor con proporciones exactas
 * (sin saltos de layout). Si falla, el cliente la mide al cargar.
 */
async function getImageRatio(url) {
  const match = CLOUDINARY_UPLOAD_RE.exec(url);
  if (!match) return null;
  try {
    const res = await fetch(
      `https://res.cloudinary.com/${match[1]}/image/upload/fl_getinfo/${match[2]}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return null;
    const info = await res.json();
    const { width, height } = info?.output || info?.input || {};
    return width > 0 && height > 0 ? width / height : null;
  } catch {
    return null;
  }
}

/** Alt legible: descarta nombres de archivo (p. ej. "8062489_1810356…_n"). */
function readableAlt(altText, index) {
  const alt = (altText || "").trim();
  const looksLikeFilename =
    /^[\w.-]+$/.test(alt) && (/\d{5,}/.test(alt) || alt.includes("_"));
  return alt && !looksLikeFilename
    ? alt
    : `Inspiración Dizor — fotografía ${index + 1}`;
}

/** Inspiración — galería editorial de filas justificadas (1–5 imágenes). */
export default async function HomeInspiration() {
  const cmsData = await getHomeContent().catch(() => null);
  const inspiracion = cmsData?.home?.inspiracion || {};
  const inspiracionImages = (cmsData?.homeImages?.inspiracion || [])
    .filter((img) => img?.url)
    .slice(0, MAX_IMAGES);

  if (!inspiracionImages.length) return null;

  const ratios = await Promise.all(
    inspiracionImages.map((img) => getImageRatio(img.url))
  );

  const images = inspiracionImages.map((img, idx) => ({
    id: img.id || `inspire-${idx}`,
    url: img.url,
    alt: readableAlt(img.altText, idx),
    linkHref: img.linkHref || "",
    ratio: ratios[idx],
  }));

  return (
    <section
      className="home-section home-section--inspire"
      aria-labelledby="home-inspire-heading"
    >
      <div className="home-container home-container--wide">
        <div className="home-inspire__header">
          <div>
            <p className="home-eyebrow">
              {inspiracion.eyebrow || "INSPIRACIÓN"}
            </p>
            <h2 id="home-inspire-heading" className="home-section__heading">
              {inspiracion.title || "La pieza en la vida real"}
            </h2>
            <p className="home-section__lead">
              {inspiracion.subtitle ||
                "Una selección visual del universo Dizor."}
            </p>
          </div>
          <a
            href={resolveInstagramUrl(inspiracion.instagramUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="home-btn home-btn--outline"
          >
            {inspiracion.ctaLabel || "Síguenos en Instagram"}
          </a>
        </div>

        <InspirationGallery images={images} />
      </div>
    </section>
  );
}
