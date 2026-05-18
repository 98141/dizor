export const REQUEST_TYPE_LABELS = {
  customization: "Personalización",
  wholesale: "Pedido al por mayor",
};

export const REQUEST_STATUS_LABELS = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  cotizado: "Cotizado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const getRequestBadgeClass = (status) => {
  if (status === "pendiente") return "request-badge--pending";
  if (status === "en_revision") return "request-badge--review";
  if (status === "cotizado") return "request-badge--quoted";
  if (status === "aprobado" || status === "completado") return "request-badge--ok";
  if (["rechazado", "cancelado"].includes(status)) return "request-badge--cancel";
  return "request-badge--pending";
};
