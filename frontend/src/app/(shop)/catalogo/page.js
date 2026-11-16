import { Suspense } from "react";
import { redirect } from "next/navigation";
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

/** Parámetro de taxonomía → lista en `filters` (respuesta de /products/filters). */
const TAXONOMY_PARAMS = {
  category: "categories",
  weaveType: "weaveTypes",
  style: "styles",
  size: "sizes",
  color: "colors",
};
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Enlaces con ids (antiguos, CMS del home) → URL canónica con slugs
 * (`?weaveType=6a7f…` → `?weaveType=fino`). null si ya es canónica.
 */
function canonicalCatalogUrl(sp, filters) {
  if (!filters) return null;
  let changed = false;
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp || {})) {
    const value = firstValue(raw);
    if (value == null || value === "") continue;
    const list = TAXONOMY_PARAMS[key] ? filters[TAXONOMY_PARAMS[key]] : null;
    if (!Array.isArray(list)) {
      params.set(key, String(value));
      continue;
    }
    const tokens = String(value)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((token) => {
        if (!OBJECT_ID.test(token)) return token;
        const item = list.find(
          (i) => String(i._id).toLowerCase() === token.toLowerCase()
        );
        if (!item?.slug) return token;
        changed = true;
        return item.slug;
      });
    params.set(key, tokens.join(","));
  }
  if (!changed) return null;
  return `/catalogo?${params.toString().replace(/%2C/gi, ",")}`;
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

/** Taxonomía completa + facetas del contexto actual (categoría, búsqueda…). */
async function fetchInitialFilters(params) {
  try {
    const { sort: _sort, ...filterParams } = params;
    const qs = new URLSearchParams(filterParams).toString();
    const res = await fetch(
      `${BASE_API}/products/filters${qs ? `?${qs}` : ""}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return { filters: null, facets: null };
    const data = await res.json();
    return { filters: data.filters || null, facets: data.facets || null };
  } catch {
    return { filters: null, facets: null };
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

  const [productsData, filtersData, banner] = await Promise.all([
    fetchInitialProducts(params, page),
    fetchInitialFilters(params),
    fetchInitialBanner(),
  ]);

  const canonical = canonicalCatalogUrl(sp, filtersData.filters);
  if (canonical) redirect(canonical);

  return (
    <Suspense fallback={<p className="auth-loading">Cargando...</p>}>
      <CatalogoContent
        initialProducts={productsData?.products ?? null}
        initialTotal={productsData?.total ?? 0}
        initialPage={productsData?.page ?? 1}
        initialTotalPages={productsData?.totalPages ?? 1}
        initialFilterOptions={filtersData.filters}
        initialFacets={filtersData.facets}
        initialBanner={banner}
      />
    </Suspense>
  );
}
