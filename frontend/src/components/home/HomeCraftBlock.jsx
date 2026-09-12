import { getHomeContent } from "@/services/cmsService";
import {
  fetchCatalogFilters,
  getActiveWeaveTypes,
} from "@/lib/fetchCatalogFilters";
import { fetchDailyRandom } from "@/lib/homeFetches";
import { buildWeaveCards } from "@/lib/coleccionImages";
import HomeCraftSection from "./HomeCraftSection";

/**
 * Nuestros tejidos — Server Component.
 * Conserva sample diario de tejidos (Fase 1/estado actual) + matching CMS.
 */
export default async function HomeCraftBlock() {
  const [cmsData, dailyData, filtersData] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchDailyRandom(5),
    fetchCatalogFilters(),
  ]);

  const craftSection = cmsData?.home?.craftSection || {};
  const coleccionImages = (cmsData?.homeImages?.coleccion || []).filter(
    (img) => img?.url
  );
  const craftTypes = getActiveWeaveTypes(filtersData);
  const dailyWeaves =
    Array.isArray(dailyData?.weaveTypes) && dailyData.weaveTypes.length > 0
      ? dailyData.weaveTypes.slice(0, 3)
      : craftTypes.slice(0, 3);
  const weaveCards = buildWeaveCards(dailyWeaves, coleccionImages);

  return <HomeCraftSection craftSection={craftSection} cards={weaveCards} />;
}
