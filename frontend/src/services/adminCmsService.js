import api from "./api";

export const getAdminHomeContent = async () => {
  const res = await api.get("/admin/content/home");
  return res.data;
};

export const updateAdminHomeContent = async (data) => {
  const res = await api.patch("/admin/content/home", data);
  return res.data;
};

export const getAdminPages = async () => {
  const res = await api.get("/admin/content/pages");
  return res.data;
};

export const getAdminPage = async (id) => {
  const res = await api.get(`/admin/content/pages/${id}`);
  return res.data;
};

export const createAdminPage = async (data) => {
  const res = await api.post("/admin/content/pages", data);
  return res.data;
};

export const updateAdminPage = async (id, data) => {
  const res = await api.patch(`/admin/content/pages/${id}`, data);
  return res.data;
};

export const deleteAdminPage = async (id) => {
  const res = await api.delete(`/admin/content/pages/${id}`);
  return res.data;
};

export const getAdminBanners = async () => {
  const res = await api.get("/admin/content/banners");
  return res.data;
};

export const createAdminBanner = async (data) => {
  const res = await api.post("/admin/content/banners", data);
  return res.data;
};

export const updateAdminBanner = async (id, data) => {
  const res = await api.patch(`/admin/content/banners/${id}`, data);
  return res.data;
};

export const deleteAdminBanner = async (id) => {
  const res = await api.delete(`/admin/content/banners/${id}`);
  return res.data;
};
