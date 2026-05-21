export default function manifest() {
  return {
    name: "Dizor — Sombreros artesanales",
    short_name: "Dizor",
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ef",
    theme_color: "#3d4f3a",
    orientation: "portrait",
    lang: "es-CO",
    categories: ["shopping", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
