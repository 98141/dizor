import api from "./api";

export const getAuditStats = async () => {
  const res = await api.get("/admin/audit/stats");
  return res.data;
};

export const getAuditLogs = async (params = {}) => {
  const res = await api.get("/admin/audit", { params });
  return res.data;
};
