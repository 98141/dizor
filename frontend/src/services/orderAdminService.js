import api from "./api";
export const getOrderCommunications = async (id, page = 1) => (await api.get(`/admin/orders/${id}/communications`, { params: { page } })).data;
export const retryOrderCommunication = async (id, notificationId) => (await api.post(`/admin/orders/${id}/communications/${notificationId}/retry`)).data;
export const resendOrderCommunication = async (id, notificationId, data) => (await api.post(`/admin/orders/${id}/communications/${notificationId}/resend`, data)).data;

export const reconcileWompi = async (id, data = {}) => (await api.post(`/admin/orders/${id}/reconcile-wompi`, data)).data;
export const resolvePaymentIncident = async (id, incidentId, data) => (await api.post(`/admin/orders/${id}/incidents/${incidentId}/resolve`, data)).data;
export const getPaymentEvents = async () => (await api.get('/admin/orders/payment-events')).data;
export const reprocessPaymentEvent = async (id) => (await api.post(`/admin/orders/payment-events/${id}/reprocess`)).data;

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
