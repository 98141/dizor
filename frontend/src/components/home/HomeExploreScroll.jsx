import Link from "next/link";
import dynamic from "next/dynamic";
import ViewItemListTracker from "@/components/analytics/ViewItemListTracker";
import { fetchDailyExplore } from "@/lib/homeFetches";

const ProductCarousel = dynamic(() => import("./ProductCarousel"), {
  ssr: true,
});

/**
 * Descubre hoy (carrusel) — hasta 10 productos sin nuevo/destacado.
 * Selección del día (America/Bogota); si hay ≤10 elegibles, salen todos.
 */
export default async function HomeExploreScroll() {
  const sampleData = await fetchDailyExplore(10);
  const products = sampleData?.products || [];

  if (products.length === 0) return null;

  const listName = "Descubre hoy";

  return (
    <section className="home-section home-section--explore-scroll home-section--border">
      <div className="home-container">
        <header className="home-section__intro home-section__intro--compact">
          <p className="home-eyebrow">CATÁLOGO</p>
          <h2 className="home-section__heading">{listName}</h2>
          <p className="home-section__lead">
            Una muestra del catálogo que se renueva cada día a medianoche.
          </p>
        </header>
        <ViewItemListTracker
          products={products}
          listId="home_explore_scroll"
          listName={listName}
        />
        <ProductCarousel
          products={products}
          listId="home_explore_scroll"
          listName={listName}
        />
        <p className="home-section__more">
          <Link href="/catalogo" className="home-text-link">
            Ver catálogo
          </Link>
        </p>
      </div>
    </section>
  );
}
