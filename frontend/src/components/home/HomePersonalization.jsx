import { getHomeContent } from "@/services/cmsService";
import HomeServiceCard from "./HomeServiceCard";

/** Personalización — composición dentro de «Hecho para ti» (HomeServices). */
export default async function HomePersonalization() {
  const cmsData = await getHomeContent().catch(() => null);
  const personalizacion = cmsData?.home?.personalizacion || {};
  const homeImages = cmsData?.homeImages || {};
  const personalizacionImage =
    homeImages.personalizacion?.[0]?.url || personalizacion.imageUrl || "";

  return (
    <HomeServiceCard
      id="home-service-personalize"
      variant="personalize"
      eyebrow={personalizacion.eyebrow}
      title={personalizacion.title || "Personaliza tu sombrero"}
      body={
        personalizacion.body ||
        "Iniciales, monogramas y detalles que hacen única tu pieza."
      }
      bullets={personalizacion.bullets}
      image={personalizacionImage}
      imageAlt={homeImages.personalizacion?.[0]?.altText || "Personalización Dizor"}
      cta={{
        href: personalizacion.ctaHref || "/personalizar",
        label: personalizacion.ctaLabel || "Personalizar",
      }}
    />
  );
}
