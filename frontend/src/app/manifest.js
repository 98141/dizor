import { fetchAppearance, getSiteName } from "@/lib/fetchAppearance";

export default async function manifest() {
  const appearance = await fetchAppearance();
  const siteName = getSiteName(appearance);
  const themeColor = appearance?.primaryColor || "#1A1A1A";
  const bgColor = appearance?.bgColor || "#FFFFFF";

  return {
    name: `${siteName} — Sombreros artesanales`,
    short_name: siteName,
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia.",
    start_url: "/",
    display: "standalone",
    background_color: bgColor,
    theme_color: themeColor,
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
