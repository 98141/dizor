import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";

/** Inspiración / mosaico editorial — adapta a 1–5 imágenes. */
export default async function HomeInspiration() {
  const cmsData = await getHomeContent().catch(() => null);
  const inspiracion = cmsData?.home?.inspiracion || {};
  const inspiracionImages = (cmsData?.homeImages?.inspiracion || []).filter(
    (img) => img?.url
  );

  if (!inspiracionImages.length) return null;

  const count = Math.min(inspiracionImages.length, 5);

  return (
    <section className="home-section home-section--inspire">
      <div className="home-container home-container--wide">
        <div className="home-inspire__header">
          <div>
            <p className="home-eyebrow">
              {inspiracion.eyebrow || "INSPIRACIÓN"}
            </p>
            <h2 className="home-section__heading">
              {inspiracion.title || "La pieza en la vida real"}
            </h2>
            <p className="home-section__lead">
              {inspiracion.subtitle ||
                "Una selección visual del universo Dizor."}
            </p>
          </div>
          {inspiracion.instagramUrl ? (
            <a
              href={inspiracion.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="home-btn home-btn--outline"
            >
              {inspiracion.ctaLabel || "Síguenos en Instagram"}
            </a>
          ) : null}
        </div>

        <div
          className={`home-inspire__mosaic home-inspire__mosaic--n${count}`}
          data-count={count}
        >
          {inspiracionImages.slice(0, 5).map((img, idx) => {
            const href =
              img.linkHref || inspiracion.instagramUrl || undefined;
            const Tag = href ? "a" : "div";
            const linkProps = href
              ? { href, target: "_blank", rel: "noopener noreferrer" }
              : {};
            return (
              <Tag
                key={img.id || `inspire-${idx}`}
                className={`home-inspire__cell home-inspire__cell--${idx + 1}`}
                {...linkProps}
              >
                <Image
                  src={img.url}
                  alt={img.altText || "Inspiración Dizor"}
                  fill
                  sizes={
                    idx === 0
                      ? "(max-width: 767px) 85vw, 50vw"
                      : "(max-width: 767px) 82vw, 25vw"
                  }
                  className="home-inspire__img"
                />
              </Tag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
