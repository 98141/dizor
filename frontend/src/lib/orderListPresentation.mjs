/** Presentation only. Does not decide transitions, payment or export scope. */

export const ACTIONABLE_OPERATION_CODES = ["prepare", "dispatch", "deliver", "collect"];

export const isOperationalAction = (code) => ACTIONABLE_OPERATION_CODES.includes(code);

/** Long DIZ-AAAAMMDD-… references stay short on screen. Other numbers are unchanged. */
export const shortenOrderNumber = (value) => {
  if (!value) return "";
  const match = /^([A-Z]+)-\d{8}-([0-9A-Z]{8,})$/i.exec(String(value));
  return match ? `${match[1]}-…${match[2].slice(-6)}` : String(value);
};

export const formatOrderListDate = (value) => {
  if (!value) return "Sin fecha registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha registrada";
  return date.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Financial label follows payment status. Contraentrega pendiente is collection, not a confirmed payment. */
export const financePresentation = (order) => {
  const status = order?.paymentStatus;
  if (status === "pagado") return { label: "Pagado", tone: "ok" };
  if (status === "rechazado") return { label: "Rechazado", tone: "bad" };
  if (status === "reembolsado") return { label: "Reembolsado", tone: "muted" };
  if (status === "pendiente" && order?.paymentMethod === "contra_entrega") return { label: "Recaudo pendiente", tone: "warn" };
  if (status === "pendiente") return { label: "Pago pendiente", tone: "warn" };
  return { label: status || "Sin estado de pago", tone: "muted" };
};

export const orderStatusTone = (status) => {
  if (status === "entregado") return "ok";
  if (["cancelado", "rechazado", "devuelto"].includes(status)) return "muted";
  if (["pendiente", "pago_pendiente"].includes(status)) return "warn";
  if (["pagado", "en_preparacion", "enviado"].includes(status)) return "info";
  return "muted";
};
