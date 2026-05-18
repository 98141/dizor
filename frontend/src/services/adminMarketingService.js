import api from "./api";

export const getMarketingSettings = async () => {
  const res = await api.get("/admin/marketing/settings");
  return res.data;
};

export const updateMarketingSettings = async (data) => {
  const res = await api.patch("/admin/marketing/settings", data);
  return res.data;
};

export const getNewsletterSubscribers = async (params = {}) => {
  const res = await api.get("/admin/marketing/newsletter", { params });
  return res.data;
};

export const getAbandonedCarts = async (params = {}) => {
  const res = await api.get("/admin/marketing/abandoned-carts", { params });
  return res.data;
};

export const sendAbandonedReminders = async () => {
  const res = await api.post("/admin/marketing/abandoned-carts/send-reminders");
  return res.data;
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportNewsletterCsv = async () => {
  const res = await api.get("/admin/marketing/newsletter/export", {
    responseType: "blob",
  });
  downloadBlob(res.data, "newsletter-dizor.csv");
};

export const exportOrdersCsv = async () => {
  const res = await api.get("/admin/marketing/orders/export", {
    responseType: "blob",
  });
  downloadBlob(res.data, "pedidos-dizor.csv");
};

export const exportAbandonedCartsCsv = async () => {
  const res = await api.get("/admin/marketing/abandoned-carts/export", {
    responseType: "blob",
  });
  downloadBlob(res.data, "carritos-abandonados-dizor.csv");
};
