import api from "./api";

export const getProductHistoryStats = async () => {
  const res = await api.get("/admin/inventory/history/stats");
  return res.data;
};

export const getProductHistory = async (params = {}) => {
  const res = await api.get("/admin/inventory/history", { params });
  return res.data;
};
