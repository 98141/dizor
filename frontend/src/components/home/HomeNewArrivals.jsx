import dynamic from "next/dynamic";
import ViewItemListTracker from "@/components/analytics/ViewItemListTracker";
import { getHomeContent } from "@/services/cmsService";
import { fetchNewProducts } from "@/lib/homeFetches";
import HomeSectionIntro from "./HomeSectionIntro";

const ProductCarousel = dynamic(() => import("./ProductCarousel"), {
  ssr: true,
});

/** Productos consultados para la vitrina (el resto, en «Ver novedades»). */
const NEW_ARRIVALS_LIMIT = 8;

/** Novedades — Server Component; island cliente del carrusel vía dynamic. */
export default async function HomeNewArrivals() {
  const [cmsData, newProductsData] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchNewProducts(NEW_ARRIVALS_LIMIT),
  ]);

  const newSection = cmsData?.home?.newSection || {};
  const newProducts = (newProductsData?.products || []).slice(0, NEW_ARRIVALS_LIMIT);
  const subtitle = (newSection.subtitle || "").trim();
  const subtitleRepiteElTitulo =
    subtitle ===
    "Las piezas recién marcadas como nuevas en nuestro catálogo.";

  if (newSection.isActive === false || newProducts.length === 0) return null;

  const showLink = Boolean(newSection.linkLabel || newSection.linkHref);

  return (
    <section
      className="home-section home-section--arrivals"
      aria-labelledby="home-arrivals-heading"
    >
      <div className="home-container">
        <HomeSectionIntro
          id="home-arrivals-heading"
          eyebrow={newSection.eyebrow}
          title={newSection.title || "Novedades"}
          lead={subtitle && !subtitleRepiteElTitulo ? subtitle : ""}
          action={
            showLink
              ? {
                  href: newSection.linkHref || "/catalogo?isNew=true",
                  label: newSection.linkLabel || "Ver novedades",
                }
              : null
          }
        />
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
      </div>
    </section>
  );
}
