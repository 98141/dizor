export const ORDER_STATUS_LABELS = {
  pendiente: "Pendiente",
  pago_pendiente: "Pago pendiente",
  pagado: "Pagado",
  en_preparacion: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  rechazado: "Rechazado",
  devuelto: "Devuelto",
};

export const PAYMENT_STATUS_LABELS = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  rechazado: "Rechazado",
  reembolsado: "Reembolsado",
};

export const PAYMENT_METHOD_LABELS = {
  wompi: "Wompi",
  nequi_manual: "Nequi manual",
  contra_entrega: "Contra entrega",
  efectivo: "Efectivo",
  nequi_presencial: "Nequi",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export const CHANNEL_ORIGIN_LABELS = {
  presencial: "Presencial",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  telefono: "Teléfono",
  otro: "Otro",
};

export const SOURCE_LABELS = {
  web: "Web",
  manual: "Manual",
  pos: "POS",
};

export const CARRIER_LABELS = {
  interrapidisimo: "Interrapidísimo",
  envia: "Envía",
  coordinadora: "Coordinadora",
};

export const getStatusBadgeClass = (status) => {
  if (["pendiente", "pago_pendiente"].includes(status)) return "status-badge--pending";
  if (status === "pagado") return "status-badge--paid";
  if (status === "en_preparacion") return "status-badge--prep";
  if (status === "enviado") return "status-badge--shipped";
  if (["cancelado", "rechazado", "devuelto"].includes(status)) return "status-badge--cancel";
  if (status === "entregado") return "status-badge--paid";
  return "status-badge--pending";
};
