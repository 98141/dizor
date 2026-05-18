import api from "./api";

export const getOrderStats = async () => {
  const res = await api.get("/admin/orders/stats");
  return res.data;
};

export const getAdminOrders = async (params = {}) => {
  const res = await api.get("/admin/orders", { params });
  return res.data;
};

export const getAdminOrder = async (id) => {
  const res = await api.get(`/admin/orders/${id}`);
  return res.data;
};

export const updateOrderStatus = async (id, data) => {
  const res = await api.patch(`/admin/orders/${id}/status`, data);
  return res.data;
};

export const confirmPayment = async (id, data) => {
  const res = await api.patch(`/admin/orders/${id}/payment`, data);
  return res.data;
};

export const updateOrderShipping = async (id, data) => {
  const res = await api.patch(`/admin/orders/${id}/shipping`, data);
  return res.data;
};
