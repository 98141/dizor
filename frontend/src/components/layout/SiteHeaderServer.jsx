import SiteHeader from "@/components/layout/SiteHeader";
import {
  fetchCatalogFilters,
  getActiveWeaveTypes,
} from "@/lib/fetchCatalogFilters";

/** Carga tejidos en el servidor y los pasa al header cliente. */
export default async function SiteHeaderServer() {
  const filtersData = await fetchCatalogFilters();
  const weaveTypes = getActiveWeaveTypes(filtersData);
  return <SiteHeader weaveTypes={weaveTypes} />;
}
