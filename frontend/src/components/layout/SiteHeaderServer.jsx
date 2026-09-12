import SiteHeader from "@/components/layout/SiteHeader";
import {
  fetchCatalogFilters,
  getActiveCategories,
} from "@/lib/fetchCatalogFilters";

/** Carga categorías activas (misma fuente cacheada) para el header. */
export default async function SiteHeaderServer() {
  const filtersData = await fetchCatalogFilters();
  const categories = getActiveCategories(filtersData);
  return <SiteHeader categories={categories} />;
}
