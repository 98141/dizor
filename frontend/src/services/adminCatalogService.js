import api from "./api";

export const getCatalogMeta = async () => {
  const res = await api.get("/admin/catalog/meta");
  return res.data;
};

export const getAdminProducts = async (params = {}) => {
  const res = await api.get("/admin/catalog/products", { params });
  return res.data;
};

export const getAdminProduct = async (id) => {
  const res = await api.get(`/admin/catalog/products/${id}`);
  return res.data;
};

export const createAdminProduct = async (data) => {
  const res = await api.post("/admin/catalog/products", data);
  return res.data;
};

export const updateAdminProduct = async (id, data) => {
  const res = await api.patch(`/admin/catalog/products/${id}`, data);
  return res.data;
};

export const deleteAdminProduct = async (id) => {
  const res = await api.delete(`/admin/catalog/products/${id}`);
  return res.data;
};

export const addProductImageUrl = async (id, data) => {
  const res = await api.post(`/admin/catalog/products/${id}/images/url`, data);
  return res.data;
};

export const getInventory = async () => {
  const res = await api.get("/admin/catalog/products/inventory");
  return res.data;
};

export const getTaxonomy = async (type) => {
  const res = await api.get(`/admin/catalog/${type}`);
  return res.data;
};

export const createTaxonomyItem = async (type, data) => {
  const res = await api.post(`/admin/catalog/${type}`, data);
  return res.data;
};

export const updateTaxonomyItem = async (type, id, data) => {
  const res = await api.patch(`/admin/catalog/${type}/${id}`, data);
  return res.data;
};

export const deleteTaxonomyItem = async (type, id) => {
  const res = await api.delete(`/admin/catalog/${type}/${id}`);
  return res.data;
};
