import { Suspense } from "react";
import HomeHero from "@/components/home/HomeHero";
import HomeBenefits from "@/components/home/HomeBenefits";
import HomeNewArrivals from "@/components/home/HomeNewArrivals";
import HomeCraftBlock from "@/components/home/HomeCraftBlock";
import HomeStory from "@/components/home/HomeStory";
import HomeDiscover from "@/components/home/HomeDiscover";
import HomePersonalization from "@/components/home/HomePersonalization";
import HomeReviews from "@/components/home/HomeReviews";
import HomeInspiration from "@/components/home/HomeInspiration";
import HomeWholesale from "@/components/home/HomeWholesale";
import HomeNewsletter from "@/components/home/HomeNewsletter";
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
 * Home — P0 (Hero + Benefits) resuelto antes de stream;
 * secciones inferiores en Suspense independientes (SSR + streaming).
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
      <Suspense fallback={<HomeSectionFallback minHeight={500} />}>
        <HomeNewArrivals />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={520} />}>
        <HomeCraftBlock />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={440} />}>
        <HomeStory />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={520} />}>
        <HomeDiscover />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={460} />}>
        <HomePersonalization />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={240} />}>
        <HomeReviews />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={440} />}>
        <HomeInspiration />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={460} />}>
        <HomeWholesale />
      </Suspense>

      <Suspense fallback={<HomeSectionFallback minHeight={260} />}>
        <HomeNewsletter />
      </Suspense>
    </>
  );
}
