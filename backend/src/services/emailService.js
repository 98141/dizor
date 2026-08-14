const { Resend } = require("resend");

let resendClient = null;

const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
};

exports.sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const client = getResendClient();
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";
  const subject = "Recupera tu contraseña — Dizor";

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 22px; font-weight: 500;">Hola${name ? `, ${name}` : ""}</h1>
      <p>Recibimos una solicitud para restablecer tu contraseña en Dizor.</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #3d4f3a; color: #fff; text-decoration: none; border-radius: 4px;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size: 14px; color: #666;">Este enlace expira en 15 minutos. Si no solicitaste este cambio, ignora este correo.</p>
      <p style="font-size: 12px; color: #999;">Sombreros artesanales — Sandoná, Nariño</p>
    </div>
  `;

  if (!client) {
    console.log("[Dizor Auth] RESEND_API_KEY no configurada. Enlace de recuperación:");
    console.log(resetUrl);
    return { devMode: true };
  }

  const { error } = await client.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { devMode: false };
};

const TYPE_LABELS = {
  customization: "Personalización",
  wholesale: "Pedido al por mayor",
};

exports.sendSpecialRequestEmail = async (request) => {
  const client = getResendClient();
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_FROM;
  const typeLabel = TYPE_LABELS[request.type] || request.type;

  const summary =
    request.type === "wholesale"
      ? `${request.estimatedQuantity} uds — ${request.productsDescription?.slice(0, 120)}`
      : `${request.productName || "Producto"} — ${request.customizationDetails?.slice(0, 120)}`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto;">
      <h1 style="font-size: 20px;">Nueva solicitud ${typeLabel}</h1>
      <p><strong>${request.requestNumber}</strong></p>
      <p>${request.contact.name} · ${request.contact.email} · ${request.contact.phone}</p>
      <p>${summary}</p>
      <p style="font-size: 12px; color: #666;">Revisa el panel admin de Dizor.</p>
    </div>
  `;

  if (!client || !adminEmail) {
    console.log("[Dizor] Nueva solicitud especial:", request.requestNumber, typeLabel);
    return { devMode: true };
  }

  const { error } = await client.emails.send({
    from,
    to: adminEmail,
    subject: `[Dizor] Nueva solicitud ${request.requestNumber}`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { devMode: false };
};

const STATUS_LABELS = {
  wompi: "Wompi",
  nequi_manual: "Nequi",
  nequi_api: "Nequi",
  contra_entrega: "Contraentrega",
  efectivo: "Efectivo",
  nequi_presencial: "Nequi presencial",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const CARRIER_LABELS = {
  interrapidisimo: "Inter Rapidísimo",
  envia: "Envía",
  coordinadora: "Coordinadora",
};

exports.sendNewOrderAdminEmail = async (order) => {
  const client = getResendClient();
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_FROM;

  const itemsHtml = (order.items || [])
    .map(
      (i) =>
        `<li>${i.productName || "Producto"}${i.sizeName ? ` · ${i.sizeName}` : ""}${i.colorName ? ` · ${i.colorName}` : ""} × ${i.quantity} — $${Number(i.lineTotal || 0).toLocaleString("es-CO")} COP</li>`
    )
    .join("");

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 20px; font-weight: 500;">Nuevo pedido — ${order.orderNumber}</h1>
      <p>${order.buyer?.name || ""} · ${order.buyer?.email || ""} · ${order.buyer?.phone || ""}</p>
      <p>${order.shippingAddress?.address || ""}, ${order.shippingAddress?.city || ""}, ${order.shippingAddress?.department || ""}</p>
      <ul style="padding-left: 1.2rem; line-height: 1.6;">${itemsHtml}</ul>
      <p style="font-weight: 600;">Total: $${Number(order.total || 0).toLocaleString("es-CO")} COP</p>
      <p style="font-size: 14px; color: #666;">Método de pago: ${STATUS_LABELS[order.paymentMethod] || order.paymentMethod}</p>
      <p style="font-size: 12px; color: #999;">Revisa el panel admin de Dizor.</p>
    </div>
  `;

  if (!client || !adminEmail) {
    console.log("[Dizor] Nuevo pedido:", order.orderNumber);
    return { devMode: true };
  }

  const { error } = await client.emails.send({
    from,
    to: adminEmail,
    subject: `[Dizor] Nuevo pedido ${order.orderNumber}`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { devMode: false };
};

exports.sendOrderShippedEmail = async (order) => {
  const client = getResendClient();
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";

  if (!order.buyer?.email) {
    return { devMode: true, skipped: true };
  }

  const itemsHtml = (order.items || [])
    .map(
      (i) =>
        `<li>${i.productName || "Producto"}${i.sizeName ? ` · ${i.sizeName}` : ""}${i.colorName ? ` · ${i.colorName}` : ""} × ${i.quantity}</li>`
    )
    .join("");

  const carrierLabel = CARRIER_LABELS[order.carrier] || order.carrier || "";

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 22px; font-weight: 500;">Hola${order.buyer?.name ? `, ${order.buyer.name}` : ""}</h1>
      <p>Tu pedido <strong>${order.orderNumber}</strong> ya está en camino.</p>
      <p>
        ${carrierLabel ? `<strong>Transportadora:</strong> ${carrierLabel}<br/>` : ""}
        ${order.trackingNumber ? `<strong>Número de guía:</strong> ${order.trackingNumber}` : ""}
      </p>
      <ul style="padding-left: 1.2rem; line-height: 1.6;">${itemsHtml}</ul>
      <p style="font-size: 14px; color: #666;">Lo recibirás pronto en: ${order.shippingAddress?.address || ""}, ${order.shippingAddress?.city || ""}</p>
      <p style="font-size: 12px; color: #999;">Sombreros artesanales — Sandoná, Nariño</p>
    </div>
  `;

  if (!client) {
    console.log("[Dizor] Pedido enviado:", order.orderNumber, "→", order.buyer.email);
    return { devMode: true };
  }

  const { error } = await client.emails.send({
    from,
    to: order.buyer.email,
    subject: `Tu pedido ${order.orderNumber} fue enviado — Dizor`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { devMode: false };
};

exports.sendAbandonedCartEmail = async ({
  to,
  name,
  items,
  subtotal,
  cartUrl,
  subject,
}) => {
  const client = getResendClient();
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";

  const itemsHtml = (items || [])
    .slice(0, 5)
    .map(
      (i) =>
        `<li>${i.productName || "Producto"} × ${i.quantity} — $${Number(i.lineTotal || 0).toLocaleString("es-CO")} COP</li>`
    )
    .join("");

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 22px; font-weight: 500;">Hola${name ? `, ${name}` : ""}</h1>
      <p>Dejaste productos en tu carrito en Dizor. Aún están disponibles:</p>
      <ul style="padding-left: 1.2rem; line-height: 1.6;">${itemsHtml}</ul>
      <p style="font-weight: 600;">Subtotal aprox.: $${Number(subtotal || 0).toLocaleString("es-CO")} COP</p>
      <p>
        <a href="${cartUrl}" style="display: inline-block; padding: 12px 24px; background: #3d4f3a; color: #fff; text-decoration: none; border-radius: 4px;">
          Volver al carrito
        </a>
      </p>
      <p style="font-size: 12px; color: #999;">Sombreros artesanales — Sandoná, Nariño</p>
    </div>
  `;

  if (!client) {
    console.log("[Dizor] Recordatorio carrito abandonado para:", to);
    return { devMode: true };
  }

  const { error } = await client.emails.send({
    from,
    to,
    subject: subject || "Tu carrito te espera — Dizor",
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  return { devMode: false };
};
