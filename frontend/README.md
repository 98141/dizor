This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Configuración de SEO / entorno

Variables de entorno relevantes para SEO (ver `.env.example`):

- `NEXT_PUBLIC_SITE_URL`: dominio público del sitio, usado por `robots.js`, `sitemap.js`, `metadataBase` y todo el JSON-LD. Debe apuntar siempre al dominio de producción con `https://` (sin backend).
- `NEXT_PUBLIC_API_URL`: base de la API, usada solo para obtener datos (nunca se expone como URL pública/canonical).

El número de contacto de WhatsApp tiene un único origen en `src/lib/whatsapp.js` (`WHATSAPP_NUMBER` / `getWhatsAppUrl()`); no debe hardcodearse en otros componentes.

## Analítica (Google Analytics 4)

Toda la instrumentación vive en `src/lib/analytics/` (nunca llamar `window.gtag(...)` directamente desde un componente — usar las funciones `trackXxx` de `src/lib/analytics/events.js`).

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (ver `.env.example`): pública, vacía por defecto. Sin ID configurado, no se carga ningún script ni se envía ningún evento. Requiere `next build` para tomar efecto.
- El consentimiento (`src/lib/analytics/consent.js`) es **denegado por defecto** — aunque haya un ID configurado, no se activa nada hasta que exista consentimiento explícito otorgado vía `grantAnalyticsConsent()`. El banner/UI de consentimiento se construye en el Sprint 4; este sprint solo deja el adaptador técnico listo.
- `NEXT_PUBLIC_ANALYTICS_DEBUG=true` (opcional, solo desarrollo) registra en consola los eventos que se intentarían enviar, sin requerir consentimiento otorgado.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
