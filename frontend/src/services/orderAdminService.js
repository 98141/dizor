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

export const createManualOrder = async (data) => {
  const res = await api.post("/admin/orders/manual", data);
  return res.data;
};

export const exportOrdersPdf = async (params = {}) => {
  const res = await api.get("/admin/orders/export/pdf", {
    params,
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dizor-pedidos-${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
