import api from "./api";

export const getCatalogFilters = async () => {
  const res = await api.get("/products/filters");
  return res.data;
};

export const getProducts = async (params = {}) => {
  const res = await api.get("/products", { params });
  return res.data;
};

export const getFeaturedProducts = async (limit = 8) => {
  const res = await api.get("/products/featured", { params: { limit } });
  return res.data;
};

export const getProductBySlug = async (slug) => {
  const res = await api.get(`/products/${slug}`);
  return res.data;
};
