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

// POST: el correo viaja en el cuerpo, no en la URL (H-06).
export const trackOrder = async (orderNumber, email) => {
  const res = await api.post("/checkout/track", { orderNumber, email });
  return res.data;
};

// Confirmación protegida: dueño autenticado o token de acceso emitido al
// crear el pedido (H-06).
export const lookupOrderConfirmation = async (orderNumber, accessToken) => {
  const res = await api.post("/checkout/orders/lookup", { orderNumber, accessToken });
  return res.data;
};

export const verifyWompiReturn = async (orderNumber, accessToken, transactionId) => {
  const res = await api.post("/checkout/orders/wompi-return", { orderNumber, accessToken, transactionId });
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

export const getNequiStatus = async (orderId) => {
  const res = await api.get(`/payments/nequi/status/${orderId}`);
  return res.data;
};

export const retryNequiPayment = async (orderId, phoneNumber) => {
  const res = await api.post("/payments/nequi/create", { orderId, phoneNumber });
  return res.data;
};
