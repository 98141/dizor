import Link from "next/link";
import ProductCard from "@/components/products/ProductCard";

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
  const featured = await getFeatured();

  return (
    <>
      <section className="home-hero">
        <div className="home-hero__inner">
          <h1 className="home-hero__title">
            Sombreros artesanales de Sandoná
          </h1>
          <p className="home-hero__text">
            Palma de iraca tejida a mano en Nariño, Colombia. Tradición,
            elegancia y calidad en cada pieza.
          </p>
          <Link href="/catalogo" className="home-hero__cta">
            Ver catálogo
          </Link>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section__header">
          <h2 className="home-section__title">Destacados</h2>
          <Link href="/catalogo?featured=true" className="home-section__link">
            Ver todos
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

      <section className="home-section">
        <div className="home-features">
          <div className="home-feature">
            <h3 className="home-feature__title">Tejido artesanal</h3>
            <p className="home-feature__text">
              Brisa, Común y Súper fino — tipos de tejido para cada ocasión.
            </p>
          </div>
          <div className="home-feature">
            <h3 className="home-feature__title">Hormas clásicas</h3>
            <p className="home-feature__text">
              Indiana, Safari, Panamá Hats y más estilos icónicos.
            </p>
          </div>
          <div className="home-feature">
            <h3 className="home-feature__title">Envíos en Colombia</h3>
            <p className="home-feature__text">
              Interrapidísimo, Envía y Coordinadora. Pagos en COP.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
