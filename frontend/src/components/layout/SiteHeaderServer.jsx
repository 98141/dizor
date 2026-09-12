import SiteHeader from "@/components/layout/SiteHeader";
import {
  fetchCatalogFilters,
  getActiveCategories,
  getActiveWeaveTypes,
} from "@/lib/fetchCatalogFilters";

/** Carga categorías + tejidos (misma fuente cacheada) para el header. */
export default async function SiteHeaderServer() {
  const filtersData = await fetchCatalogFilters();
  const categories = getActiveCategories(filtersData);
  const weaveTypes = getActiveWeaveTypes(filtersData);
  return <SiteHeader categories={categories} weaveTypes={weaveTypes} />;
}
