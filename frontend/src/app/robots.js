export default function robots() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://dizor.com.co";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/vendedor/",
          "/api/",
          "/checkout",
          "/carrito",
          "/pedido/",
          "/solicitud/",
          "/seguimiento",
          "/login",
          "/register",
          "/cuenta",
          "/olvide-contrasena",
          "/restablecer/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
