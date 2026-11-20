import Link from "next/link";
import Image from "next/image";
import HomeSectionIntro, { ArrowIcon } from "./HomeSectionIntro";

function MediaPlaceholder({ label = "Imagen próximamente" }) {
  return (
    <div className="home-media-fallback" role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

/**
 * Una imagen base siempre (móvil).
 * Galería multi-imagen solo visible en escritorio (≥900px) vía CSS
 * para evitar scroll horizontal anidado en móvil.
 */
function CraftCardMedia({ images, name }) {
  const list = (images || []).filter((img) => img?.url);
  if (!list.length) {
    return <MediaPlaceholder label={name} />;
  }

  const sizes = "(max-width: 899px) 80vw, 31vw";

  return (
    <>
      <Image
        src={list[0].url}
        alt={list[0].altText || name || "Colección Dizor"}
        fill
        sizes={sizes}
        className="home-collection-card__primary"
      />
      {list.length > 1 ? (
        <div
          className="home-collection-card__gallery"
          aria-label={`${name}: galería`}
        >
          {list.map((img, i) => (
            <div
              key={img.id || `craft-img-${i}`}
              className="home-collection-card__slide"
            >
              <Image
                src={img.url}
                alt={img.altText || `${name} ${i + 1}`}
                fill
                sizes={sizes}
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * «Nuestros tejidos»: paneles editoriales en escritorio, carrusel con
 * scroll-snap en móvil. Nombre y descripción salen del tipo de tejido
 * administrado (sin textos inventados); fotos de Inicio → Colección.
 * `cards`: [{ wt, img, images, href }]
 */
export default function HomeCraftSection({
  craftSection = {},
  cards = [],
  linkLabel = "Ver",
}) {
  const title = craftSection.title || "Nuestros tejidos";
  const subtitle =
    craftSection.subtitle ||
    "Explora cada línea de Dizor: carácter, finura y tiempo de elaboración.";
  const cta = craftSection.linkLabel || linkLabel;
  const count = cards.length;

  return (
    <section
      className="home-section home-section--editorial home-section--craft"
      aria-labelledby="home-craft-heading"
    >
      <div className="home-container home-container--wide">
        <div className="home-craft">
        <div className="home-craft__copy">
          <HomeSectionIntro
            id="home-craft-heading"
            eyebrow={craftSection.eyebrow}
            title={title}
            lead={subtitle}
            tone="editorial"
          />
        </div>

        {count > 0 ? (
          <ul
            className={`home-collection__track home-collection__track--n${Math.min(count, 4)}`}
            data-count={count}
          >
            {cards.map(({ wt, img, images, href }) => {
              const name = wt.name || "Tejido";
              const description = (wt.description || "").trim();
              const media = images?.length ? images : img ? [img] : [];
              return (
                <li key={wt._id || wt.id || href} className="home-collection__item">
                  <Link
                    href={href}
                    className={`home-collection-card${
                      media.length ? "" : " home-collection-card--text"
                    }`}
                  >
                    <div
                      className={`home-collection-card__media${
                        media.length ? "" : " home-collection-card__media--fallback"
                      }`}
                    >
                      <CraftCardMedia images={media} name={name} />
                      {media.length > 1 ? (
                        <span
                          className="home-collection-card__count"
                          aria-hidden="true"
                        >
                          {media.length} fotos
                        </span>
                      ) : null}
                    </div>
                    <div className="home-collection-card__meta">
                      <h3 className="home-collection-card__name">{name}</h3>
                      {description ? (
                        <p className="home-collection-card__desc">{description}</p>
                      ) : null}
                      <span className="home-collection-card__cta">
                        <span>{cta}</span>
                        <ArrowIcon />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="home-section__empty">
            Pronto verás nuestras colecciones.{" "}
            <Link href="/catalogo">Ir al catálogo</Link>
          </p>
        )}
        </div>
      </div>
    </section>
  );
}
