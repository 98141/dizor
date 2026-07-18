import api from "./api";

export const getApprovedReviews = async (limit = 4) => {
  const res = await api.get("/reviews", { params: { limit } });
  return res.data;
};

export const getProductReviews = async (productId) => {
  const res = await api.get(`/reviews/product/${productId}`);
  return res.data;
};

export const createCustomerReview = async (payload) => {
  const res = await api.post("/reviews", payload);
  return res.data;
};

export const getAdminReviews = async (params = {}) => {
  const res = await api.get("/admin/reviews", { params });
  return res.data;
};

export const approveAdminReview = async (id) => {
  const res = await api.patch(`/admin/reviews/${id}/approve`);
  return res.data;
};

export const rejectAdminReview = async (id) => {
  const res = await api.delete(`/admin/reviews/${id}`);
  return res.data;
};

export const createBrandReview = async (payload) => {
  const res = await api.post("/admin/reviews/brand", payload);
  return res.data;
};
