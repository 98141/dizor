import api from "./api";

export const getStoreSettings = async () => {
  const res = await api.get("/admin/settings");
  return res.data;
};

export const updateStoreSettings = async (data) => {
  const res = await api.patch("/admin/settings", data);
  return res.data;
};
