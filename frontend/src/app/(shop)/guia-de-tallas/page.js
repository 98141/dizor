import Link from "next/link";
import SizeGuide from "@/components/products/SizeGuide";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"
).replace(/\/$/, "");

export const metadata = {
  title: "Guía de tallas",
  description:
    "Aprende a medir tu cabeza y elige la talla correcta para tu sombrero de palma de iraca. Tabla de tallas XS a XXL.",
  alternates: {
    canonical: "/guia-de-tallas",
  },
};

export default function GuiaDeTallasPage() {
  const breadcrumbItems = [
    { name: "Inicio", href: "/" },
    { name: "Guía de tallas" },
  ];

  return (
    <article className="hat-size-guide-page">
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      <Breadcrumbs
        items={breadcrumbItems}
        as="nav"
        className="content-page__breadcrumb"
      />
      <SizeGuide variant="page" />
      <p className="hat-size-guide-page__back">
        <Link href="/catalogo" className="content-page__back-link">
          ← Ver productos
        </Link>
      </p>
    </article>
  );
}
