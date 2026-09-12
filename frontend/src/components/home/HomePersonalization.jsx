import Link from "next/link";
import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";
import { getWhatsAppUrl } from "@/lib/whatsapp";

/** Personalización — Server Component. */
export default async function HomePersonalization() {
  const cmsData = await getHomeContent().catch(() => null);
  const personalizacion = cmsData?.home?.personalizacion || {};
  const homeImages = cmsData?.homeImages || {};
  const personalizacionImage =
    homeImages.personalizacion?.[0]?.url || personalizacion.imageUrl || "";
  const waPersonalizar = getWhatsAppUrl(
    "Hola Dizor, quiero personalizar un sombrero."
  );

  return (
    <section className="home-section home-section--border">
      <div className="home-container">
        <div
          className={`home-personalize${
            personalizacion.imageOnLeft !== false
              ? " home-personalize--image-left"
              : ""
          }${!personalizacionImage ? " home-personalize--no-media" : ""}`}
        >
          <div className="home-personalize__content">
            <p className="home-eyebrow">
              {personalizacion.eyebrow || "A TU MEDIDA"}
            </p>
            <h2 className="home-section__heading">
              {personalizacion.title || "Personaliza tu sombrero"}
            </h2>
            <p className="home-section__lead">
              {personalizacion.body ||
                "Iniciales, monogramas y detalles que hacen única tu pieza."}
            </p>
            {Array.isArray(personalizacion.bullets) &&
              personalizacion.bullets.length > 0 && (
                <ul className="home-personalize__list">
                  {personalizacion.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            <div className="home-personalize__actions">
              <Link
                href={personalizacion.ctaHref || "/personalizar"}
                className="home-btn home-btn--primary home-btn--solid"
              >
                {personalizacion.ctaLabel || "Personalizar"}
              </Link>
              <a
                href={waPersonalizar}
                target="_blank"
                rel="noopener noreferrer"
                className="home-personalize__wa-hint"
              >
                {personalizacion.whatsappHint ||
                  "También puedes escribirnos por WhatsApp"}
              </a>
            </div>
          </div>
          {personalizacionImage && (
            <div className="home-personalize__media">
              <div className="home-personalize__image-wrap">
                <Image
                  src={personalizacionImage}
                  alt={
                    homeImages.personalizacion?.[0]?.altText ||
                    "Personalización Dizor"
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
