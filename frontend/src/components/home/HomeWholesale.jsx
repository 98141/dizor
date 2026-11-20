import { getHomeContent } from "@/services/cmsService";
import HomeServiceCard from "./HomeServiceCard";

/** Pedidos al por mayor — composición dentro de «Hecho para ti» (HomeServices). */
export default async function HomeWholesale() {
  const cmsData = await getHomeContent().catch(() => null);
  const porMayor = cmsData?.home?.porMayor || {};
  const homeImages = cmsData?.homeImages || {};
  const porMayorImage =
    homeImages.pormayor?.[0]?.url || porMayor.imageUrl || "";

  return (
    <HomeServiceCard
      id="home-service-wholesale"
      variant="wholesale"
      eyebrow={porMayor.eyebrow}
      title={porMayor.title || "Pedidos al por mayor"}
      body={
        porMayor.body ||
        "Para tiendas, eventos o distribución. Cotizamos según cantidades y referencias."
      }
      bullets={porMayor.bullets}
      image={porMayorImage}
      imageAlt={homeImages.pormayor?.[0]?.altText || "Pedido al por mayor Dizor"}
      cta={{
        href: porMayor.ctaHref || "/pedido-mayor",
        label: porMayor.ctaLabel || "Solicitar cotización",
      }}
    />
  );
}
