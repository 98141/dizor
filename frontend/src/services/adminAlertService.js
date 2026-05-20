import api from "./api";

export const getAlerts = async () => {
  const res = await api.get("/admin/alerts");
  return res.data;
};
