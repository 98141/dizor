import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/products/ProductCard";
import PromoBanner from "@/components/cms/PromoBanner";
import NewsletterSignup from "@/components/marketing/NewsletterSignup";
import { getHomeContent } from "@/services/cmsService";
import { fetchAppearance, getSiteName } from "@/lib/fetchAppearance";

const HOME_TITLE = "Sombreros artesanales de Sandoná";
const HOME_DESCRIPTION =
  "Sombreros artesanales en palma de iraca de Sandoná, Nariño. Tejidos Brisa, Común y Súper fino. Envíos a todo Colombia.";
// Sin imagen de marketing dedicada (1200x630) en el repo: se reutiliza el
// ícono real del sitio para que OpenGraph/Twitter nunca queden sin imagen.
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

async function fetchFeatured() {
  try {
    const res = await fetch(`${BASE}/products/featured?limit=8`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}

async function fetchNewProducts() {
  try {
    const res = await fetch(`${BASE}/products?isNew=true&limit=8`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}

async function fetchBestsellers() {
  try {
    const res = await fetch(`${BASE}/products?sort=popular&limit=8`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}

async function fetchCraftTypes() {
  try {
    const res = await fetch(`${BASE}/products/filters`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.filters?.weaveTypes || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [cmsData, featured, newProducts, bestsellers, craftTypes, appearance] =
    await Promise.all([
      getHomeContent().catch(() => null),
      fetchFeatured(),
      fetchNewProducts(),
      fetchBestsellers(),
      fetchCraftTypes(),
      fetchAppearance(),
    ]);

  const siteName = getSiteName(appearance);

  const home = cmsData?.home;
  const hero = home?.hero;
  const features = home?.features?.length ? home.features : [];
  const featuredSection = home?.featuredSection;
  const newSection = home?.newSection;
  const craftSection = home?.craftSection;
  const historia = home?.historia;
  const bestsellerSection = home?.bestsellerSection;
  const midBanner = cmsData?.banners?.[0];

  const heroStyle = hero?.imageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${hero.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

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
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Inicio",
          item:
            process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co",
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />
      {/* ─── HERO ─── */}
      <section className="home-hero" style={heroStyle}>
        <div className="home-hero__inner">
          <h1 className="home-hero__title">
            {hero?.title || "Sombreros artesanales de Sandoná"}
          </h1>
          <p className="home-hero__text">
            {hero?.subtitle ||
              "Palma de iraca tejida a mano en Nariño, Colombia. Tradición, elegancia y calidad en cada pieza."}
          </p>
          <Link href={hero?.ctaHref || "/catalogo"} className="home-hero__cta">
            {hero?.ctaLabel || "Ver catálogo"}
          </Link>
        </div>
      </section>

      {/* ─── BANNER PROMOCIONAL ─── */}
      {midBanner && <PromoBanner banner={midBanner} />}

      {/* ─── NOVEDADES ─── */}
      {newSection?.isActive !== false && newProducts.length > 0 && (
        <section className="home-section">
          <div className="home-section__header">
            <h2 className="home-section__title">
              {newSection?.title || "Novedades"}
            </h2>
            <Link
              href={newSection?.linkHref || "/catalogo?isNew=true"}
              className="home-section__link"
            >
              {newSection?.linkLabel || "Ver novedades"}
            </Link>
          </div>
          <div className="products-grid">
            {newProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ─── DESTACADOS ─── */}
      <section className="home-section">
        <div className="home-section__header">
          <h2 className="home-section__title">
            {featuredSection?.title || "Destacados"}
          </h2>
          <Link
            href={featuredSection?.linkHref || "/catalogo?featured=true"}
            className="home-section__link"
          >
            {featuredSection?.linkLabel || "Ver todos"}
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="products-grid">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="catalog-empty">
            Pronto tendremos productos destacados.{" "}
            <Link href="/catalogo">Explorar catálogo</Link>
          </p>
        )}
      </section>

      {/* ─── TIPOS DE TEJIDO ─── */}
      {craftTypes.length > 0 && (
        <section className="home-craft">
          <div className="home-craft__header">
            <h2 className="home-craft__title">
              {craftSection?.title || "Nuestros tejidos"}
            </h2>
            {(craftSection?.subtitle || !craftSection) && (
              <p className="home-craft__subtitle">
                {craftSection?.subtitle ||
                  "Cada tipo de tejido tiene su propio carácter, finura y tiempo de elaboración."}
              </p>
            )}
          </div>
          <div className="home-craft__grid">
            {craftTypes.map((wt, idx) => (
              <Link
                key={wt._id}
                href={`/catalogo?weaveType=${wt._id}`}
                className={`home-craft-card home-craft-card--${(idx % 3) + 1}`}
              >
                <span className="home-craft-card__name">{wt.name}</span>
                {wt.description && (
                  <span className="home-craft-card__desc">
                    {wt.description}
                  </span>
                )}
                <span className="home-craft-card__cta">
                  {craftSection?.linkLabel || "Explorar"} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── HISTORIA DE DIZOR ─── */}
      {(historia?.title || historia?.body) && (
        <section
          className={`home-story${historia?.imageUrl ? " home-story--with-image" : ""}`}
        >
          <div className="home-story__inner">
            {historia?.imageUrl && (
              <div className="home-story__image-wrap">
                <Image
                  src={historia.imageUrl}
                  alt="Historia Dizor"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            )}
            <div className="home-story__content">
              <h2 className="home-story__title">
                {historia?.title || "Nuestra historia"}
              </h2>
              <p className="home-story__body">
                {historia?.body ||
                  "Desde las manos de las artesanas de Sandoná, Nariño, nace cada sombrero Dizor."}
              </p>
              {historia?.ctaLabel && historia?.ctaHref && (
                <Link href={historia.ctaHref} className="home-story__cta">
                  {historia.ctaLabel}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MÁS VENDIDOS
          Activar cuando el catálogo tenga historial de ventas suficiente.
          Pasos para activar:
            1. Ir al admin → CMS → Inicio
            2. Cambiar "bestsellerSection.isActive" a true
            La sección se mostrará automáticamente cuando haya productos
            con salesCount > 0. Si no hay ventas aún, no aparece aunque
            isActive esté en true (bestsellers.length === 0).
          ═══════════════════════════════════════════════════════════════ */}
      {bestsellerSection?.isActive && bestsellers.length > 0 && (
        <section className="home-section">
          <div className="home-section__header">
            <h2 className="home-section__title">
              {bestsellerSection?.title || "Más vendidos"}
            </h2>
            <Link
              href={bestsellerSection?.linkHref || "/catalogo?sort=popular"}
              className="home-section__link"
            >
              {bestsellerSection?.linkLabel || "Ver todos"}
            </Link>
          </div>
          <div className="products-grid">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ─── CARACTERÍSTICAS / PROPUESTA DE VALOR ─── */}
      {features.length > 0 && (
        <section className="home-section">
          <div className="home-features">
            {features.map((feature) => (
              <div key={feature.title} className="home-feature">
                <h3 className="home-feature__title">{feature.title}</h3>
                <p className="home-feature__text">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── NEWSLETTER ─── */}
      <section className="home-newsletter">
        <div className="home-newsletter__inner">
          <NewsletterSignup
            title="Únete a la comunidad Dizor"
            description="Recibe primero los nuevos lanzamientos, ofertas exclusivas e historias de nuestros artesanos."
            source="home"
          />
        </div>
      </section>
    </>
  );
}
