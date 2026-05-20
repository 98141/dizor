import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import "@/styles/base/variables.css";
import "@/styles/base/globals.css";
import "@/styles/components/auth-card.css";
import "@/styles/components/auth-form.css";
import "@/styles/pages/cuenta.css";
import "@/styles/layouts/public-header.css";
import "@/styles/layouts/public-footer.css";
import "@/styles/layouts/site-announcement.css";
import "@/styles/pages/admin-cms.css";
import "@/styles/components/product-card.css";
import "@/styles/components/catalog-filters.css";
import "@/styles/pages/home.css";
import "@/styles/pages/producto.css";
import "@/styles/pages/admin-products.css";
import "@/styles/layouts/admin-layout.css";
import "@/styles/pages/admin-orders.css";
import "@/styles/pages/carrito.css";
import "@/styles/pages/checkout.css";
import "@/styles/pages/special-requests.css";
import "@/styles/components/marketing.css";
import "@/styles/pages/admin-marketing.css";
import "@/styles/pages/admin-dashboard.css";
import "@/styles/pages/admin-finanzas.css";
import "@/styles/pages/not-found.css";
import "@/styles/pages/admin-pos.css";
import "@/styles/pages/admin-alertas.css";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dizor.com.co").replace(/\/$/, "");

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Dizor",
  url: SITE_URL,
  description: "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia. Tejidos Brisa, Común y Súper fino.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Sandoná",
    addressRegion: "Nariño",
    addressCountry: "CO",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "Dizor",
  inLanguage: "es-CO",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/catalogo?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dizor | Sombreros artesanales de Sandoná",
    template: "%s | Dizor",
  },
  description:
    "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia. Tejidos Brisa, Común y Súper fino. Envíos a todo el país.",
  keywords: [
    "sombreros artesanales",
    "palma de iraca",
    "Sandoná",
    "Nariño",
    "Colombia",
    "sombrero hecho a mano",
    "sombreros colombianos",
    "artesanías Colombia",
    "sombrero iraca",
    "comprar sombrero artesanal",
    "sombreros al por mayor",
    "sombreros personalizados",
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Dizor",
    title: "Dizor | Sombreros artesanales de Sandoná",
    description:
      "Sombreros artesanales en palma de iraca de Sandoná, Nariño, Colombia.",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}