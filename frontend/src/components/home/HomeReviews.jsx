import Link from "next/link";
import { getHomeContent } from "@/services/cmsService";
import { fetchHomeReviews } from "@/lib/homeFetches";

function Stars({ rating = 5 }) {
  const n = Math.max(1, Math.min(5, Number(rating) || 5));
  return (
    <span className="home-voices__stars" role="img" aria-label={`${n} de 5 estrellas`}>
      <span aria-hidden="true">{"★".repeat(n)}</span>
      <span className="home-voices__stars-empty" aria-hidden="true">
        {"★".repeat(5 - n)}
      </span>
    </span>
  );
}

/**
 * Destacada = la reseña de cliente (no de la tienda) más extensa; con una
 * sola reseña, esa misma. Solo reseñas reales aprobadas (GET /reviews).
 */
function pickFeatured(reviews) {
  if (reviews.length < 2) return 0;
  let best = -1;
  reviews.forEach((r, i) => {
    if (r.isBrandReview) return;
    if (best < 0 || (r.comment || "").length > (reviews[best].comment || "").length) {
      best = i;
    }
  });
  return best;
}

function ReviewCard({ review, featured = false }) {
  const product = review.product?.slug ? review.product : null;
  return (
    <blockquote className={`home-voice${featured ? " home-voice--featured" : ""}`}>
      {featured ? null : <Stars rating={review.rating} />}
      <p className="home-voice__quote">{review.comment}</p>
      <footer className="home-voice__author">
        <strong>{review.authorName}</strong>
        {review.isBrandReview ? (
          <span className="review-brand-label">Publicada por la tienda</span>
        ) : null}
        {review.city ? <span className="home-voice__city">{review.city}</span> : null}
        {product ? (
          <Link
            href={`/producto/${encodeURIComponent(product.slug)}#pdp-reviews-title`}
            className="home-voice__product"
            aria-label={`Ver opiniones de ${product.name}`}
          >
            {product.name}
          </Link>
        ) : null}
      </footer>
    </blockquote>
  );
}

/** Voces / reseñas del inicio (no confundir con las de la PDP). */
export default async function HomeReviews() {
  const [cmsData, reviewsData] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchHomeReviews(4),
  ]);

  const reseñasSection = cmsData?.home?.reseñasSection || {};
  const reviews = (reviewsData?.reviews || []).slice(0, 4);

  if (reseñasSection.isActive === false || reviews.length === 0) return null;

  const featuredIndex = pickFeatured(reviews);
  const featured = featuredIndex >= 0 ? reviews[featuredIndex] : null;
  const rest = reviews.filter((_, i) => i !== featuredIndex);

  return (
    <section
      className={`home-section home-section--voices${
        rest.length === 0 ? " home-section--voices-single" : ""
      }`}
      aria-labelledby="home-voices-heading"
    >
      <div className="home-container home-container--wide">
        <div className="home-voices-stage">
          <header className="home-voices-stage__intro">
            {reseñasSection.eyebrow ? (
              <p className="home-eyebrow">{reseñasSection.eyebrow}</p>
            ) : null}
            <h2
              id="home-voices-heading"
              className="home-section__heading home-section__heading--editorial"
            >
              {reseñasSection.title || "Quienes ya eligieron Dizor"}
            </h2>
            {featured ? <Stars rating={featured.rating} /> : null}
          </header>
          {featured ? <ReviewCard review={featured} featured /> : null}
        </div>
        {rest.length > 0 ? (
          <div className={`home-voices__list home-voices__list--n${rest.length}`}>
            {rest.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
