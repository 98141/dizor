export const TRAYS = { prepare: "Por preparar", dispatch: "Por despachar", transit: "En camino",
  collection: "Pendientes de recaudo", review: "Requieren revisión", all: "Todos" };
export const formatOrderDate = (value) => value ? new Date(value).toLocaleString("es-CO", {
  timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short",
}) : "Sin fecha registrada";
export const returnToOrders = (candidate, basePath) => typeof candidate === "string"
  && (candidate === basePath || candidate.startsWith(`${basePath}?`)) ? candidate : basePath;
