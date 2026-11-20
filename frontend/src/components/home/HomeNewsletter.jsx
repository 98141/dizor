import dynamic from "next/dynamic";
import { getHomeContent } from "@/services/cmsService";

const NewsletterSignup = dynamic(
  () => import("@/components/marketing/NewsletterSignup"),
  { ssr: true }
);

/** Newsletter — cierre del inicio (Negro Dizor). Server shell + formulario cliente. */
export default async function HomeNewsletter() {
  const cmsData = await getHomeContent().catch(() => null);
  const newsletterSection = cmsData?.home?.newsletterSection || {};

  return (
    <section className="home-newsletter" aria-labelledby="home-newsletter-heading">
      <div className="home-container home-newsletter__inner">
        {newsletterSection.eyebrow ? (
          <p className="home-eyebrow">{newsletterSection.eyebrow}</p>
        ) : null}
        <h2
          id="home-newsletter-heading"
          className="home-section__heading home-section__heading--editorial"
        >
          {newsletterSection.title || "Entérate de las piezas nuevas"}
        </h2>
        <p className="home-section__lead">
          {newsletterSection.subtitle ||
            "Avisos puntuales de colecciones, personalización y el oficio detrás de cada trama."}
        </p>
        <NewsletterSignup title="" description="" source="home" compact />
      </div>
    </section>
  );
}
