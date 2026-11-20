/**
 * Galería Inspiración — reglas de composición (compartidas por la galería
 * pública y las vistas previas del administrador).
 *
 * Móvil (< INSPIRE_DESKTOP_MIN): dos columnas iguales, fotos en parejas por
 *   orden editorial. Marco 1:1; 4:3 si las dos fotos de la fila son
 *   horizontales (≥ 1,2). Última sin pareja: 3:2 a dos columnas si es cuadrada
 *   u horizontal; 4:5 centrada a una columna si es vertical.
 * Escritorio/tablet: 5 fotos → protagonista + 2×2 en 5:4 (la protagonista
 *   ocupa la altura de las dos filas); 4 → cuatro 1:1; 3 → tres 1:1;
 *   2 → dos 5:4. Una sola foto: marco según su orientación, centrada.
 *
 * La foto siempre llena el marco (object-fit: cover) y se recorta según su
 * punto de enfoque (focalX/focalY, 0–100; centrado si falta).
 */

/** Relación ancho/alto usada mientras no se conoce la real (retrato 4:5). */
export const DEFAULT_INSPIRATION_RATIO = 0.8;

/** Debe coincidir con el @media de la galería en home.css. */
export const INSPIRE_DESKTOP_MIN = 768;

/** Proporción mínima para considerar horizontal una foto. */
export const LANDSCAPE_MIN = 1.2;
/** Desde aquí una foto cuenta como cuadrada (tolerancia de recorte/exportación). */
export const SQUARE_MIN = 0.95;

/** Proporción aproximada del marco protagonista (columnas 1.3fr 1fr 1fr + 5:4). */
export const LEAD_FRAME_RATIO = 0.8;

const FRAME = {
  "1:1": { ar: 1, css: "1 / 1" },
  "4:3": { ar: 4 / 3, css: "4 / 3" },
  "3:2": { ar: 3 / 2, css: "3 / 2" },
  "4:5": { ar: 4 / 5, css: "4 / 5" },
  "5:4": { ar: 5 / 4, css: "5 / 4" },
};

export function shapeOf(ratio) {
  if (ratio >= LANDSCAPE_MIN) return "landscape";
  if (ratio >= SQUARE_MIN) return "square";
  return "portrait";
}

/** Marco de una foto sola según su orientación. */
function singleFrame(ratio) {
  const shape = shapeOf(ratio);
  if (shape === "landscape") return "3:2";
  if (shape === "square") return "1:1";
  return "4:5";
}

/** Ancho máximo (px a 15 px/rem) de la presentación individual. */
const SINGLE_MAX_PX = { portrait: 420, square: 510, landscape: 780 };

function mobileSlot(ratios, i) {
  const n = ratios.length;
  if (n === 1) {
    return { kind: "single", frame: singleFrame(ratios[i]) };
  }
  if (i === n - 1 && n % 2 === 1) {
    return ratios[i] >= SQUARE_MIN
      ? { kind: "wide", frame: "3:2" }
      : { kind: "center", frame: "4:5" };
  }
  const partner = i % 2 === 0 ? i + 1 : i - 1;
  const bothLandscape =
    ratios[i] >= LANDSCAPE_MIN && ratios[partner] >= LANDSCAPE_MIN;
  return { kind: "pair", frame: bothLandscape ? "4:3" : "1:1" };
}

function desktopSlot(ratios, i) {
  const n = ratios.length;
  if (n === 1) return { kind: "single", frame: singleFrame(ratios[i]) };
  if (n === 2) return { kind: "half", frame: "5:4" };
  if (n === 5) {
    return i === 0
      ? { kind: "lead", frame: null }
      : { kind: "secondary", frame: "5:4" };
  }
  return { kind: "grid", frame: "1:1" };
}

/** Fracción aproximada del viewport (vw) y tope en px (≥ 1400) por marco. */
function desktopWidth(n, kind) {
  switch (kind) {
    case "lead":
      return { vw: 37, px: 502 };
    case "secondary":
      return { vw: 28, px: 386 };
    case "half":
      return { vw: 47, px: 642 };
    case "grid":
      return n === 3 ? { vw: 31, px: 424 } : { vw: 23, px: 316 };
    default:
      return null;
  }
}

const MOBILE_VW = { pair: 47, center: 47, wide: 94, single: 94 };

/** Cuánto más ancha que el marco se dibuja la foto al llenarlo (cover). */
function overscan(ratio, frameAr) {
  return Math.max(1, ratio / frameAr);
}

function sizesFor(ratio, mobile, desktop, n) {
  const mAr = FRAME[mobile.frame].ar;
  const mVw = Math.ceil(MOBILE_VW[mobile.kind] * overscan(ratio, mAr));
  const mobilePart = `(max-width: ${INSPIRE_DESKTOP_MIN - 1}px) ${mVw}vw`;

  if (desktop.kind === "single") {
    const shape = shapeOf(ratio);
    const f = overscan(ratio, FRAME[desktop.frame].ar);
    return `${mobilePart}, ${Math.ceil(SINGLE_MAX_PX[shape] * f)}px`;
  }

  const dAr = desktop.kind === "lead" ? LEAD_FRAME_RATIO : FRAME[desktop.frame].ar;
  const f = overscan(ratio, dAr);
  const { vw, px } = desktopWidth(n, desktop.kind);
  return `${mobilePart}, (min-width: 1400px) ${Math.ceil(px * f)}px, ${Math.ceil(vw * f)}vw`;
}

/**
 * @param {number[]} ratios  ancho/alto de cada foto, en orden editorial
 * @returns {{
 *   mobile: { kind: string, frame: string, css: string },
 *   desktop: { kind: string, frame: string|null, css: string|null },
 *   sizes: string,
 * }[]}
 */
export function inspirationLayout(ratios) {
  const n = ratios.length;
  return ratios.map((ratio, i) => {
    const mobile = mobileSlot(ratios, i);
    const desktop = desktopSlot(ratios, i);
    return {
      mobile: { ...mobile, css: FRAME[mobile.frame].css },
      desktop: {
        ...desktop,
        css: desktop.frame ? FRAME[desktop.frame].css : null,
      },
      sizes: sizesFor(ratio, mobile, desktop, n),
    };
  });
}

/** Proporción numérica de un marco ("5:4" → 1,25); la protagonista ≈ 4:5. */
export function frameRatio(frame) {
  return frame ? FRAME[frame].ar : LEAD_FRAME_RATIO;
}

/** `object-position` a partir del enfoque guardado (centrado si falta). */
export function focusPosition(focalX, focalY) {
  const x = Number.isFinite(focalX) ? focalX : 50;
  const y = Number.isFinite(focalY) ? focalY : 50;
  return `${x}% ${y}%`;
}
