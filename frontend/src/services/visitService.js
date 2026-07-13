const API = process.env.NEXT_PUBLIC_API_URL;

export const getVisitCount = async () => {
  try {
    const res = await fetch(`${API}/visits/count`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total || 0;
  } catch {
    return 0;
  }
};

export const registerVisit = async () => {
  const res = await fetch(`${API}/visits/register`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo registrar la visita");
  return res.json();
};
