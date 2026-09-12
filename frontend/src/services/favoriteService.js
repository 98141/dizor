import api from "./api";

export const getFavoriteIds = async () => {
  const res = await api.get("/favorites/ids");
  return res.data;
};

export const getFavorites = async () => {
  const res = await api.get("/favorites");
  return res.data;
};

export const addFavorite = async (productId) => {
  const res = await api.post(`/favorites/${encodeURIComponent(productId)}`);
  return res.data;
};

export const removeFavorite = async (productId) => {
  const res = await api.delete(`/favorites/${encodeURIComponent(productId)}`);
  return res.data;
};

/** Fusiona wishlist de invitado con la del usuario autenticado. */
export const syncFavorites = async (productIds = []) => {
  const res = await api.put("/favorites/sync", { productIds });
  return res.data;
};

/** Quita varios productos de la wishlist del usuario. */
export const removeManyFavorites = async (productIds = []) => {
  const res = await api.post("/favorites/remove-many", { productIds });
  return res.data;
};
