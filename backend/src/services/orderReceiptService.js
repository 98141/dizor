const { Resend } = require("resend");
const Order = require("../models/order");
const { BUSINESS } = require("../config/businessInfo");

// ─── Acuse de recibo del pedido al comprador (H-20) ────────────────────────
// Correo TRANSACCIONAL (no comercial): sin enlace de baja ni contenido
// promocional. Ley 1480, art. 50 lit. d: a más tardar el día calendario
// siguiente, con información del tiempo de entrega, precio exacto incluidos
// impuestos, gastos de envío y forma de pago.
//
// Limitaciones conocidas (no se inventan datos):
//   - Tiempo de entrega: se incluye el plazo que el comprador vio antes de
//     confirmar (order.legal.deliveryTermsText, de config/deliveryTerms.js).
//     Mientras no esté definido (E-10), el correo lo dice y H-20/H-21 siguen
//     abiertos.
//   - Identificación del vendedor: config/businessInfo.js (E-1 recibido).
//
// Idempotencia: el envío se "reclama" de forma atómica en el pedido
// (buyerReceipt.claimedAt) antes de llamar al proveedor, de modo que un
// reintento de la misma petición o un doble clic no duplican el correo.

const PAYMENT_LABELS = {
  wompi: "Wompi (tarjeta, PSE u otro medio elegido en Wompi)",
  nequi_manual: "Nequi (transferencia manual)",
  nequi_api: "Nequi",
  contra_entrega: "Pago contra entrega",
  efectivo: "Efectivo",
  nequi_presencial: "Nequi presencial",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const PAYMENT_STATUS_TEXT = {
  pendiente: "Pago pendiente",
  pagado: "Pago aprobado",
  rechazado: "Pago rechazado",
  reembolsado: "Pago reembolsado",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtCop = (n) => `$${Number(n || 0).toLocaleString("es-CO")} COP`;

const buildOrderReceivedEmail = (order) => {
  const deliveryText = String(order.legal?.deliveryTermsText || "").trim();

  const lines = (order.items || [])
    .map((i) => {
      const variant = [i.sizeName, i.colorName].filter(Boolean).map(escapeHtml).join(" · ");
      return `<tr>
        <td style="padding:4px 8px 4px 0;">${escapeHtml(i.productName || "Producto")}${variant ? ` · ${variant}` : ""}</td>
        <td style="padding:4px 8px; text-align:center;">${Number(i.quantity)}</td>
        <td style="padding:4px 8px; text-align:right;">${fmtCop(i.unitPrice)}</td>
        <td style="padding:4px 0 4px 8px; text-align:right;">${fmtCop(i.lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const totals = [
    ["Subtotal", fmtCop(order.subtotal)],
    ...(order.discountTotal > 0
      ? [[`Descuento${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}`, `−${fmtCop(order.discountTotal)}`]]
      : []),
    ...(order.taxTotal > 0 ? [[`IVA (${Number(order.ivaPercent || 0)}%)`, fmtCop(order.taxTotal)]] : []),
    [
      "Envío",
      order.shippingIncluded
        ? "Incluido en el precio"
        : order.shippingCost > 0
          ? fmtCop(order.shippingCost)
          : "Sin costo",
    ],
    ["Total", fmtCop(order.total)],
  ]
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;">${k}</td><td style="padding:2px 0; text-align:right;">${v}</td></tr>`)
    .join("");

  const createdAt = new Date(order.createdAt || Date.now()).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
  });

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 20px; font-weight: 500;">Recibimos tu pedido ${escapeHtml(order.orderNumber)}</h1>
      <p>Fecha del pedido: ${escapeHtml(createdAt)}</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <thead><tr>
          <th style="text-align:left; padding:4px 8px 4px 0;">Producto</th>
          <th style="padding:4px 8px;">Cant.</th>
          <th style="text-align:right; padding:4px 8px;">Precio unitario</th>
          <th style="text-align:right; padding:4px 0 4px 8px;">Subtotal</th>
        </tr></thead>
        <tbody>${lines}</tbody>
      </table>
      <table style="margin-top:12px; margin-left:auto; font-size:14px;">${totals}</table>
      <p><strong>Forma de pago:</strong> ${escapeHtml(PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod)}<br/>
         <strong>Estado del pago:</strong> ${escapeHtml(PAYMENT_STATUS_TEXT[order.paymentStatus] || order.paymentStatus)}</p>
      <p><strong>Tiempo de entrega:</strong> ${
        deliveryText ? escapeHtml(deliveryText) : "te lo confirmaremos por este medio."
      }</p>
      ${order.paymentMethod === "contra_entrega"
        ? "<p>Pagarás el total al recibir el pedido. Hasta entonces el pago figura como pendiente.</p>"
        : ""}
      <p>Si tienes una duda o una solicitud sobre este pedido, escríbenos a ${escapeHtml(BUSINESS.email)}
         indicando el número de pedido (atención: ${escapeHtml(BUSINESS.attentionHours)}).</p>
      <p style="font-size: 12px; color: #999;">Vendedor: ${escapeHtml(BUSINESS.legalName)} (${escapeHtml(BUSINESS.brand)}),
         NIT ${escapeHtml(BUSINESS.nit)}. Mensaje transaccional sobre tu compra.</p>
    </div>
  `;

  return {
    subject: `Recibimos tu pedido ${order.orderNumber} — Dizor`,
    html,
    includesDeliveryTime: Boolean(deliveryText),
  };
};

// Inyectable en pruebas para no depender de Resend ni de la red.
let transport = null;
const setReceiptTransport = (fn) => {
  transport = fn;
};

const defaultTransport = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Dizor] (sin RESEND_API_KEY) Acuse de recibo no enviado");
    return { devMode: true };
  }
  const client = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";
  const { error } = await client.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  return { devMode: false };
};

/**
 * Envía el acuse una sola vez por pedido. Devuelve { sent, reason }.
 * Un fallo del proveedor libera la reclamación para permitir un reintento
 * posterior y deja constancia del error (sin datos personales).
 */
const sendOrderReceiptOnce = async (orderId) => {
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, "buyerReceipt.claimedAt": null, "buyer.email": { $nin: [null, ""] } },
    { $set: { "buyerReceipt.claimedAt": new Date() }, $inc: { "buyerReceipt.attempts": 1 } },
    { new: true }
  );
  if (!claimed) return { sent: false, reason: "already_sent_or_no_email" };

  const { subject, html } = buildOrderReceivedEmail(claimed);
  try {
    await (transport || defaultTransport)({ to: claimed.buyer.email, subject, html });
    await Order.updateOne(
      { _id: orderId },
      { $set: { "buyerReceipt.sentAt": new Date(), "buyerReceipt.lastError": "" } }
    );
    return { sent: true };
  } catch (err) {
    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          "buyerReceipt.claimedAt": null,
          "buyerReceipt.lastError": String(err.message || "error").slice(0, 200),
        },
      }
    );
    return { sent: false, reason: "provider_error" };
  }
};

module.exports = {
  buildOrderReceivedEmail,
  sendOrderReceiptOnce,
  setReceiptTransport,
};
