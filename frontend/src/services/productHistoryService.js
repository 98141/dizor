import api from "./api";

export const getProductHistoryStats = async () => {
  const res = await api.get("/admin/inventory/history/stats");
  return res.data;
};

export const getProductHistory = async (params = {}) => {
  const res = await api.get("/admin/inventory/history", { params });
  return res.data;
};

export const exportProductHistoryPdf = async (params = {}) => {
  const res = await api.get("/admin/inventory/history/export-pdf", {
    params,
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().split("T")[0];
  a.download = `historial-inventario-${date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
