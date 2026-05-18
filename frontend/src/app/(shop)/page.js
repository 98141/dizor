import Link from "next/link";
import ProductCard from "@/components/products/ProductCard";
import PromoBanner from "@/components/cms/PromoBanner";
import { getHomeContent } from "@/services/cmsService";

async function getFeatured() {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${base}/products/featured?limit=8`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [cmsData, featured] = await Promise.all([
    getHomeContent().catch(() => null),
    getFeatured(),
  ]);

  const home = cmsData?.home;
  const hero = home?.hero;
  const features = home?.features?.length ? home.features : [];
  const featuredSection = home?.featuredSection;
  const midBanner = cmsData?.banners?.[0];

  const heroStyle =
    hero?.imageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${hero.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;

  return (
    <>
      <section className="home-hero" style={heroStyle}>
        <div className="home-hero__inner">
          <h1 className="home-hero__title">
            {hero?.title || "Sombreros artesanales de Sandoná"}
          </h1>
          <p className="home-hero__text">
            {hero?.subtitle ||
              "Palma de iraca tejida a mano en Nariño, Colombia."}
          </p>
          <Link
            href={hero?.ctaHref || "/catalogo"}
            className="home-hero__cta"
          >
            {hero?.ctaLabel || "Ver catálogo"}
          </Link>
        </div>
      </section>

      {midBanner && <PromoBanner banner={midBanner} />}

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
    </>
  );
}
