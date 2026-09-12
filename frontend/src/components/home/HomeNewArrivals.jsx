import Link from "next/link";
import dynamic from "next/dynamic";
import ViewItemListTracker from "@/components/analytics/ViewItemListTracker";
import { getHomeContent } from "@/services/cmsService";
import { fetchNewProducts } from "@/lib/homeFetches";

const ProductCarousel = dynamic(() => import("./ProductCarousel"), {
  ssr: true,
});

/** Novedades — Server Component; island cliente del carrusel vía dynamic. */
export default async function HomeNewArrivals() {
  const [cmsData, newProductsData] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchNewProducts(12),
  ]);

  const newSection = cmsData?.home?.newSection || {};
  const newProducts = newProductsData?.products || [];

  if (newSection.isActive === false || newProducts.length === 0) return null;

  return (
    <section className="home-section home-section--border">
      <div className="home-container">
        <header className="home-section__intro">
          <p className="home-eyebrow">{newSection.eyebrow || "LO NUEVO"}</p>
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
  );
}
