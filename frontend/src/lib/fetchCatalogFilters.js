import { cache } from "react";

const BASE_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const fetchCatalogFilters = cache(async () => {
  try {
    const res = await fetch(`${BASE_API}/products/filters`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
});

export function getActiveWeaveTypes(filtersPayload) {
  const list = filtersPayload?.filters?.weaveTypes || [];
  return Array.isArray(list) ? list : [];
}
