import api from "./api";

export const validateCart = async (items, department) => {
  const res = await api.post("/cart/validate", { items, department });
  return res.data;
};

export const syncCart = async (items) => {
  const res = await api.put("/cart/sync", { items });
  return res.data;
};

export const getSavedCart = async () => {
  const res = await api.get("/cart");
  return res.data;
};

export const validateCoupon = async (code, subtotal) => {
  const res = await api.post("/cart/coupon", { code, subtotal });
  return res.data;
};
