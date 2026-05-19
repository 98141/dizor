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
    openGraph: {
      title: p.name,
      description,
      images: p.mainImage
        ? [{ url: p.mainImage, width: 800, height: 1000, alt: p.name }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: p.name,
      description,
      images: p.mainImage ? [p.mainImage] : [],
    },
  };
}

export default async function ProductoPage({ params }) {
  const { slug: slugParam } = await params;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  return <ProductoClient slug={slug} />;
}
