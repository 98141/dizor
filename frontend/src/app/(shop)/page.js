import { Suspense } from "react";
import HomeHero from "@/components/home/HomeHero";
import HomeBenefits from "@/components/home/HomeBenefits";
import HomeNewArrivals from "@/components/home/HomeNewArrivals";
import HomeCraftBlock from "@/components/home/HomeCraftBlock";
import HomeStory from "@/components/home/HomeStory";
import HomeDiscover from "@/components/home/HomeDiscover";
import HomeReviews from "@/components/home/HomeReviews";
import HomeInspiration from "@/components/home/HomeInspiration";
import HomeServices from "@/components/home/HomeServices";
import HomeNewsletter from "@/components/home/HomeNewsletter";
import HomeEditorialBreak from "@/components/home/HomeEditorialBreak";
import HomeSectionFallback from "@/components/home/HomeSectionFallback";
import { getHomeContent } from "@/services/cmsService";
import { fetchAppearance, getSiteName } from "@/lib/fetchAppearance";
import "@/styles/pages/home.css";

const HOME_TITLE = "Sombreros artesanales de Sandoná";
const HOME_DESCRIPTION =
  "Sombreros artesanales en palma de iraca de Sandoná, Nariño. Tejidos Brisa, Común y Súper fino. Envíos a todo Colombia.";
const DEFAULT_OG_IMAGE = "/icon-512.png";

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  keywords: [
    "sombreros artesanales Colombia",
    "sombrero palma de iraca",
    "sombreros Sandoná",
    "artesanías Nariño",
    "sombreros tejidos a mano",
  ],
  openGraph: {
    title: HOME_TITLE,
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño. Tejidos Brisa, Común y Súper fino.",
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: HOME_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  alternates: {
    canonical: "/",
  },
};

/**
 * Home — P0 (Hero + Beneficios) resuelto antes de stream;
 * secciones inferiores en Suspense independientes (SSR + streaming).
 *
 * Orden (Atelier artesanal premium):
 *  1 Hero · 2 Beneficios · 3 Nuestros tejidos · 4 Novedades · 5 Historia ·
 *  6 Descubre hoy · 7 Pausa editorial · 8 La pieza en la vida real ·
 *  9 Reseñas · 10 Hecho para ti (Personalización + Por mayor) · 11 Newsletter
 *
 * «También en el catálogo» (HomeExploreScroll, lista de analítica
 * `home_explore_scroll`, GET /products/random-sample) ya no se renderiza:
 * «Descubre hoy» asume su función. El componente y el fetch se conservan
 * sin cambios hasta confirmar la migración de métricas.
 *
 * Alturas de reserva = alto medido de cada sección a 390 px (la vista más
 * alta) para limitar saltos mientras llega cada sección.
 */
export default async function HomePage() {
  const [cmsData, appearance] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchAppearance(),
  ]);

  const siteName = getSiteName(appearance);
  const home = cmsData?.home || {};
  const homeImages = cmsData?.homeImages || {};
  const hero = home.hero || {};
  const features = home.features?.length ? home.features : [];
  const heroImages = (homeImages.hero || []).filter((img) => img?.url);
  const heroFallbackUrl = hero.imageUrl || "";

  const homePageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"}/#homepage`,
    name: `${siteName} | Sombreros artesanales de Sandoná`,
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co",
    isPartOf: {
      "@id": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"}/#website`,
    },
    about: {
      "@id": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"}/#organization`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />

      {/* P0 — above the fold */}
      <HomeHero
        hero={hero}
        images={heroImages}
        siteName={siteName}
        fallbackImageUrl={heroFallbackUrl}
      />

      {/* P1 — inmediatamente bajo el Hero (mismo CMS, sin fetch extra) */}
      <HomeBenefits features={features} />

      {/* P2 — below the fold: streaming por sección */}
      <Suspense fallback={<HomeSectionFallback minHeight={820} />}>
        <HomeCraftBlock />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={530} />}>
        <HomeNewArrivals />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={800} />}>
        <HomeStory />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={1320} />}>
        <HomeDiscover />
      </Suspense>

      {/* Pausa editorial única (editorial1 → editorial2); null si no hay fotos */}
      <Suspense fallback={null}>
        <HomeEditorialBreak />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={1100} />}>
        <HomeInspiration />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={840} />}>
        <HomeReviews />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={1550} />}>
        <HomeServices />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={480} />}>
        <HomeNewsletter />
      </Suspense>
    </>
  );
}
