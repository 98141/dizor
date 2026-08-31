/**
 * Renderiza texto con formato ligero (mismo criterio que páginas CMS):
 * - Bloques separados por línea en blanco
 * - "# Título" o "#Título" → mayúsculas + negrita
 * - Líneas "- ítem" → lista
 * - "![alt](url)" → imagen
 * - Resto → párrafo (saltos simples → <br />)
 */

function isOrderedListBlock(lines) {
  return (
    lines.length > 0 && lines.every((l) => /^\d+[.)]\s+/.test(l.trim()))
  );
}

function isListBlock(lines) {
  return lines.length > 0 && lines.every((l) => l.trimStart().startsWith("- "));
}

function parseHeadingLine(line) {
  const match = String(line || "")
    .trim()
    .match(/^#\s*(.+)$/);
  return match ? match[1].trim() : null;
}

function parseImageLine(line) {
  const match = String(line || "")
    .trim()
    .match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
  if (!match) return null;
  return { alt: match[1], src: match[2] };
}

function renderInlineBreaks(text) {
  const parts = String(text).split("\n");
  return parts.map((part, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {part}
    </span>
  ));
}

export function renderSimpleContentBlock(block, index) {
  const trimmed = String(block || "").trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n");
  const headingText = parseHeadingLine(lines[0]);

  // Título solo, o título + resto del bloque (viñetas/párrafo debajo)
  if (headingText) {
    const heading = (
      <h3 key={`${index}-h`} className="simple-content__heading">
        {headingText}
      </h3>
    );

    if (lines.length === 1) return heading;

    const rest = lines.slice(1).join("\n").trim();
    if (!rest) return heading;

    return (
      <div key={index} className="simple-content__stack">
        {heading}
        {renderSimpleContentBlock(rest, `${index}-rest`)}
      </div>
    );
  }

  const firstImage = parseImageLine(lines[0]);
  if (firstImage) {
    // El texto entre [] solo sirve de alt accesible; no se muestra en pantalla.
    return (
      <figure key={index} className="simple-content__figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="simple-content__img"
          src={firstImage.src}
          alt={firstImage.alt || ""}
          loading="lazy"
        />
      </figure>
    );
  }

  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  // Tabla de tallas: "Talla M — 56 a 57 cm"
  const sizePattern = /^Talla\s+\S+\s+[—–-]/i;
  if (
    nonEmpty.length >= 2 &&
    nonEmpty.every((l) => sizePattern.test(l.trim()))
  ) {
    return (
      <div key={index} className="simple-content__size-grid">
        {nonEmpty.map((line) => {
          const parts = line.replace(/[—–-]+/, "—").split("—");
          const label = parts[0]?.trim();
          const value = parts[1]?.trim();
          return (
            <div key={line} className="simple-content__size-card">
              <span className="simple-content__size-label">{label}</span>
              <span className="simple-content__size-value">{value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (isOrderedListBlock(nonEmpty)) {
    return (
      <ol key={index} className="simple-content__steps">
        {nonEmpty.map((l, li) => (
          <li key={li}>{l.trim().replace(/^\d+[.)]\s+/, "")}</li>
        ))}
      </ol>
    );
  }

  if (isListBlock(nonEmpty)) {
    return (
      <ul key={index} className="simple-content__list">
        {nonEmpty.map((l, li) => (
          <li key={li}>{l.trim().replace(/^-\s+/, "")}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={index} className="simple-content__p">
      {renderInlineBreaks(trimmed)}
    </p>
  );
}

export function splitSimpleContentBlocks(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .filter((b) => b.trim());
}
