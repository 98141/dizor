import dynamic from "next/dynamic";
import { getHomeContent } from "@/services/cmsService";

const NewsletterSignup = dynamic(
  () => import("@/components/marketing/NewsletterSignup"),
  { ssr: true }
);

/** Newsletter Home — Server shell + formulario cliente (dynamic). */
export default async function HomeNewsletter() {
  const cmsData = await getHomeContent().catch(() => null);
  const newsletterSection = cmsData?.home?.newsletterSection || {};

  return (
    <section className="home-newsletter">
      <div className="home-container home-newsletter__inner">
        <p className="home-eyebrow">
          {newsletterSection.eyebrow || "NOVEDADES"}
        </p>
        <h2 className="home-section__heading">
          {newsletterSection.title || "Entérate de las piezas nuevas"}
        </h2>
        <p className="home-section__lead">
          {newsletterSection.subtitle ||
            "Avisos puntuales de colecciones, personalización y el oficio detrás de cada trama."}
        </p>
        <NewsletterSignup title="" description="" source="home" />
      </div>
    </section>
  );
}
