import api from "./api";

export const createSpecialRequest = async (data) => {
  const res = await api.post("/special-requests", data);
  return res.data;
};

// POST: el correo viaja en el cuerpo, no en la URL (H-06).
export const trackSpecialRequest = async (requestNumber, email) => {
  const res = await api.post("/special-requests/track", { requestNumber, email });
  return res.data;
};

export const getMySpecialRequests = async () => {
  const res = await api.get("/special-requests/mine");
  return res.data;
};
