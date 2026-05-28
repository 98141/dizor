import ProductoClient from "@/components/products/ProductoClient";

const BASE_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function fetchProductMeta(slug) {
  try {
    const res = await fetch(
      `${BASE_API}/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } }
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
  const description =
    p.shortDescription ||
    `Sombrero artesanal ${p.name}. Palma de iraca tejida a mano en Sandoná, Nariño, Colombia.`;

  return {
    title: p.name,
    description,
    keywords: [
      p.name,
      "sombrero artesanal",
      "palma de iraca",
      "Sandoná",
      "Nariño",
      "Colombia",
      ...(p.weaveType?.name ? [p.weaveType.name] : []),
    ].filter(Boolean),
    openGraph: {
      title: p.name,
      description,
      type: "website",
      ...(p.mainImage && {
        images: [{ url: p.mainImage, width: 800, height: 1000, alt: p.name }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: p.name,
      description,
      ...(p.mainImage && { images: [p.mainImage] }),
    },
    alternates: {
      canonical: `/producto/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function ProductoPage({ params }) {
  const { slug: slugParam } = await params;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://dizor.com.co").replace(/\/$/, "");
  const data = await fetchProductMeta(slug);
  const p = data?.product;

  const prices = (p?.variants || []).map((v) => v.price).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) : null;

  const productSchema = p
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description:
          p.shortDescription ||
          `Sombrero artesanal ${p.name}. Palma de iraca tejida a mano en Sandoná, Nariño, Colombia.`,
        image: p.mainImage ? [p.mainImage] : undefined,
        brand: { "@type": "Brand", name: "Dizor" },
        url: `${SITE}/producto/${encodeURIComponent(slug)}`,
        ...(minPrice != null && {
          offers: {
            "@type": "Offer",
            priceCurrency: "COP",
            price: minPrice,
            availability: (p.variants || []).some((v) => (v.stock || 0) > 0)
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url: `${SITE}/producto/${encodeURIComponent(slug)}`,
            seller: { "@type": "Organization", name: "Dizor" },
          },
        }),
      }
    : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE },
      { "@type": "ListItem", position: 2, name: "Catálogo", item: `${SITE}/catalogo` },
      ...(p
        ? [{ "@type": "ListItem", position: 3, name: p.name, item: `${SITE}/producto/${encodeURIComponent(slug)}` }]
        : []),
    ],
  };

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ProductoClient slug={slug} />
    </>
  );
}
