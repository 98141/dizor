import { notFound } from "next/navigation";
import ProductoClient from "@/components/products/ProductoClient";
import { BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";

const BASE_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
// Fallback cuando el producto no tiene imagen propia: usa el ícono real del
// sitio (ya existente en /public) en vez de dejar Open Graph/Twitter sin imagen.
const DEFAULT_OG_IMAGE = "/icon-512.png";

async function fetchProductMeta(slug) {
  try {
    const res = await fetch(
      `${BASE_API}/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug: slugParam } = await params;
  const raw = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const slug = decodeURIComponent(raw || "").trim();
  const data = await fetchProductMeta(slug);

  if (!data?.product) {
    return { title: "Producto no encontrado" };
  }

  const p = data.product;
  const title = p.seoTitle || p.name;
  const description =
    p.seoDescription ||
    p.shortDescription ||
    `Sombrero artesanal ${p.name}. Palma de iraca tejida a mano en Sandoná, Nariño, Colombia.`;
  const ogImage = p.mainImage || DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    keywords: [
      ...(p.seoKeywords?.length ? p.seoKeywords : [p.name]),
      "sombrero artesanal",
      "palma de iraca",
      "Sandoná",
      "Nariño",
      "Colombia",
      ...(p.weaveType?.name ? [p.weaveType.name] : []),
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: ogImage,
          width: p.mainImage ? 800 : 512,
          height: p.mainImage ? 1000 : 512,
          alt: p.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `/producto/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function ProductoPage({ params }) {
  const { slug: slugParam } = await params;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const SITE = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"
  ).replace(/\/$/, "");
  const data = await fetchProductMeta(slug);
  const p = data?.product;

  if (!p) notFound();

  const activeVariants = (p.variants || []).filter((v) => v.isActive);
  const prices = activeVariants.map((v) => v.price).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const representativeVariant =
    activeVariants.find((v) => v.price === minPrice) || activeVariants[0];
  const uniqueSizes = [
    ...new Set(activeVariants.map((v) => v.size?.name).filter(Boolean)),
  ];
  const uniqueColors = [
    ...new Set(activeVariants.map((v) => v.color?.name).filter(Boolean)),
  ];
  const productImages = p.images?.length
    ? p.images.map((img) => img.url)
    : [p.mainImage || `${SITE}${DEFAULT_OG_IMAGE}`];

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description:
      p.seoDescription ||
      p.shortDescription ||
      `Sombrero artesanal ${p.name}. Palma de iraca tejida a mano en Sandoná, Nariño, Colombia.`,
    image: productImages,
    brand: { "@type": "Brand", name: "Dizor" },
    ...(p.category?.name && { category: p.category.name }),
    ...(p.material && { material: p.material }),
    ...(uniqueColors.length > 0 && { color: uniqueColors.join(", ") }),
    ...(uniqueSizes.length > 0 && { size: uniqueSizes.join(", ") }),
    url: `${SITE}/producto/${encodeURIComponent(slug)}`,
    ...(minPrice != null && {
      offers: {
        "@type": "Offer",
        priceCurrency: "COP",
        price: minPrice,
        availability: activeVariants.some((v) => (v.stock || 0) > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: `${SITE}/producto/${encodeURIComponent(slug)}`,
        seller: { "@type": "Organization", name: "Dizor" },
        ...(representativeVariant?.sku && { sku: representativeVariant.sku }),
      },
    }),
  };

  const breadcrumbItems = [
    { name: "Inicio", href: "/" },
    { name: "Catálogo", href: "/catalogo" },
    { name: p.name },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE} />
      <ProductoClient slug={slug} />
    </>
  );
}
