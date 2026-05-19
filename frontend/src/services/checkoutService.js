import api from "./api";

export const getCheckoutConfig = async () => {
  const res = await api.get("/checkout/config");
  return res.data;
};

export const calculateCheckout = async (items, department) => {
  const res = await api.post("/checkout/calculate", { items, department });
  return res.data;
};

export const createOrder = async (payload) => {
  const res = await api.post("/checkout/orders", payload);
  return res.data;
};

export const trackOrder = async (orderNumber, email) => {
  const res = await api.get("/checkout/track", {
    params: { orderNumber, email },
  });
  return res.data;
};

export const getMyOrders = async () => {
  const res = await api.get("/checkout/orders");
  return res.data;
};

export const cancelOrder = async (orderId) => {
  const res = await api.patch(`/checkout/orders/${orderId}/cancel`);
  return res.data;
};

export const getMyOrder = async (orderId) => {
  const res = await api.get(`/checkout/orders/${orderId}`);
  return res.data;
};
