import Link from "next/link";
import MotionReveal from "@/components/motion/MotionReveal";

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M2.5 8h10.5M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Enlace de texto con flecha (subrayado + desplazamiento sutil al hover). */
export function HomeArrowLink({ href, children, className = "", external = false }) {
  const content = (
    <>
      <span>{children}</span>
      <ArrowIcon />
    </>
  );
  const cls = `home-link-arrow${className ? ` ${className}` : ""}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {content}
    </Link>
  );
}

/**
 * Encabezado de sección del inicio. Todo el texto llega del CMS:
 * `eyebrow` (opcional), `title`, `lead` (opcional).
 * tone: "commercial" (vitrinas, servicios) | "editorial" (tejidos, historia, vida real)
 * action: { href, label, external? } → enlace a la derecha en escritorio.
 */
export default function HomeSectionIntro({
  eyebrow = "",
  title,
  lead = "",
  tone = "commercial",
  action = null,
  id,
  compact = false,
  className = "",
}) {
  const intro = (
    <MotionReveal
      as="header"
      variant="editorial"
      className={`home-section__intro${compact ? " home-section__intro--compact" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {eyebrow ? <p className="home-eyebrow">{eyebrow}</p> : null}
      <h2
        id={id}
        className={`home-section__heading${
          tone === "editorial" ? " home-section__heading--editorial" : ""
        }`}
      >
        {title}
      </h2>
      {lead ? <p className="home-section__lead">{lead}</p> : null}
    </MotionReveal>
  );

  if (!action?.href || !action?.label) return intro;

  return (
    <div className="home-section__head">
      {intro}
      <HomeArrowLink href={action.href} external={action.external}>
        {action.label}
      </HomeArrowLink>
    </div>
  );
}
