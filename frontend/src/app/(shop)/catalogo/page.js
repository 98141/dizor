import { Suspense } from "react";
import CatalogoContent from "@/components/catalog/CatalogoContent";

const BASE_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Mismo allowlist de parámetros que CatalogoContent.buildParamsFromUrl.
const FILTER_KEYS = [
  "term",
  "category",
  "weaveType",
  "style",
  "size",
  "color",
  "minPrice",
  "maxPrice",
  "inStock",
  "onPromotion",
  "featured",
  "isNew",
  "sort",
];

function firstValue(v) {
  return Array.isArray(v) ? v[0] : v;
}

function buildParams(sp) {
  const params = {};
  FILTER_KEYS.forEach((key) => {
    const value = firstValue(sp?.[key]);
    if (value) params[key] = value;
  });
  return params;
}

async function fetchInitialProducts(params, page) {
  try {
    const qs = new URLSearchParams({
      ...params,
      page: String(page || 1),
      limit: "12",
    });
    const res = await fetch(`${BASE_API}/products?${qs.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchInitialFilters() {
  try {
    const res = await fetch(`${BASE_API}/products/filters`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.filters || null;
  } catch {
    return null;
  }
}

async function fetchInitialBanner() {
  try {
    const res = await fetch(
      `${BASE_API}/content/banners?placement=catalog_top`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.banners?.[0] || null;
  } catch {
    return null;
  }
}

export default async function CatalogoPage({ searchParams }) {
  const sp = await searchParams;
  const params = buildParams(sp);
  const page = firstValue(sp?.page);

  const [productsData, filterOptions, banner] = await Promise.all([
    fetchInitialProducts(params, page),
    fetchInitialFilters(),
    fetchInitialBanner(),
  ]);

  return (
    <Suspense fallback={<p className="auth-loading">Cargando...</p>}>
      <CatalogoContent
        initialProducts={productsData?.products ?? null}
        initialTotal={productsData?.total ?? 0}
        initialPage={productsData?.page ?? 1}
        initialTotalPages={productsData?.totalPages ?? 1}
        initialFilterOptions={filterOptions}
        initialBanner={banner}
      />
    </Suspense>
  );
}
