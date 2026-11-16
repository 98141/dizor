import api from "./api";

export const getCustomerRequestConfig = async () => {
  const res = await api.get("/pqr/config");
  return res.data;
};

export const createCustomerRequest = async (data) => {
  const res = await api.post("/pqr", data);
  return res.data;
};

export const trackCustomerRequest = async (radicado, accessCode) => {
  const res = await api.post("/pqr/track", { radicado, accessCode });
  return res.data;
};

// ─── Administración ────────────────────────────────────────────────────────
export const adminListCustomerRequests = async (params = {}) => {
  const res = await api.get("/admin/pqr", { params });
  return res.data;
};

export const adminGetCustomerRequest = async (id) => {
  const res = await api.get(`/admin/pqr/${id}`);
  return res.data;
};

export const adminUpdateCustomerRequestStatus = async (id, payload) => {
  const res = await api.patch(`/admin/pqr/${id}/status`, payload);
  return res.data;
};
