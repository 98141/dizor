/** Reserva de altura discreta para boundaries Suspense (evita CLS). */
export default function HomeSectionFallback({ minHeight = 320 }) {
  return (
    <div
      className="home-section-fallback"
      style={{ minHeight }}
      aria-hidden="true"
    />
  );
}
