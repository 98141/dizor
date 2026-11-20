import HomePersonalization from "./HomePersonalization";
import HomeWholesale from "./HomeWholesale";

/**
 * «Hecho para ti» — agrupa visualmente los dos servicios del atelier.
 * Cada uno conserva su fuente en el CMS (`personalizacion`, `porMayor`) y su
 * propio CTA; no se fusiona ninguna funcionalidad. Sin título visible
 * adicional: cada servicio presenta su eyebrow y su título del CMS.
 */
export default function HomeServices() {
  return (
    <section
      className="home-section home-section--editorial home-section--arena home-section--services"
      aria-label="Hecho para ti"
    >
      <div className="home-container home-container--wide">
        <div className="home-services">
          <header className="home-services__intro">
            <h2 className="home-services__title">Hecho para ti</h2>
          </header>
          <HomePersonalization />
          <HomeWholesale />
        </div>
      </div>
    </section>
  );
}
