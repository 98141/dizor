import api from "./api";

export const getAdminHomeImages = async (seccion) => {
  const res = await api.get("/admin/home-images", {
    params: seccion ? { seccion } : undefined,
  });
  return res.data;
};

export const createAdminHomeImage = async ({ file, seccion, altText, titulo, linkHref, activo }) => {
  const formData = new FormData();
  formData.append("images", file);
  formData.append("seccion", seccion);
  if (altText) formData.append("altText", altText);
  if (titulo) formData.append("titulo", titulo);
  if (linkHref) formData.append("linkHref", linkHref);
  if (activo !== undefined) formData.append("activo", String(activo));

  const res = await api.post("/admin/home-images", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const updateAdminHomeImage = async (id, data, file) => {
  if (file) {
    const formData = new FormData();
    Object.entries(data || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("images", file);
    const res = await api.patch(`/admin/home-images/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }

  const res = await api.patch(`/admin/home-images/${id}`, data);
  return res.data;
};

export const reorderAdminHomeImages = async (items) => {
  const res = await api.patch("/admin/home-images/reorder", { items });
  return res.data;
};

export const deleteAdminHomeImage = async (id) => {
  const res = await api.delete(`/admin/home-images/${id}`);
  return res.data;
};
