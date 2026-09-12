import Link from "next/link";
import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";

/** Historia / origen — Server Component. */
export default async function HomeStory() {
  const cmsData = await getHomeContent().catch(() => null);
  const historia = cmsData?.home?.historia || {};
  const homeImages = cmsData?.homeImages || {};
  const historiaImage =
    homeImages.historia?.[0]?.url || historia.imageUrl || "";

  return (
    <section className="home-section home-section--story">
      <div className="home-container">
        <div
          className={`home-story${historiaImage ? " home-story--with-image" : ""}`}
        >
          {historiaImage && (
            <div className="home-story__media">
              <div className="home-story__image-wrap">
                <Image
                  src={historiaImage}
                  alt={homeImages.historia?.[0]?.altText || "Historia Dizor"}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          )}
          <div className="home-story__content">
            <p className="home-eyebrow">{historia.eyebrow || "ORIGEN"}</p>
            <h2 className="home-section__heading">
              {historia.title || "Del oficio a tu cotidianidad"}
            </h2>
            <p className="home-story__body">
              {historia.body ||
                "Desde las manos de las artesanas de Sandoná nace cada sombrero Dizor."}
            </p>
            {historia.ctaLabel && (
              <Link
                href={historia.ctaHref || "/pagina/sobre-dizor"}
                className="home-text-link"
              >
                {historia.ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
