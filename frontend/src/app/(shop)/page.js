import Link from "next/link";
import Image from "next/image";
import ProductCarousel from "@/components/home/ProductCarousel";
import NewsletterSignup from "@/components/marketing/NewsletterSignup";
import ViewItemListTracker from "@/components/analytics/ViewItemListTracker";
import { getHomeContent } from "@/services/cmsService";
import { fetchAppearance, getSiteName } from "@/lib/fetchAppearance";
import { getWhatsAppUrl } from "@/lib/whatsapp";

const HOME_TITLE = "Sombreros artesanales de Sandoná";
const HOME_DESCRIPTION =
  "Sombreros artesanales en palma de iraca de Sandoná, Nariño. Tejidos Brisa, Común y Súper fino. Envíos a todo Colombia.";
const DEFAULT_OG_IMAGE = "/icon-512.png";

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  keywords: [
    "sombreros artesanales Colombia",
    "sombrero palma de iraca",
    "sombreros Sandoná",
    "artesanías Nariño",
    "sombreros tejidos a mano",
  ],
  openGraph: {
    title: HOME_TITLE,
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño. Tejidos Brisa, Común y Súper fino.",
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: HOME_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  alternates: {
    canonical: "/",
  },
};

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function fetchJson(url, revalidate = 60) {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function MediaPlaceholder({ label = "Imagen próximamente" }) {
  return (
    <div className="home-media-fallback" role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

function Stars({ rating = 5 }) {
  const n = Math.max(1, Math.min(5, Number(rating) || 5));
  return (
    <span className="home-voices__stars" aria-label={`${n} de 5 estrellas`}>
      {"★".repeat(n)}
      <span className="home-voices__stars-empty">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default async function HomePage() {
  const [cmsData, dailyData, newProductsData, reviewsData, filtersData, appearance] =
    await Promise.all([
      getHomeContent().catch(() => null),
      fetchJson(`${BASE}/products/daily-random?limit=10`, 300),
      fetchJson(`${BASE}/products?isNew=true&limit=12`, 60),
      fetchJson(`${BASE}/reviews?limit=4`, 60),
      fetchJson(`${BASE}/products/filters`, 300),
      fetchAppearance(),
    ]);

  const siteName = getSiteName(appearance);
  const home = cmsData?.home || {};
  const homeImages = cmsData?.homeImages || {};
  const hero = home.hero || {};
  const features = home.features?.length ? home.features : [];
  const newSection = home.newSection || {};
  const craftSection = home.craftSection || {};
  const historia = home.historia || {};
  const personalizacion = home.personalizacion || {};
  const porMayor = home.porMayor || {};
  const inspiracion = home.inspiracion || {};
  const reseñasSection = home.reseñasSection || {};
  const randomSection = home.randomProductsSection || {};
  const newsletterSection = home.newsletterSection || {};

  const craftTypes = filtersData?.filters?.weaveTypes || [];
  const coleccionImages = (homeImages.coleccion || []).filter((img) => img?.url);
  const inspiracionImages = (homeImages.inspiracion || []).filter(
    (img) => img?.url
  );
  const dailyProducts = dailyData?.products || [];
  const newProducts = newProductsData?.products || [];
  const reviews = reviewsData?.reviews || [];

  const heroImage =
    homeImages.hero?.[0]?.url || hero.imageUrl || "";
  const historiaImage =
    homeImages.historia?.[0]?.url || historia.imageUrl || "";
  const personalizacionImage =
    homeImages.personalizacion?.[0]?.url || personalizacion.imageUrl || "";
  const porMayorImage =
    homeImages.pormayor?.[0]?.url || porMayor.imageUrl || "";

  const waPersonalizar = getWhatsAppUrl(
    "Hola Dizor, quiero personalizar un sombrero."
  );

  const homePageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"}/#homepage`,
    name: `${siteName} | Sombreros artesanales de Sandoná`,
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co",
    isPartOf: {
      "@id": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"}/#website`,
    },
    about: {
      "@id": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"}/#organization`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />

      {/* 1. HERO full-bleed */}
      <section
        className={`home-hero${heroImage ? " home-hero--has-image" : ""}`}
        style={
          heroImage
            ? { backgroundImage: `url(${heroImage})` }
            : undefined
        }
      >
        <div className="home-hero__overlay" aria-hidden="true" />
        <div className="home-hero__inner">
          <p className="home-hero__brand home-anim home-anim--1">
            {hero.brandClaim || siteName || "DIZOR"}
          </p>
          <h1 className="home-hero__title home-anim home-anim--2">
            {hero.title || "Oficio colombiano, piezas que perduran"}
          </h1>
          <p className="home-hero__text home-anim home-anim--3">
            {hero.subtitle ||
              "Sombreros de palma de iraca tejidos a mano en Sandoná, Nariño."}
          </p>
          <div className="home-hero__ctas home-anim home-anim--4">
            <Link
              href={hero.ctaHref || "/catalogo"}
              className="home-btn home-btn--primary"
            >
              {hero.ctaLabel || "Ver catálogo"}
            </Link>
            {(hero.secondaryCtaLabel || hero.secondaryCtaHref) && (
              <Link
                href={hero.secondaryCtaHref || "/pagina/sobre-dizor"}
                className="home-btn home-btn--ghost"
              >
                {hero.secondaryCtaLabel || "Conoce nuestra historia"}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. Beneficios */}
      {features.length > 0 && (
        <section className="home-benefits">
          <div className="home-container">
            <div className="home-benefits__grid">
              {features.slice(0, 4).map((feature) => (
                <div key={feature.title} className="home-benefit">
                  {feature.icon ? (
                    <span className="home-benefit__icon" aria-hidden="true">
                      {feature.icon}
                    </span>
                  ) : null}
                  <h3 className="home-benefit__title">{feature.title}</h3>
                  <p className="home-benefit__text">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Novedades (productos isNew) */}
      {newSection.isActive !== false && newProducts.length > 0 && (
        <section className="home-section home-section--border">
          <div className="home-container">
            <header className="home-section__intro">
              <p className="home-eyebrow">
                {newSection.eyebrow || "LO NUEVO"}
              </p>
              <h2 className="home-section__heading">
                {newSection.title || "Novedades"}
              </h2>
              <p className="home-section__lead">
                {newSection.subtitle ||
                  "Las piezas recién marcadas como nuevas en nuestro catálogo."}
              </p>
            </header>
            <ViewItemListTracker
              products={newProducts}
              listId="home_new"
              listName="Novedades"
            />
            <ProductCarousel
              products={newProducts}
              listId="home_new"
              listName="Novedades"
            />
            {(newSection.linkLabel || newSection.linkHref) && (
              <p className="home-section__more">
                <Link
                  href={newSection.linkHref || "/catalogo?isNew=true"}
                  className="home-text-link"
                >
                  {newSection.linkLabel || "Ver novedades"}
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* 4. Colecciones / tejidos */}
      <section className="home-section home-section--craft">
        <div className="home-container">
          <header className="home-section__intro">
            <p className="home-eyebrow">
              {craftSection.eyebrow || "COLECCIÓN"}
            </p>
            <h2 className="home-section__heading">
              {craftSection.title || "Nuestros tejidos"}
            </h2>
            <p className="home-section__lead">
              {craftSection.subtitle ||
                "Explora cada línea de Dizor: carácter, finura y tiempo de elaboración."}
            </p>
          </header>

          {coleccionImages.length > 0 ? (
            <div className="home-collection__grid">
              {coleccionImages.map((img) => (
                <Link
                  key={img.id}
                  href={img.linkHref || "/catalogo"}
                  className="home-collection-card"
                >
                  <div className="home-collection-card__media">
                    <Image
                      src={img.url}
                      alt={img.altText || img.titulo || "Colección Dizor"}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className="home-collection-card__meta">
                    <span className="home-collection-card__name">
                      {img.titulo || "Explorar"}
                    </span>
                    <span className="home-collection-card__cta">
                      {craftSection.linkLabel || "Ver"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : craftTypes.length > 0 ? (
            <div className="home-collection__grid">
              {craftTypes.map((wt) => (
                <Link
                  key={wt._id}
                  href={`/catalogo?weaveType=${wt._id}`}
                  className="home-collection-card home-collection-card--text"
                >
                  <div className="home-collection-card__media home-collection-card__media--fallback">
                    <MediaPlaceholder label={wt.name} />
                  </div>
                  <div className="home-collection-card__meta">
                    <span className="home-collection-card__name">{wt.name}</span>
                    <span className="home-collection-card__cta">
                      {craftSection.linkLabel || "Ver"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="home-section__empty">
              Pronto verás nuestras colecciones.{" "}
              <Link href="/catalogo">Ir al catálogo</Link>
            </p>
          )}
        </div>
      </section>

      {/* 4. Historia */}
      <section className="home-section home-section--story">
        <div className="home-container">
          <div
            className={`home-story${historiaImage ? " home-story--with-image" : ""}`}
          >
            {historiaImage && (
              <div className="home-story__media">
                <div className="home-story__image-wrap">
                  <Image
                    src={historiaImage}
                    alt={
                      homeImages.historia?.[0]?.altText ||
                      "Historia Dizor"
                    }
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </div>
            )}
            <div className="home-story__content">
              <p className="home-eyebrow">
                {historia.eyebrow || "ORIGEN"}
              </p>
              <h2 className="home-section__heading">
                {historia.title || "Del oficio a tu cotidianidad"}
              </h2>
              <p className="home-story__body">
                {historia.body ||
                  "Desde las manos de las artesanas de Sandoná nace cada sombrero Dizor."}
              </p>
              {historia.ctaLabel && (
                <Link
                  href={historia.ctaHref || "/pagina/sobre-dizor"}
                  className="home-text-link"
                >
                  {historia.ctaLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Productos aleatorios 24h */}
      {randomSection.isActive !== false && dailyProducts.length > 0 && (
        <section className="home-section home-section--border">
          <div className="home-container">
            <header className="home-section__intro">
              <p className="home-eyebrow">
                {randomSection.eyebrow || "DESCUBRE"}
              </p>
              <h2 className="home-section__heading">
                {randomSection.title || "Piezas para explorar hoy"}
              </h2>
              <p className="home-section__lead">
                {randomSection.subtitle ||
                  "Una selección renovada cada día desde nuestro catálogo."}
              </p>
            </header>
            <ViewItemListTracker
              products={dailyProducts}
              listId="home_daily"
              listName="Selección del día"
            />
            <ProductCarousel products={dailyProducts} />
          </div>
        </section>
      )}

      {/* 6. Personalización */}
      <section className="home-section home-section--border">
        <div className="home-container">
          <div
            className={`home-personalize${
              personalizacion.imageOnLeft !== false
                ? " home-personalize--image-left"
                : ""
            }${!personalizacionImage ? " home-personalize--no-media" : ""}`}
          >
            <div className="home-personalize__content">
              <p className="home-eyebrow">
                {personalizacion.eyebrow || "A TU MEDIDA"}
              </p>
              <h2 className="home-section__heading">
                {personalizacion.title || "Personaliza tu sombrero"}
              </h2>
              <p className="home-section__lead">
                {personalizacion.body ||
                  "Iniciales, monogramas y detalles que hacen única tu pieza."}
              </p>
              {Array.isArray(personalizacion.bullets) &&
                personalizacion.bullets.length > 0 && (
                  <ul className="home-personalize__list">
                    {personalizacion.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              <div className="home-personalize__actions">
                <Link
                  href={personalizacion.ctaHref || "/personalizar"}
                  className="home-btn home-btn--primary home-btn--solid"
                >
                  {personalizacion.ctaLabel || "Personalizar"}
                </Link>
                <a
                  href={waPersonalizar}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home-personalize__wa-hint"
                >
                  {personalizacion.whatsappHint ||
                    "También puedes escribirnos por WhatsApp"}
                </a>
              </div>
            </div>
            {personalizacionImage && (
              <div className="home-personalize__media">
                <div className="home-personalize__image-wrap">
                  <Image
                    src={personalizacionImage}
                    alt={
                      homeImages.personalizacion?.[0]?.altText ||
                      "Personalización Dizor"
                    }
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. Voces / reseñas */}
      {reseñasSection.isActive !== false && reviews.length > 0 && (
        <section className="home-section home-section--border">
          <div className="home-container">
            <header className="home-section__intro">
              <p className="home-eyebrow">
                {reseñasSection.eyebrow || "VOCES"}
              </p>
              <h2 className="home-section__heading">
                {reseñasSection.title || "Quienes ya eligieron Dizor"}
              </h2>
            </header>
            <div className="home-voices__grid">
              {reviews.map((review) => (
                <blockquote key={review.id} className="home-voice">
                  <Stars rating={review.rating} />
                  <p className="home-voice__quote">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                  <footer className="home-voice__author">
                    <strong>{review.authorName}</strong>
                    {review.city ? (
                      <span className="home-voice__city">
                        {review.city.toUpperCase()}
                      </span>
                    ) : null}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. Inspiración */}
      {inspiracionImages.length > 0 && (
        <section className="home-section home-section--border">
          <div className="home-container">
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

            <div className="home-inspire__mosaic">
              {inspiracionImages.slice(0, 5).map((img, idx) => {
                const href = img.linkHref || inspiracion.instagramUrl || undefined;
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
                      sizes="(max-width: 768px) 50vw, 40vw"
                      style={{ objectFit: "cover" }}
                    />
                  </Tag>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 9. Pedido al por mayor (debajo del mosaico) */}
      <section className="home-section home-section--border">
        <div className="home-container">
          <div
            className={`home-personalize${
              porMayor.imageOnLeft !== false
                ? " home-personalize--image-left"
                : ""
            }${!porMayorImage ? " home-personalize--no-media" : ""}`}
          >
            <div className="home-personalize__content">
              <p className="home-eyebrow">
                {porMayor.eyebrow || "POR VOLUMEN"}
              </p>
              <h2 className="home-section__heading">
                {porMayor.title || "Pedidos al por mayor"}
              </h2>
              <p className="home-section__lead">
                {porMayor.body ||
                  "Para tiendas, eventos o distribución. Cotizamos según cantidades y referencias."}
              </p>
              {Array.isArray(porMayor.bullets) && porMayor.bullets.length > 0 && (
                <ul className="home-personalize__list">
                  {porMayor.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <div className="home-personalize__actions">
                <Link
                  href={porMayor.ctaHref || "/pedido-mayor"}
                  className="home-btn home-btn--primary home-btn--solid"
                >
                  {porMayor.ctaLabel || "Solicitar cotización"}
                </Link>
              </div>
            </div>
            {porMayorImage && (
              <div className="home-personalize__media">
                <div className="home-personalize__image-wrap">
                  <Image
                    src={porMayorImage}
                    alt={
                      homeImages.pormayor?.[0]?.altText ||
                      "Pedido al por mayor Dizor"
                    }
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 10. Newsletter */}
      <section className="home-newsletter">
        <div className="home-container home-newsletter__inner">
          <p className="home-eyebrow">
            {newsletterSection.eyebrow || "NOVEDADES"}
          </p>
          <h2 className="home-section__heading">
            {newsletterSection.title || "Entérate de las piezas nuevas"}
          </h2>
          <p className="home-section__lead">
            {newsletterSection.subtitle ||
              "Avisos puntuales de colecciones, personalización y el oficio detrás de cada trama."}
          </p>
          <NewsletterSignup
            title=""
            description=""
            source="home"
          />
        </div>
      </section>
    </>
  );
}
