import api from "./api";

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

export const getTaxonomy = async (type) => {
  const res = await api.get(`/admin/catalog/${type}`);
  return res.data;
};

export const getInventory = async () => {
  const res = await api.get("/admin/catalog/products/inventory");
  return res.data;
};
