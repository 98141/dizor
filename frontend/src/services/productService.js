// frontend/src/services/productService.js
import api from "./api";

/** Taxonomía + facetas contextuales (`params` = mismos filtros del listado). */
export const getCatalogFilters = async (params = {}) => {
  const res = await api.get("/products/filters", { params });
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
  const safeSlug = encodeURIComponent(String(slug || "").trim());
  const res = await api.get(`/products/${safeSlug}`);
  return res.data;
};
