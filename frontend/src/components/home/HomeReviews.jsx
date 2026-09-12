import { getHomeContent } from "@/services/cmsService";
import { fetchHomeReviews } from "@/lib/homeFetches";

function Stars({ rating = 5 }) {
  const n = Math.max(1, Math.min(5, Number(rating) || 5));
  return (
    <span className="home-voices__stars" aria-label={`${n} de 5 estrellas`}>
      {"★".repeat(n)}
      <span className="home-voices__stars-empty">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** Voces / reseñas — Server Component. */
export default async function HomeReviews() {
  const [cmsData, reviewsData] = await Promise.all([
    getHomeContent().catch(() => null),
    fetchHomeReviews(4),
  ]);

  const reseñasSection = cmsData?.home?.reseñasSection || {};
  const reviews = reviewsData?.reviews || [];

  if (reseñasSection.isActive === false || reviews.length === 0) return null;

  return (
    <section className="home-section home-section--border">
      <div className="home-container">
        <header className="home-section__intro">
          <p className="home-eyebrow">
            {reseñasSection.eyebrow || "VOCES"}
          </p>
          <h2 className="home-section__heading">
            {reseñasSection.title || "Quienes ya eligieron Dizor"}
          </h2>
        </header>
        <div className="home-voices__grid">
          {reviews.map((review) => (
            <blockquote key={review.id} className="home-voice">
              <Stars rating={review.rating} />
              <p className="home-voice__quote">
                &ldquo;{review.comment}&rdquo;
              </p>
              <footer className="home-voice__author">
                <strong>{review.authorName}</strong>
                {review.city ? (
                  <span className="home-voice__city">
                    {review.city.toUpperCase()}
                  </span>
                ) : null}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
