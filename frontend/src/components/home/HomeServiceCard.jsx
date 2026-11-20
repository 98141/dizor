import Image from "next/image";
import Link from "next/link";

/**
 * Composición de un servicio del inicio (Personalización / Por mayor).
 * Presentacional: todo el contenido llega del CMS a través de props.
 */
export default function HomeServiceCard({
  id,
  variant,
  eyebrow = "",
  title,
  body = "",
  bullets = [],
  image = null,
  imageAlt = "",
  cta,
  children,
}) {
  return (
    <article
      className={`home-service home-service--${variant}${image ? "" : " home-service--no-media"}`}
      aria-labelledby={id}
    >
      {image ? (
        <div className="home-service__media">
          <Image
            src={image}
            alt={imageAlt}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1439px) 50vw, 36vw"
            className="home-service__img"
          />
        </div>
      ) : null}
      <div className="home-service__body">
        {eyebrow ? <p className="home-eyebrow">{eyebrow}</p> : null}
        <h3 id={id} className="home-section__heading">
          {title}
        </h3>
        {body ? <p className="home-section__lead">{body}</p> : null}
        {Array.isArray(bullets) && bullets.length > 0 ? (
          <ul className="home-service__list">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="home-service__actions">
          <Link href={cta.href} className="home-btn home-btn--solid">
            {cta.label}
          </Link>
          {children}
        </div>
      </div>
    </article>
  );
}
