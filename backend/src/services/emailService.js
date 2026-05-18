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
