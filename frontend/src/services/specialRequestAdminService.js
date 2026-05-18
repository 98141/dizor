import api from "./api";

export const getSpecialRequestStats = async () => {
  const res = await api.get("/admin/special-requests/stats");
  return res.data;
};

export const getAdminSpecialRequests = async (params = {}) => {
  const res = await api.get("/admin/special-requests", { params });
  return res.data;
};

export const getAdminSpecialRequest = async (id) => {
  const res = await api.get(`/admin/special-requests/${id}`);
  return res.data;
};

export const updateSpecialRequestStatus = async (id, data) => {
  const res = await api.patch(`/admin/special-requests/${id}/status`, data);
  return res.data;
};

export const updateSpecialRequestQuote = async (id, data) => {
  const res = await api.patch(`/admin/special-requests/${id}/quote`, data);
  return res.data;
};

export const updateSpecialRequestNotes = async (id, adminNotes) => {
  const res = await api.patch(`/admin/special-requests/${id}/notes`, {
    adminNotes,
  });
  return res.data;
};
