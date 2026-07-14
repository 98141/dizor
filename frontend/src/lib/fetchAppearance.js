import { cache } from "react";

const BASE_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const fetchAppearance = cache(async () => {
  try {
    const res = await fetch(`${BASE_API}/content/appearance`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.appearance;
  } catch {
    return null;
  }
});

export const DEFAULT_SITE_NAME = "Dizor";

export function getSiteName(appearance) {
  return appearance?.siteName || DEFAULT_SITE_NAME;
}
