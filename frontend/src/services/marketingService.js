import api from "./api";

export const getMarketingConfig = async () => {
  const res = await api.get("/marketing/config");
  return res.data;
};

export const subscribeNewsletter = async (data) => {
  const res = await api.post("/marketing/newsletter", data);
  return res.data;
};

export const saveAbandonedCart = async (data) => {
  const res = await api.post("/marketing/abandoned-cart", data);
  return res.data;
};
