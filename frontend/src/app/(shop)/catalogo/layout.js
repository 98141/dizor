import { BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";

const TITLE = "Catálogo";
const DESCRIPTION =
  "Explora toda la colección de sombreros artesanales. Tejidos Brisa, Común y Súper fino desde Sandoná, Nariño. Filtros por talla, color y tejido.";
// Sin imagen de marketing dedicada en el repo: se reutiliza el ícono real
// del sitio para que OpenGraph/Twitter nunca queden sin imagen.
const DEFAULT_OG_IMAGE = "/icon-512.png";
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"
).replace(/\/$/, "");

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "catálogo sombreros artesanales",
    "sombreros palma de iraca",
    "tejido Brisa",
    "tejido Común",
    "tejido Súper fino",
    "sombreros Nariño",
    "comprar sombrero Colombia",
  ],
  openGraph: {
    title: TITLE,
    description:
      "Explora toda la colección de sombreros artesanales. Sombreros en palma de iraca de Sandoná.",
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  alternates: {
    canonical: "/catalogo",
  },
};

// CollectionPage: descripción genérica de la sección, sin ItemList — el
// listado real depende de filtros aplicados en cliente y no puede
// garantizarse que coincida con lo indexado (evita structured data
// inconsistente con el contenido visible).
const collectionPageSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${SITE_URL}/catalogo#collectionpage`,
  name: TITLE,
  description: DESCRIPTION,
  url: `${SITE_URL}/catalogo`,
  isPartOf: { "@id": `${SITE_URL}/#website` },
};

const breadcrumbItems = [
  { name: "Inicio", href: "/" },
  { name: "Catálogo" },
];

export default function CatalogoLayout({ children }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      {children}
    </>
  );
}
