/**
 * Divide la descripción larga del producto (texto del administrador) en
 * una introducción y apartados según sus encabezados reales "# Título".
 *
 * Es un helper específico de la PDP: no modifica el parser compartido del
 * CMS (lib/simpleContentBlocks), que sigue renderizando el cuerpo de cada
 * apartado. Mismo criterio de encabezado que ese parser: línea que empieza
 * por "#" seguida de texto.
 *
 * @param {string} text
 * @returns {{ intro: string, sections: { title: string, body: string }[] }}
 */
export function splitProductDescription(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  const intro = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.trim().match(/^#\s*(.+)$/);
    if (match) {
      current = { title: match[1].trim(), body: [] };
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    } else {
      intro.push(line);
    }
  }

  return {
    intro: intro.join("\n").trim(),
    sections: sections
      .map((s) => ({ title: s.title, body: s.body.join("\n").trim() }))
      // Un encabezado sin contenido no genera un acordeón vacío.
      .filter((s) => s.title && s.body),
  };
}
