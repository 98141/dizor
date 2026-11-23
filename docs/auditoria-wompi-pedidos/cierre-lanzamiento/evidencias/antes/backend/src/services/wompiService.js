const crypto = require("crypto");
const AppError = require("../utils/AppError");

const queryError = (code, message, status = 503) => Object.assign(new AppError(message, status), { code });

const getBaseUrl = () => {
  const env = process.env.WOMPI_ENV || "sandbox";
  return env === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
};

exports.isWompiConfigured = () =>
  Boolean(process.env.WOMPI_PRIVATE_KEY && process.env.WOMPI_EVENTS_SECRET);

exports.validateConfiguration = (env = process.env) => {
  const mode = env.WOMPI_ENV || "sandbox";
  if (!["sandbox", "production"].includes(mode) || (env.NODE_ENV === "production" && mode !== "production")) throw new Error("Configuración de ambiente Wompi inválida");
  if (!env.WOMPI_PRIVATE_KEY && !env.WOMPI_EVENTS_SECRET) return;
  const prefix = mode === "production" ? "prod" : "test";
  if (!env.WOMPI_PRIVATE_KEY?.startsWith(`prv_${prefix}_`) || !env.WOMPI_EVENTS_SECRET?.startsWith(`${prefix}_events_`)) throw new Error("Llaves Wompi incompatibles con el ambiente");
};

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
    signal: AbortSignal.timeout(10000),
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
    expiresAt: exports.parseProviderExpiry(json.data.expires_at),
  };
};

// Wompi reintenta un evento no confirmado hasta 3 veces en 24 h (30 min,
// 3 h y 24 h; documentación oficial de eventos). Una ventana de 5 minutos
// rechazaba esos reintentos legítimos. Se acepta hasta 26 h; la repetición
// de un evento ya aplicado es inocua porque el procesamiento es idempotente
// y nunca degrada un pedido pagado (wompiWebhookController).
const EVENT_MAX_AGE_MS = 26 * 60 * 60 * 1000;

// Entorno esperado en `event.environment` según WOMPI_ENV.
exports.getExpectedEventEnvironment = () =>
  (process.env.WOMPI_ENV || "sandbox") === "production" ? "prod" : "test";

exports.verifyEventChecksum = (eventBody, checksumHeader) => {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  // El checksum llega en la cabecera X-Event-Checksum o en signature.checksum.
  const receivedChecksum = checksumHeader || eventBody?.signature?.checksum;
  if (!secret || !eventBody?.signature || !receivedChecksum) {
    return false;
  }

  // Anti-replay: rechazar eventos demasiado antiguos o del futuro.
  const eventTimestamp = eventBody.timestamp;
  if (!Number.isSafeInteger(eventTimestamp) || eventTimestamp <= 0) return false;
  const ageMs = Date.now() - eventTimestamp * 1000;
  if (ageMs > EVENT_MAX_AGE_MS || ageMs < -60 * 1000) {
    return false;
  }

  const { properties } = eventBody.signature;
  if (!Array.isArray(properties) || !["transaction.id", "transaction.status", "transaction.amount_in_cents"].every((p) => properties.includes(p)) || !properties.every((p) => typeof p === "string")) return false;
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
  const received = String(receivedChecksum).toUpperCase();

  // Comparación en tiempo constante: evita un canal lateral de temporización
  // (timing attack) al comparar el checksum. timingSafeEqual exige buffers de
  // igual longitud, por eso se valida el tamaño antes.
  const a = Buffer.from(calculated, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// Wompi documents timezone-less link timestamps as UTC. Never use host timezone.
exports.parseProviderExpiry = (value) => {
  if (typeof value !== "string" || !value) return null;
  const utc = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(utc);
  return Number.isFinite(date.getTime()) ? date : null;
};
exports.getTransaction = async (id) => {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(id)) throw queryError("WOMPI_TRANSACTION_ID_INVALID", "ID de transacción inválido", 409);
  if (!process.env.WOMPI_PRIVATE_KEY) throw queryError("WOMPI_QUERY_UNAVAILABLE", "Consulta Wompi no disponible");
  let res;
  try {
    res = await fetch(`${getBaseUrl()}/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}` }, signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throw queryError(["TimeoutError", "AbortError"].includes(err.name) ? "WOMPI_QUERY_TIMEOUT" : "WOMPI_QUERY_UNAVAILABLE", "Consulta Wompi temporalmente no disponible");
  }
  if (res.status === 404) throw queryError("WOMPI_TRANSACTION_NOT_FOUND", "ID no encontrado en este ambiente", 409);
  if (!res.ok) throw queryError("WOMPI_QUERY_HTTP_ERROR", "Consulta Wompi no disponible");
  let json;
  try { json = await res.json(); } catch { throw queryError("WOMPI_INVALID_TRANSACTION_RESPONSE", "Respuesta Wompi inválida"); }
  if (json?.data?.id !== id) throw queryError("WOMPI_INVALID_TRANSACTION_RESPONSE", "Identidad de respuesta Wompi inválida");
  return json.data;
};

exports.getPaymentLink = async (id) => {
  const res = await fetch(`${getBaseUrl()}/payment_links/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Payment link verification unavailable");
  const json = await res.json();
  if (json?.data?.id !== id) throw new Error("Invalid payment link response");
  return json.data;
};
