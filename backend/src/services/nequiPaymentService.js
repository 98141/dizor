const crypto = require("crypto");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getNequiEnv = () => process.env.NEQUI_ENV || "mock";

const getBaseUrl = () => {
  switch (getNequiEnv()) {
    case "production": return "https://api.connect.nequi.co";
    case "sandbox":    return "https://api.sandbox.connect.nequi.co";
    default:           return null; // mock: no HTTP calls
  }
};

// Normalize Colombian mobile numbers to 10-digit format (3XXXXXXXXX)
const normalizePhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0"))  return digits.slice(1);
  return digits;
};

exports.normalizePhone = normalizePhone;

// ─── Configuration check ──────────────────────────────────────────────────────

exports.isNequiConfigured = () => {
  if (getNequiEnv() === "mock") return true; // mock siempre disponible
  return Boolean(
    process.env.NEQUI_CLIENT_ID &&
    process.env.NEQUI_CLIENT_SECRET &&
    process.env.NEQUI_API_KEY
  );
};

// ─── OAuth2 token cache ───────────────────────────────────────────────────────

let _tokenCache = null;

const getAccessToken = async () => {
  if (getNequiEnv() === "mock") return "mock-access-token";

  // Reusar token si quedan más de 60 s de vida
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.token;
  }

  const baseUrl = getBaseUrl();
  const credentials = Buffer.from(
    `${process.env.NEQUI_CLIENT_ID}:${process.env.NEQUI_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${baseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=profile",
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Nequi auth falló: ${json?.error_description || JSON.stringify(json)}`
    );
  }

  const expiresIn = json.expires_in || 3600;
  _tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return _tokenCache.token;
};

// ─── Crear cobro push ─────────────────────────────────────────────────────────
// Envía notificación push al celular del cliente en su app Nequi.
// El cliente aprueba/rechaza y Nequi notifica vía webhook o el backend consulta.

exports.createNequiCharge = async (order, rawPhone) => {
  const phoneNumber = normalizePhone(rawPhone);

  if (getNequiEnv() === "mock") {
    return {
      paymentToken: `mock-${crypto.randomBytes(8).toString("hex")}`,
      status: "PENDING",
    };
  }

  const token   = await getAccessToken();
  const baseUrl = getBaseUrl();
  const apiKey  = process.env.NEQUI_API_KEY;

  // Nequi usa enteros COP sin decimales
  const amount    = String(Math.round(order.total));
  const requestId = crypto.randomUUID();

  const res = await fetch(`${baseUrl}/payments/v2/-/transactions/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notificationPayment",
      id: requestId,
      params: {
        timestamp: new Date().toISOString(),
        value: {
          code:        process.env.NEQUI_CLIENT_ID,
          message:     `Pago pedido ${order.orderNumber} - Dizor`,
          amount,
          phoneNumber,
          reference:   order.orderNumber,
        },
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Error Nequi (${res.status}): ${JSON.stringify(json)}`);
  }

  const result = json?.result?.value;
  if (!result || result?.status?.status !== "OK") {
    const desc = result?.status?.statusDesc || "Error al crear cobro en Nequi";
    throw new Error(desc);
  }

  return {
    paymentToken: result.paymentToken,
    status: "PENDING",
  };
};

// ─── Consultar estado de un cobro ─────────────────────────────────────────────

exports.getChargeStatus = async (paymentToken) => {
  if (getNequiEnv() === "mock") {
    return { status: "PENDING" };
  }

  const token   = await getAccessToken();
  const baseUrl = getBaseUrl();
  const apiKey  = process.env.NEQUI_API_KEY;

  const res = await fetch(
    `${baseUrl}/payments/v2/-/transactions/charges/${encodeURIComponent(paymentToken)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": apiKey,
      },
    }
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Error al consultar estado Nequi: ${JSON.stringify(json)}`);
  }

  const result     = json?.result?.value;
  // El código de estado puede venir en distintas rutas según la versión de la API
  const statusCode =
    result?.statusCode ||
    result?.status?.statusCode ||
    "PENDING";

  return { status: statusCode };
};

// ─── Verificar firma del webhook ──────────────────────────────────────────────
// Nequi firma el cuerpo con HMAC-SHA256 usando NEQUI_WEBHOOK_SECRET.
// Cabecera esperada: x-nequi-signature (formato: sha256=<hex>)
// NOTA: Confirmar cabecera exacta con la documentación oficial al activar producción.

exports.verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (getNequiEnv() === "mock") return true;

  const secret = process.env.NEQUI_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const sig = String(signatureHeader).replace(/^sha256=/, "");
  if (sig.length !== 64) return false; // SHA-256 hex = 64 chars

  const calculated = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, "hex"),
      Buffer.from(sig, "hex")
    );
  } catch {
    return false;
  }
};

// ─── Traducir estado Nequi a estado interno ───────────────────────────────────

exports.mapNequiStatus = (nequiStatus) => {
  switch (nequiStatus) {
    case "USER_APPROVED": return "approved";
    case "USER_DECLINED": return "declined";
    case "EXPIRED":       return "expired";
    default:              return "pending";
  }
};
