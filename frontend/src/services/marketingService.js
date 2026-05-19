import api from "./api";

const marketingError = (err, fallback) => {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    return "API no configurada (NEXT_PUBLIC_API_URL)";
  }
  if (!err.response) {
    return "No se pudo conectar con el servidor. ¿Está el backend en marcha?";
  }
  return err.response?.data?.message || fallback;
};

export const getMarketingConfig = async () => {
  const res = await api.get("/marketing/config");
  return res.data;
};

export { marketingError };

export const subscribeNewsletter = async (data) => {
  const res = await api.post("/marketing/newsletter", data);
  return res.data;
};

export const saveAbandonedCart = async (data) => {
  const res = await api.post("/marketing/abandoned-cart", data);
  return res.data;
};
