import SimpleRichText from "@/components/content/SimpleRichText";
import { splitProductDescription } from "@/lib/productDescriptionSections";

const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Apartado de materia prima / procedencia: recibe un acento propio. Se
// detecta por el título real (no es una lista cerrada: el resto de
// apartados se muestran igual, con su título tal cual).
const isMaterialSection = (title) => /\b(material|materiales|origen)\b/.test(normalize(title));

function FiberIcon() {
  return (
    <svg
      className="pdp-desc__icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Hojas de palma: fibra natural */}
      <path d="M12 21V9" />
      <path d="M12 12c-3.5 0-6-2.2-6.5-6 3.8.3 6 2.6 6.5 6z" />
      <path d="M12 12c3.5 0 6-2.2 6.5-6-3.8.3-6 2.6-6.5 6z" />
      <path d="M12 9c-1.6-1.4-2-3.4-1.2-5.6C12.4 4.7 13 6.8 12 9z" />
    </svg>
  );
}

/**
 * Descripción larga de la PDP (Server Component) — «editorial abierta».
 * - Todo el contenido visible, sin acordeones ni pestañas.
 * - Introducción + un apartado por cada encabezado real del administrador
 *   («# Material y origen», «# Detalles», «# Cuidados», «# Tallas» o
 *   cualquier otro), en el orden en que se escribió.
 * - El cuerpo de cada apartado lo renderiza el parser compartido del CMS
 *   (párrafos, listas, listas numeradas, tablas de tallas, imágenes).
 * - Sin encabezados: texto continuo. Sin descripción: no se renderiza nada.
 */
export default function ProductDescription({ text, shortDescription = "" }) {
  if (!text?.trim()) return null;

  const { intro, sections } = splitProductDescription(text);
  if (sections.length === 0 && normalize(text) === normalize(shortDescription)) return null;
  // No repetir la descripción corta si el administrador la copió igual
  // como introducción de la larga.
  const showIntro = intro && normalize(intro) !== normalize(shortDescription);

  return (
    <section className="pdp-desc" aria-labelledby="pdp-desc-title">
      <h2 id="pdp-desc-title" className="pdp-desc__title">
        Descripción
      </h2>

      {sections.length === 0 ? (
        <SimpleRichText text={text} className="simple-content pdp-desc__body pdp-desc__lead" />
      ) : (
        <>
          {showIntro ? (
            <SimpleRichText text={intro} className="simple-content pdp-desc__body pdp-desc__lead" />
          ) : null}
          <div className="pdp-desc__sections">
            {sections.map((section, i) => {
              const featured = isMaterialSection(section.title);
              const headingId = `pdp-desc-s${i}`;
              return (
                <section
                  key={`${i}-${section.title}`}
                  className={`pdp-desc__section${featured ? " pdp-desc__section--featured" : ""}`}
                  aria-labelledby={headingId}
                >
                  <h3 id={headingId} className="pdp-desc__heading">
                    {featured ? <FiberIcon /> : null}
                    {section.title}
                  </h3>
                  <SimpleRichText text={section.body} className="simple-content pdp-desc__body" />
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
