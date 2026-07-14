import { BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";

const TITLE = "Personalizar sombrero";
const DESCRIPTION =
  "Solicita tu sombrero artesanal personalizado. Bordados, cintas, colores especiales y acabados a la medida. Hecho a mano en Sandoná, Nariño, Colombia.";
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
    "sombrero personalizado",
    "sombrero artesanal bordado",
    "personalización sombreros Colombia",
    "sombrero a la medida",
    "sombrero iraca personalizado",
  ],
  openGraph: {
    title: TITLE,
    description:
      "Solicita tu sombrero artesanal personalizado. Bordados, cintas y colores especiales desde Sandoná.",
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
    canonical: "/personalizar",
  },
};

const breadcrumbItems = [
  { name: "Inicio", href: "/" },
  { name: "Personalizar" },
];

export default function PersonalizarLayout({ children }) {
  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      {children}
    </>
  );
}
