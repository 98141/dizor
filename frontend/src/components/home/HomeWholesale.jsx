import Link from "next/link";
import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";

/** Pedidos al por mayor — Server Component (reutiliza layout personalize). */
export default async function HomeWholesale() {
  const cmsData = await getHomeContent().catch(() => null);
  const porMayor = cmsData?.home?.porMayor || {};
  const homeImages = cmsData?.homeImages || {};
  const porMayorImage =
    homeImages.pormayor?.[0]?.url || porMayor.imageUrl || "";

  return (
    <section className="home-section home-section--border">
      <div className="home-container">
        <div
          className={`home-personalize${
            porMayor.imageOnLeft !== false
              ? " home-personalize--image-left"
              : ""
          }${!porMayorImage ? " home-personalize--no-media" : ""}`}
        >
          <div className="home-personalize__content">
            <p className="home-eyebrow">{porMayor.eyebrow || "POR VOLUMEN"}</p>
            <h2 className="home-section__heading">
              {porMayor.title || "Pedidos al por mayor"}
            </h2>
            <p className="home-section__lead">
              {porMayor.body ||
                "Para tiendas, eventos o distribución. Cotizamos según cantidades y referencias."}
            </p>
            {Array.isArray(porMayor.bullets) && porMayor.bullets.length > 0 && (
              <ul className="home-personalize__list">
                {porMayor.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <div className="home-personalize__actions">
              <Link
                href={porMayor.ctaHref || "/pedido-mayor"}
                className="home-btn home-btn--primary home-btn--solid"
              >
                {porMayor.ctaLabel || "Solicitar cotización"}
              </Link>
            </div>
          </div>
          {porMayorImage && (
            <div className="home-personalize__media">
              <div className="home-personalize__image-wrap">
                <Image
                  src={porMayorImage}
                  alt={
                    homeImages.pormayor?.[0]?.altText ||
                    "Pedido al por mayor Dizor"
                  }
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
