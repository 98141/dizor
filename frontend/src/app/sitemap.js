const BASE_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co").replace(
    /\/$/,
    ""
  );

async function fetchAllProducts() {
  try {
    const res = await fetch(`${BASE_API}/products?limit=500&isActive=true`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}

async function fetchCmsPages() {
  try {
    const res = await fetch(`${BASE_API}/cms/pages`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.pages || [];
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const [products, cmsPages] = await Promise.all([
    fetchAllProducts(),
    fetchCmsPages(),
  ]);

  const staticRoutes = [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/catalogo`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/personalizar`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/pedido-mayor`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/guia-de-tallas`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const productRoutes = products.map((p) => ({
    url: `${SITE_URL}/producto/${encodeURIComponent(p.slug || p.id)}`,
    lastModified: new Date(p.updatedAt || Date.now()),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const pageRoutes = cmsPages
    .filter((p) => p.isPublished && p.slug && p.slug !== "guia-de-tallas")
    .map((p) => ({
      url: `${SITE_URL}/pagina/${p.slug}`,
      lastModified: new Date(p.updatedAt || Date.now()),
      changeFrequency: "monthly",
      priority: 0.5,
    }));

  return [...staticRoutes, ...productRoutes, ...pageRoutes];
}
