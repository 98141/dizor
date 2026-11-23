const { BUSINESS } = require("../config/businessInfo");

const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
const LABELS = {
  "order.received": "Recibimos tu pedido", "admin.ready": "Pedido listo para preparar",
  "payment.approved": "Pago confirmado", "payment.review": "Pago en revisión",
  "payment.declined": "Resultado de tu intento de pago", "order.shipped": "Tu pedido está en camino",
  "shipping.corrected": "Actualizamos la guía de tu pedido", "order.delivered": "Entrega registrada",
  "order.cancelled": "Cancelación de tu pedido", "admin.cancelled": "Cancelación solicitada por el cliente",
  "admin.incident": "Pedido con incidencia para revisión",
  "admin.payment_event": "Transacción Wompi sin asociación verificada",
};
exports.EVENT_LABELS = LABELS;
exports.snapshotOrder = (order) => ({
  orderNumber: order.orderNumber, buyerName: order.buyer?.name || "",
  paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus,
  total: order.total, subtotal: order.subtotal, shippingCost: order.shippingCost, taxTotal: order.taxTotal,
  discountTotal: order.discountTotal, shippingIncluded: !!order.shippingIncluded,
  carrier: order.carrier, trackingNumber: order.trackingNumber, shippingRevision: order.shippingRevision || 0,
  address: { address: order.shippingAddress?.address || "", city: order.shippingAddress?.city || "", department: order.shippingAddress?.department || "" },
  deliveryTerms: order.legal?.deliveryTermsText || "",
  items: (order.items || []).map((i) => ({ name: i.productName, size: i.sizeName, color: i.colorName, quantity: i.quantity, total: i.lineTotal })),
});

