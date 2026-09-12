import Link from "next/link";
import Image from "next/image";

function MediaPlaceholder({ label = "Imagen próximamente" }) {
  return (
    <div className="home-media-fallback" role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

function CraftCardMedia({ images, name, featured }) {
  const list = (images || []).filter((img) => img?.url);
  if (!list.length) {
    return <MediaPlaceholder label={name} />;
  }

  if (list.length === 1) {
    return (
      <Image
        src={list[0].url}
        alt={list[0].altText || name || "Colección Dizor"}
        fill
        sizes={
          featured
            ? "(max-width: 899px) 78vw, 50vw"
            : "(max-width: 899px) 78vw, 25vw"
        }
        style={{ objectFit: "cover" }}
      />
    );
  }

  return (
    <div className="home-collection-card__gallery" aria-label={`${name}: galería`}>
      {list.map((img, i) => (
        <div key={img.id || `craft-img-${i}`} className="home-collection-card__slide">
          <Image
            src={img.url}
            alt={img.altText || `${name} ${i + 1}`}
            fill
            sizes={
              featured
                ? "(max-width: 899px) 78vw, 50vw"
                : "(max-width: 899px) 78vw, 25vw"
            }
            style={{ objectFit: "cover" }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Sección "Nuestros tejidos": editorial en desktop, scroll-snap en móvil.
 * `cards`: [{ wt, img, images, href }]
 */
export default function HomeCraftSection({
  craftSection = {},
  cards = [],
  linkLabel = "Ver",
}) {
  const eyebrow = craftSection.eyebrow || "COLECCIÓN";
  const title = craftSection.title || "Nuestros tejidos";
  const subtitle =
    craftSection.subtitle ||
    "Explora cada línea de Dizor: carácter, finura y tiempo de elaboración.";
  const cta = craftSection.linkLabel || linkLabel;

  return (
    <section className="home-section home-section--craft">
      <div className="home-container">
        <header className="home-section__intro">
          <p className="home-eyebrow">{eyebrow}</p>
          <h2 className="home-section__heading">{title}</h2>
          <p className="home-section__lead">{subtitle}</p>
        </header>

        {cards.length > 0 ? (
          <div className="home-collection__track" role="list">
            {cards.map(({ wt, img, images, href }, index) => {
              const name = wt.name || "Tejido";
              const media = images?.length ? images : img ? [img] : [];
              const featured = index === 0;
              return (
                <Link
                  key={wt._id || wt.id || href}
                  href={href}
                  className={`home-collection-card${
                    media.length ? "" : " home-collection-card--text"
                  }${featured ? " home-collection-card--featured" : ""}`}
                  role="listitem"
                >
                  <div
                    className={`home-collection-card__media${
                      media.length ? "" : " home-collection-card__media--fallback"
                    }`}
                  >
                    <CraftCardMedia
                      images={media}
                      name={name}
                      featured={featured}
                    />
                    {media.length > 1 ? (
                      <span className="home-collection-card__count" aria-hidden="true">
                        {media.length} fotos
                      </span>
                    ) : null}
                  </div>
                  <div className="home-collection-card__meta">
                    <span className="home-collection-card__name">{name}</span>
                    <span className="home-collection-card__cta">{cta}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="home-section__empty">
            Pronto verás nuestras colecciones.{" "}
            <Link href="/catalogo">Ir al catálogo</Link>
          </p>
        )}
      </div>
    </section>
  );
}
