// frontend/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita exponer el header "X-Powered-By: Next.js" en cada respuesta.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Wildcard eliminado: solo se permiten dominios confiables explícitos
    ],
    // AVIF primero: navegadores compatibles reciben archivos ~20-30% más
    // livianos que WebP; Next negocia el formato vía Accept del navegador.
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    // Extraer el origen del backend para incluirlo en connect-src
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
      : "http://localhost:5000";

    const isDev = process.env.NODE_ENV !== "production";

    // Content-Security-Policy: ajustada para Next.js + Cloudinary + Wompi + GA4
    // En desarrollo, unsafe-eval es requerido por React para source maps y HMR
    //
    // Dominios de Google Analytics 4 agregados (Sprint 3, solo si GA4 se
    // integra — la CSP sigue siendo válida aunque NEXT_PUBLIC_GA_MEASUREMENT_ID
    // esté vacío, ya que sin ID no se monta ningún script):
    //   - script-src: googletagmanager.com → sirve el script gtag.js
    //   - connect-src: google-analytics.com/analytics.google.com/googletagmanager.com
    //     → destinos reales donde gtag.js envía los eventos (beacon/fetch)
    //   - img-src: google-analytics.com/googletagmanager.com → fallback de
    //     imagen/pixel que gtag.js puede usar cuando beacon/fetch no están disponibles
    const csp = [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
        : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://www.google-analytics.com https://www.googletagmanager.com",
      "font-src 'self'",
      `connect-src 'self' ${apiOrigin} https://checkout.wompi.co https://sandbox.wompi.co https://production.wompi.co https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com`,
      // Wompi checkout se abre en un frame/redirect
      "frame-src https://checkout.wompi.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      // Admin y vendedor: no indexar, no framear (protección clickjacking)
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/vendedor/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // Cabeceras de seguridad globales en todas las rutas
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
