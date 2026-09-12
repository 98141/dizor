import Link from "next/link";
import dynamic from "next/dynamic";
import ViewItemListTracker from "@/components/analytics/ViewItemListTracker";
import { getHomeContent } from "@/services/cmsService";
import { fetchDailyRandom } from "@/lib/homeFetches";

const DailyDiscoverGrid = dynamic(() => import("./DailyDiscoverGrid"), {
  ssr: true,
});

/** Descubre hoy — Server Component; grid cliente vía dynamic. */
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
    <section className="home-section home-section--discover">
      <div className="home-container">
        <div className="home-discover__header">
          <header className="home-section__intro">
            <p className="home-eyebrow">
              {randomSection.eyebrow || "CURADURÍA"}
            </p>
            <h2 className="home-section__heading">{listName}</h2>
            {randomSection.subtitle ? (
              <p className="home-section__lead">{randomSection.subtitle}</p>
            ) : null}
          </header>
          <Link
            href={randomSection.linkHref || "/catalogo"}
            className="home-discover__more"
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
    </section>
  );
}
