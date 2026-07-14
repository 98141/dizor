import { BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";

const TITLE = "Pedido al por mayor";
const DESCRIPTION =
  "Compra sombreros artesanales al por mayor para tu tienda, evento o empresa. Cotización personalizada desde 5 unidades. Tejidos desde Sandoná, Nariño, Colombia.";
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
    "sombreros al por mayor",
    "compra mayorista sombreros artesanales",
    "sombreros para tiendas Colombia",
    "pedido mayorista artesanías",
    "sombreros corporativos Colombia",
  ],
  openGraph: {
    title: TITLE,
    description:
      "Sombreros artesanales al por mayor desde 5 unidades. Cotización personalizada para tiendas y eventos.",
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
    canonical: "/pedido-mayor",
  },
};

const breadcrumbItems = [
  { name: "Inicio", href: "/" },
  { name: "Pedido al por mayor" },
];

export default function PedidoMayorLayout({ children }) {
  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      {children}
    </>
  );
}
