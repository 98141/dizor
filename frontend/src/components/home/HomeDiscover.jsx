import dynamic from "next/dynamic";
import ViewItemListTracker from "@/components/analytics/ViewItemListTracker";
import { getHomeContent } from "@/services/cmsService";
import { fetchDailyRandom } from "@/lib/homeFetches";
import Link from "next/link";
import HomeSectionIntro from "./HomeSectionIntro";

const DailyDiscoverGrid = dynamic(() => import("./DailyDiscoverGrid"), {
  ssr: true,
});

/**
 * Descubre hoy — única vitrina de descubrimiento del inicio (protagonista + 4).
 * Productos: GET /products/daily-random (selección diaria, America/Bogota).
 * Analítica: lista `home_daily` (view_item_list + select_item).
 * Absorbe la función visual de «También en el catálogo» (HomeExploreScroll,
 * lista `home_explore_scroll`), que ya no se renderiza pero se conserva.
 */
export default async function HomeDiscover() {
  const [cmsData, dailyData] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchDailyRandom(5),
  ]);

  const randomSection = cmsData?.home?.randomProductsSection || {};
  const dailyProducts = dailyData?.products || [];

  if (randomSection.isActive === false || dailyProducts.length === 0) {
    return null;
  }

  const listName = randomSection.title || "Descubre hoy";

  return (
    <section
      className="home-section home-section--discover"
      aria-labelledby="home-discover-heading"
    >
      <div className="home-container home-container--wide">
        <div className="home-discover">
          <div className="home-discover__lead">
            <HomeSectionIntro
              id="home-discover-heading"
              eyebrow={randomSection.eyebrow}
              title={listName}
              lead={randomSection.subtitle}
              tone="editorial"
            />
            <Link
              href={randomSection.linkHref || "/catalogo"}
              className="home-btn home-btn--arena"
            >
              {randomSection.linkLabel || "Ver más"}
            </Link>
          </div>
          <ViewItemListTracker
            products={dailyProducts}
            listId="home_daily"
            listName={listName}
          />
          <DailyDiscoverGrid
            products={dailyProducts}
            listId="home_daily"
            listName={listName}
          />
        </div>
      </div>
    </section>
  );
}
