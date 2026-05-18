import api from "./api";

export const registerUser = async (data) => {
  const res = await api.post("/auth/register", data);
  return res.data;
};

export const loginUser = async (data) => {
  const res = await api.post("/auth/login", data);
  return res.data;
};

export const getMe = async () => {
  const res = await api.get("/auth/me");
  return res.data;
};

export const refreshSession = async () => {
  const res = await api.post("/auth/refresh-token");
  return res.data;
};

export const logoutUser = async () => {
  const res = await api.post("/auth/logout");
  return res.data;
};

export const forgotPassword = async (data) => {
  const res = await api.post("/auth/forgot-password", data);
  return res.data;
};

export const resetPassword = async (token, data) => {
  const res = await api.patch(`/auth/reset-password/${token}`, data);
  return res.data;
};

export const updatePassword = async (data) => {
  const res = await api.patch("/auth/update-password", data);
  return res.data;
};

export const updateProfile = async (data) => {
  const res = await api.patch("/auth/me", data);
  return res.data;
};

export const addAddress = async (data) => {
  const res = await api.post("/auth/me/addresses", data);
  return res.data;
};

export const updateAddress = async (addressId, data) => {
  const res = await api.patch(`/auth/me/addresses/${addressId}`, data);
  return res.data;
};

export const deleteAddress = async (addressId) => {
  const res = await api.delete(`/auth/me/addresses/${addressId}`);
  return res.data;
};
