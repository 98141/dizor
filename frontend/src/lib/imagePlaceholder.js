// Placeholder de blur genérico (shimmer) para next/image en imágenes remotas.
// No se deriva del contenido real de cada imagen (requeriría generar un
// blurDataURL por producto en el backend); es un shimmer neutro que evita
// el salto/espacio en blanco mientras la imagen carga.
const shimmer = (w, h) => `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#e8e4dc" offset="20%" />
      <stop stop-color="#f5f3ef" offset="50%" />
      <stop stop-color="#e8e4dc" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#e8e4dc" />
  <rect width="${w}" height="${h}" fill="url(#g)" />
</svg>`;

const toBase64 = (str) =>
  typeof window === "undefined"
    ? Buffer.from(str).toString("base64")
    : window.btoa(str);

export const SHIMMER_BLUR_DATA_URL = `data:image/svg+xml;base64,${toBase64(
  shimmer(400, 500)
)}`;
