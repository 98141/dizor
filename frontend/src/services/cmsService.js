const API = process.env.NEXT_PUBLIC_API_URL;

export const getHomeContent = async () => {
  const res = await fetch(`${API}/content/home`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("No se pudo cargar el inicio");
  return res.json();
};

export const getContentPages = async () => {
  const res = await fetch(`${API}/content/pages`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return { pages: [] };
  return res.json();
};

export const getContentPage = async (slug) => {
  const res = await fetch(`${API}/content/pages/${slug}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
};

export const getBanners = async (placement) => {
  const url = new URL(`${API}/content/banners`);
  if (placement) url.searchParams.set("placement", placement);
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return { banners: [] };
  return res.json();
};
