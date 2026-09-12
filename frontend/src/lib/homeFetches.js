import { cache } from "react";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function fetchJson(url, revalidate = 60) {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Productos del día + tejidos del sample diario (America/Bogota). */
export const fetchDailyRandom = cache(async (limit = 5) =>
  fetchJson(`${BASE}/products/daily-random?limit=${limit}`, 60)
);

/** Novedades del catálogo. */
export const fetchNewProducts = cache(async (limit = 12) =>
  fetchJson(`${BASE}/products?isNew=true&limit=${limit}`, 60)
);

/** Reseñas públicas para Home. */
export const fetchHomeReviews = cache(async (limit = 4) =>
  fetchJson(`${BASE}/reviews?limit=${limit}`, 60)
);

/**
 * Carrusel «Descubre hoy» — hasta 10 sin nuevo/destacado.
 * Caché diaria en backend (medianoche America/Bogota).
 */
export const fetchDailyExplore = cache(async (limit = 10) =>
  fetchJson(`${BASE}/products/random-sample?limit=${limit}`, 300)
);