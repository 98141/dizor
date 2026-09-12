import Image from "next/image";
import { getHomeContent } from "@/services/cmsService";
import MotionReveal from "@/components/motion/MotionReveal";

const SLOTS = {
  editorial1: {
    section: "editorial1",
    label: "Pausa editorial",
  },
  editorial2: {
    section: "editorial2",
    label: "Pausa editorial",
  },
};

/**
 * Pausa visual Home — solo fotografía (sin título / CTA / overlay).
 * slot: "editorial1" | "editorial2"
 */
export default async function HomeEditorialBreak({ slot = "editorial1" }) {
  const meta = SLOTS[slot];
  if (!meta) return null;

  const cmsData = await getHomeContent().catch(() => null);
  const images = (cmsData?.homeImages?.[meta.section] || [])
    .filter((img) => img?.url)
    .slice(0, 2);

  if (!images.length) return null;

  const count = images.length;

  return (
    <section
      className={`home-editorial home-editorial--${slot} home-editorial--n${count}`}
      aria-label={meta.label}
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
              sizes={
                count === 1
                  ? "100vw"
                  : "(max-width: 767px) 85vw, 50vw"
              }
              style={{ objectFit: "cover", objectPosition: "center" }}
            />
          </div>
        ))}
      </MotionReveal>
    </section>
  );
}
