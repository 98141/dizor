import api from "./api";

export const getLegalNotices = async () => {
  const res = await api.get("/legal/notices");
  return res.data;
};
