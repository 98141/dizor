import api from "./api";

export const searchPosProducts = async (q) => {
  const res = await api.get("/admin/pos/search", { params: { q } });
  return res.data;
};

export const createPosSale = async (data) => {
  const res = await api.post("/admin/pos/sales", data);
  return res.data;
};

export const getPosSales = async (params = {}) => {
  const res = await api.get("/admin/pos/sales", { params });
  return res.data;
};

export const voidPosSale = async (id, reason) => {
  const res = await api.patch(`/admin/pos/sales/${id}/void`, { reason });
  return res.data;
};

export const getCashClose = async (date) => {
  const res = await api.get("/admin/pos/cash-close", { params: { date } });
  return res.data;
};

export const downloadCashClosePdf = async (date) => {
  const res = await api.get("/admin/pos/cash-close/pdf", {
    params: { date },
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cierre-caja-${date || new Date().toISOString().split("T")[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
