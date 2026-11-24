import api from "./api";

export const getAdminDashboard = async () => {
  const res = await api.get("/admin/dashboard");
  return res.data;
};

// Sprint 01: read-only commercial analytics of the admin home (admin and superadmin only).
export const getDashboardAnalytics = async (params = {}) => {
  const res = await api.get("/admin/dashboard/analytics", { params });
  return res.data;
};
