import Link from "next/link";
import Image from "next/image";

export default function PromoBanner({ banner }) {
  if (!banner) return null;

  return (
    <section className="promo-banner">
      {banner.imageUrl && (
        <>
          <Image
            src={banner.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            style={{ objectFit: "cover" }}
            className="promo-banner__bg-image"
          />
          <div className="promo-banner__overlay" aria-hidden="true" />
        </>
      )}
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
