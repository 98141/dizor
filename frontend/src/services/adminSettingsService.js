import api from "./api";

export const getStoreSettings = async (config = {}) => {
  const res = await api.get("/admin/settings", config);
  return res.data;
};

export const updateStoreSettings = async (data, config = {}) => {
  const res = await api.patch("/admin/settings", data, config);
  return res.data;
};
