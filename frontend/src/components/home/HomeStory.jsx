import Link from "next/link";
import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";

/** Historia / origen — bloque editorial fuerte. */
export default async function HomeStory() {
  const cmsData = await getHomeContent().catch(() => null);
  const historia = cmsData?.home?.historia || {};
  const homeImages = cmsData?.homeImages || {};
  const historiaImages = (homeImages.historia || []).filter((img) => img?.url);
  const primary = historiaImages[0];
  const historiaImage = primary?.url || historia.imageUrl || "";
  const hasImage = Boolean(historiaImage);

  return (
    <section className="home-section home-section--story">
      <div className="home-container home-container--wide">
        <div
          className={`home-story${hasImage ? " home-story--with-image" : ""}`}
        >
          {hasImage ? (
            <div className="home-story__media">
              <div className="home-story__image-wrap">
                <Image
                  src={historiaImage}
                  alt={primary?.altText || "Historia Dizor"}
                  fill
                  sizes="(max-width: 899px) 100vw, 55vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          ) : null}
          <div className="home-story__content">
            <p className="home-eyebrow">{historia.eyebrow || "ORIGEN"}</p>
            <h2 className="home-section__heading">
              {historia.title || "Del oficio a tu cotidianidad"}
            </h2>
            <p className="home-story__body">
              {historia.body ||
                "Desde las manos de las artesanas de Sandoná nace cada sombrero Dizor."}
            </p>
            {historia.ctaLabel ? (
              <Link
                href={historia.ctaHref || "/pagina/sobre-dizor"}
                className="home-text-link"
              >
                {historia.ctaLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
