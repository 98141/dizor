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

  await client.emails.send({
    from,
    to,
    subject,
    html,
  });

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

  await client.emails.send({
    from,
    to: adminEmail,
    subject: `[Dizor] Nueva solicitud ${request.requestNumber}`,
    html,
  });

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

  await client.emails.send({
    from,
    to,
    subject: subject || "Tu carrito te espera — Dizor",
    html,
  });

  return { devMode: false };
};
