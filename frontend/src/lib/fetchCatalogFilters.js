import { cache } from "react";
import {
  getActiveCategories,
  getActiveWeaveTypes,
} from "@/lib/catalogTaxonomy";

const BASE_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/** Fuente única pública: GET /products/filters (revalidate 300). */
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

export { getActiveCategories, getActiveWeaveTypes };
export { categoryHref, taxonomyId } from "@/lib/catalogTaxonomy";
