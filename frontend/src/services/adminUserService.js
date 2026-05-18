import api from "./api";

export const getAdminUsers = async () => {
  const res = await api.get("/admin/users");
  return res.data;
};

export const createAdminUser = async (data) => {
  const res = await api.post("/admin/users", data);
  return res.data;
};

export const updateAdminUserStatus = async (id, isActive) => {
  const res = await api.patch(`/admin/users/${id}/status`, { isActive });
  return res.data;
};