exports.buildMessage = (event, snapshot, { retryUrl = null } = {}) => {
  if (event === "admin.payment_event") {
    const lines = [`Revisar transacción Wompi ${snapshot.transactionId}: ${snapshot.status} (${snapshot.environment}).`,
      "Evidencia conservada en la bandeja de eventos de pago. No confirma un pedido ni un reembolso.",
      ...(snapshot.items || []).map(i => i.name || "")];
    return { subject: LABELS[event], text: lines.join("\n\n"), html: lines.map(line => `<p>${escape(line)}</p>`).join("") };
  }
  if (event !== "payment.declined") retryUrl = null;
  if (retryUrl) {
    try {
      const url = new URL(retryUrl);
      if (url.origin !== "https://checkout.wompi.co" || !/^\/l\/[A-Za-z0-9_%~-]+$/.test(url.pathname) || url.search || url.hash) retryUrl = null;
    } catch { retryUrl = null; }
  }
  const s = snapshot;
  const title = LABELS[event];
  if (!title) throw new Error("Unknown transactional notification");
  const payment = s.paymentMethod === "contra_entrega" ? "Contraentrega" : s.paymentMethod === "wompi" ? "Wompi" : "Método histórico registrado";
  const carrier = { servientrega: "Servientrega", interrapidisimo: "Inter Rapidísimo", envia: "Envía", coordinadora: "Coordinadora" }[s.carrier] || "Transportadora registrada";
  const copy = {
    "order.received": s.paymentMethod === "contra_entrega"
      ? "Tu pedido quedó registrado. El pago contraentrega sigue pendiente; el recaudo se registra por separado."
      : s.paymentStatus === "pagado" ? "Tu pedido quedó registrado. El resultado del pago se informa en una comunicación separada."
        : "Tu pedido quedó registrado. Crear el enlace no confirma el pago; esperamos el resultado verificable de Wompi.",
    "admin.ready": "El pedido cumple las condiciones para iniciar preparación. Revisa los datos en el panel antes de continuar.",
    "payment.approved": "Wompi confirmó el pago de tu pedido. El despacho y la entrega se registran por separado.",
    "payment.review": "Se registró un resultado aprobado asociado a tu pedido que requiere revisión antes de continuar. Esta comunicación no confirma preparación, despacho ni reembolso.",
    "payment.declined": "El intento de pago no fue aprobado. Esto no cancela automáticamente el pedido. Puedes comunicarte con nuestro canal de atención para revisar las opciones disponibles.",
    "order.shipped": "Registramos el despacho de tu pedido con los siguientes datos.",
    "shipping.corrected": "La información de envío fue corregida. Usa la transportadora y la guía de este mensaje.",
    "order.delivered": s.paymentMethod === "contra_entrega" && s.paymentStatus !== "pagado"
      ? "Registramos la entrega de tu pedido. La entrega y la confirmación de recaudo son hechos separados; el recaudo aún figura pendiente de confirmación de la transportadora. Este mensaje no solicita un pago adicional."
      : "Registramos la entrega de tu pedido. Gracias por elegir artesanías colombianas.",
    "order.cancelled": s.paymentStatus === "pagado"
      ? "Registramos la cancelación de tu pedido. Existe un pago recibido cuyo tratamiento está pendiente de revisión administrativa. Este mensaje no confirma un reembolso."
      : "Registramos la cancelación de tu pedido. Esta comunicación no confirma un pago ni un reembolso.",
    "admin.cancelled": "El cliente canceló el pedido antes de preparación. Consulta el estado operativo y el estado del pago por separado.",
    "admin.incident": "El pedido requiere revisión administrativa. Consulta la evidencia del pago y las incidencias en el panel; no lo prepares mientras siga bloqueado.",
  }[event];
  const items = s.items.map((i) => `${i.name || "Producto"}${i.size ? ` · ${i.size}` : ""}${i.color ? ` · ${i.color}` : ""} × ${i.quantity} — ${money(i.total)}`);
  const lines = [title, `Pedido ${s.orderNumber}`, copy, ...items, `Total del pedido: ${money(s.total)}`, `Método: ${payment}`];
  if (event === "order.received") lines.push(`Subtotal: ${money(s.subtotal)}`, `Descuento: ${money(s.discountTotal)}`, `Impuestos: ${money(s.taxTotal)}`,
    s.shippingIncluded ? "Envío incluido en el precio" : `Envío: ${money(s.shippingCost)}`);
  if (event === "order.cancelled") lines.push(`Estado registrado al cancelar: ${s.paymentStatus === "pagado" ? "pago registrado; tratamiento pendiente" : s.paymentStatus === "pendiente" ? "pendiente de confirmación" : s.paymentStatus === "rechazado" ? "intento de pago no aprobado" : "registro histórico sujeto a revisión"}.`);
  if (["order.shipped", "shipping.corrected"].includes(event)) lines.push(`Transportadora: ${carrier}`, `Guía: ${s.trackingNumber}`);
  const address = [s.address.address, s.address.city, s.address.department].filter(Boolean).join(", ");
  if (["order.received", "admin.ready", "order.shipped", "shipping.corrected"].includes(event) && address) lines.push(`Dirección de entrega: ${address}`);
  if (event === "order.received" && s.deliveryTerms) lines.push(`Condición de entrega informada al comprar: ${s.deliveryTerms}`);
  if (event === "payment.declined" && retryUrl) lines.push(`Enlace consultado con Wompi. Revisa su disponibilidad actual en el proveedor: ${retryUrl}`);
  lines.push(`Atención: ${BUSINESS.email}`, `${BUSINESS.legalName} · NIT ${BUSINESS.nit}`);
  const detail = lines.slice(2, -2).map((line) => `<p style="margin:0 0 14px;line-height:1.6">${escape(line)}</p>`).join("");
  const button = retryUrl ? `<p><a href="${escape(retryUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 22px;text-decoration:none">Revisar pago en Wompi</a></p>` : "";
  return { subject: `${title} · ${s.orderNumber} — DIZOR`, text: lines.join("\n\n"),
    html: `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f7f7f7;color:#1a1a1a;font-family:Verdana,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:24px;background:#1a1a1a;color:#f5c37b;font-family:Georgia,serif;font-size:26px">DIZOR</td></tr><tr><td style="padding:24px;font-size:15px"><h1 style="font-family:Georgia,serif;font-size:25px;line-height:1.3">${escape(title)}</h1><p style="color:#5c5c5c">${escape(s.orderNumber)}</p>${detail}${button}<hr style="border:0;border-top:1px solid #e6e6e6"><p style="font-size:13px;line-height:1.6">Atención: ${escape(BUSINESS.email)}<br>${escape(BUSINESS.legalName)} · NIT ${escape(BUSINESS.nit)}</p></td></tr></table></td></tr></table></body></html>` };
};
