import { DelayedCatalogLoading } from "@/components/catalog/CatalogLoadingOverlay";

/** Espera de la entrada al catálogo. No se usa en el resto de la tienda. */
export default function CatalogoLoading() {
  return <DelayedCatalogLoading active />;
}
