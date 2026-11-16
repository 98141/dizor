/**
 * Galería Inspiración — filas justificadas (editorial, sin recortes).
 *
 * Cada fila ocupa el ancho completo; dentro de una fila todas las fotos
 * comparten altura y su ancho es proporcional a su relación de aspecto.
 * Así las imágenes conservan su encuadre original (sin `cover`) y no queda
 * espacio en blanco entre ellas.
 *
 * Con ≤ 5 imágenes se evalúan todas las particiones posibles (máx. 16) y se
 * elige la que deja las filas más cerca de la altura objetivo.
 */

/** Relación ancho/alto usada mientras no se conoce la real (retrato 4:5). */
export const DEFAULT_INSPIRATION_RATIO = 0.8;

/** Penalización por fila con una sola foto (salvo que solo haya una). */
const SINGLE_ROW_PENALTY = 0.25;

/** Todas las composiciones ordenadas de `n` con partes ≤ `maxPerRow`. */
function compositions(n, maxPerRow) {
  if (n === 0) return [[]];
  const out = [];
  for (let k = 1; k <= Math.min(maxPerRow, n); k += 1) {
    for (const rest of compositions(n - k, maxPerRow)) out.push([k, ...rest]);
  }
  return out;
}

/**
 * @param {number[]} ratios  ancho/alto de cada imagen
 * @param {{ target: number, maxPerRow: number }} opts
 *   target: altura de fila deseada como fracción del ancho del contenedor
 * @returns {{ rows: number[][], items: { f: number, k: number }[], minSum: number }}
 *   items[i].f — fracción del ancho útil de su fila; items[i].k — fotos en la fila;
 *   minSum — menor suma de ratios por fila (limita la fila más alta).
 */
export function buildJustifiedRows(ratios, { target, maxPerRow }) {
  const n = ratios.length;
  if (!n) return { rows: [], items: [], minSum: 1 };

  let best = null;
  let bestCost = Infinity;

  for (const parts of compositions(n, maxPerRow)) {
    let cost = 0;
    let i = 0;
    for (const k of parts) {
      const sum = ratios.slice(i, i + k).reduce((a, b) => a + b, 0);
      cost += (1 / sum - target) ** 2;
      if (k === 1 && n > 1) cost += SINGLE_ROW_PENALTY;
      i += k;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = parts;
    }
  }

  const rows = [];
  const items = [];
  let minSum = Infinity;
  let i = 0;
  for (const k of best) {
    const idx = Array.from({ length: k }, (_, j) => i + j);
    const sum = idx.reduce((a, j) => a + ratios[j], 0);
    minSum = Math.min(minSum, sum);
    idx.forEach((j) => {
      items[j] = { f: ratios[j] / sum, k };
    });
    rows.push(idx);
    i += k;
  }

  return { rows, items, minSum };
}

/** Escritorio: hasta 3 por fila, filas amplias. */
export const DESKTOP_LAYOUT = { target: 0.42, maxPerRow: 3 };
/** Tablet: preferentemente 2 por fila (3 solo para absorber impares). */
export const TABLET_LAYOUT = { target: 0.6, maxPerRow: 3 };
