const crypto = require("crypto");

const getBaseUrl = () => {
  const env = process.env.WOMPI_ENV || "sandbox";
  return env === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
};

exports.isWompiConfigured = () =>
  Boolean(process.env.WOMPI_PRIVATE_KEY && process.env.WOMPI_EVENTS_SECRET);

exports.createPaymentLink = async (order) => {
  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Wompi no configurado");
  }

  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const amountInCents = Math.round(order.total * 100);

  const body = {
    name: `Pedido ${order.orderNumber}`,
    description: `Compra en Dizor — ${order.orderNumber}`,
    single_use: true,
    collect_shipping: false,
    currency: "COP",
    amount_in_cents: amountInCents,
    sku: order.orderNumber.slice(0, 36),
    redirect_url: `${clientUrl}/pedido/confirmacion?order=${encodeURIComponent(order.orderNumber)}&payment=wompi`,
  };

  const res = await fetch(`${getBaseUrl()}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${privateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    const msg =
      json?.error?.reason ||
      json?.error?.message ||
      "No se pudo crear el enlace de pago Wompi";
    throw new Error(msg);
  }

  const linkId = json?.data?.id;
  if (!linkId) {
    throw new Error("Respuesta inválida de Wompi");
  }

  return {
    paymentLinkId: linkId,
    paymentLinkUrl: `https://checkout.wompi.co/l/${linkId}`,
  };
};

exports.verifyEventChecksum = (eventBody, checksumHeader) => {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret || !eventBody?.signature || !checksumHeader) {
    return false;
  }

  // Anti-replay: rechazar eventos con más de 5 minutos de antigüedad o del futuro
  const eventTimestamp = eventBody.timestamp;
  if (!eventTimestamp) return false;
  const ageMs = Date.now() - eventTimestamp * 1000;
  if (ageMs > 5 * 60 * 1000 || ageMs < -60 * 1000) {
    return false;
  }

  const { properties } = eventBody.signature;
  const timestamp = eventBody.timestamp;
  let chain = "";

  for (const prop of properties || []) {
    const parts = prop.split(".");
    let value = eventBody.data;
    for (const part of parts) {
      value = value?.[part];
    }
    chain += value ?? "";
  }

  chain += String(timestamp ?? "");
  chain += secret;

  const calculated = crypto.createHash("sha256").update(chain).digest("hex").toUpperCase();
  const received = String(checksumHeader).toUpperCase();

  // Comparación en tiempo constante: evita un canal lateral de temporización
  // (timing attack) al comparar el checksum. timingSafeEqual exige buffers de
  // igual longitud, por eso se valida el tamaño antes.
  const a = Buffer.from(calculated, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
