import { getHomeContent } from "@/services/cmsService";
import {
  fetchCatalogFilters,
  getActiveWeaveTypes,
} from "@/lib/fetchCatalogFilters";
import { fetchDailyRandom } from "@/lib/homeFetches";
import {
  buildWeaveCards,
  matchColeccionImagesForWeave,
  weaveIdOf,
} from "@/lib/coleccionImages";
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
  const dailyWeaves = Array.isArray(dailyData?.weaveTypes)
    ? dailyData.weaveTypes
    : [];

  // Tejidos con foto de colección primero (respetando el sorteo diario): un
  // tejido recién creado sin foto no debe dejar una tarjeta vacía en el home.
  const seen = new Set();
  const candidates = [...dailyWeaves, ...craftTypes].filter((wt) => {
    const id = weaveIdOf(wt);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const withImage = candidates.filter(
    (wt) => matchColeccionImagesForWeave(wt, coleccionImages).length > 0
  );
  const pool = [
    ...withImage,
    ...candidates.filter((wt) => !withImage.includes(wt)),
  ];
  const weaveCards = buildWeaveCards(pool.slice(0, 3), coleccionImages);

  return <HomeCraftSection craftSection={craftSection} cards={weaveCards} />;
}
