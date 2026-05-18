import Link from "next/link";
import Image from "next/image";

export default function PromoBanner({ banner }) {
  if (!banner) return null;

  const style = banner.imageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${banner.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <section className="promo-banner" style={style}>
      <div className="promo-banner__inner">
        <h2 className="promo-banner__title">{banner.title}</h2>
        {banner.subtitle && (
          <p className="promo-banner__subtitle">{banner.subtitle}</p>
        )}
        <Link href={banner.linkHref || "/catalogo"} className="promo-banner__cta">
          {banner.ctaLabel || "Ver más"}
        </Link>
      </div>
    </section>
  );
}
