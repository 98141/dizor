import PromoBanner from "./PromoBanner";

// El banner ya llega resuelto desde el Server Component (catalogo/page.js);
// antes este componente hacía su propio fetch en un useEffect al montar.
export default function CatalogPromo({ banner }) {
  if (!banner) return null;
  return <PromoBanner banner={banner} />;
}
