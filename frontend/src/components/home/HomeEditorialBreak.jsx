import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";
import MotionReveal from "@/components/motion/MotionReveal";
import { focusPosition } from "@/lib/inspirationLayout";

/**
 * Pausa editorial del inicio — una sola por página.
 * Usa el primer espacio del administrador que tenga fotos (editorial1 y,
 * si está vacío, editorial2), así ninguna foto cargada queda sin mostrarse.
 * La frase solo aparece si la foto tiene `titulo` en el CMS (nunca se inventa).
 * Sin fotos en ningún espacio → no se renderiza.
 */
export default async function HomeEditorialBreak({
  slots = ["editorial1", "editorial2"],
}) {
  const cmsData = await getHomeContent().catch(() => null);
  const homeImages = cmsData?.homeImages || {};
  const slot = slots.find((s) =>
    (homeImages[s] || []).some((img) => img?.url)
  );
  if (!slot) return null;

  const images = homeImages[slot].filter((img) => img?.url).slice(0, 2);
  const count = images.length;
  const caption = (images[0]?.titulo || "").trim();

  return (
    <section
      className={`home-editorial home-editorial--n${count}${
        caption ? " home-editorial--caption" : ""
      }`}
      aria-label={caption || "Pausa editorial"}
      data-slot={slot}
      data-count={count}
    >
      <MotionReveal variant="photo" className="home-editorial__frame">
        {images.map((img, idx) => (
          <div
            key={img.id || `${slot}-${idx}`}
            className={`home-editorial__cell home-editorial__cell--${idx + 1}`}
          >
            <Image
              src={img.url}
              alt={img.altText || "Dizor — fotografía editorial"}
              fill
              sizes={count === 1 ? "100vw" : "(max-width: 767px) 85vw, 50vw"}
              className="home-editorial__img"
              style={{ "--focus": focusPosition(img.focalX, img.focalY) }}
            />
          </div>
        ))}
        {caption ? (
          <p className="home-editorial__caption">{caption}</p>
        ) : null}
      </MotionReveal>
    </section>
  );
}
