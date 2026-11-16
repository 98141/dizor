const crypto = require("crypto");
const { hashToken, createRandomToken } = require("./cryptoUtils");

// ─── Tokens de acceso aleatorios (pedido de invitado, seguimiento de PQR) ──
// Se entrega el token en claro una sola vez al solicitante y se guarda solo
// su hash. Comparación en tiempo constante.

const issueAccessToken = () => {
  const token = createRandomToken();
  return { token, tokenHash: hashToken(token) };
};

const matchesHash = (token, storedHash) => {
  if (typeof token !== "string" || !token || !storedHash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// ─── Tokens firmados de baja comercial ─────────────────────────────────────
// Formato: <finalidad>.<id del documento>.<firma HMAC>. No contienen el
// correo ni ningún dato personal; el id es un ObjectId interno. Son
// deterministas (la baja es idempotente: el mismo enlace sirve siempre).

const MIN_SECRET_LENGTH = 32;

const getUnsubscribeSecret = () => {
  const secret = process.env.MARKETING_TOKEN_SECRET || "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
};

const isUnsubscribeConfigured = () => Boolean(getUnsubscribeSecret());

const sign = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("base64url");

const createUnsubscribeToken = (purpose, docId) => {
  const secret = getUnsubscribeSecret();
  if (!secret) return null;
  const payload = `${purpose}.${String(docId)}`;
  return `${payload}.${sign(payload, secret)}`;
};

const verifyUnsubscribeToken = (token) => {
  const secret = getUnsubscribeSecret();
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [purpose, docId, signature] = parts;
  if (!/^[a-f0-9]{24}$/i.test(docId)) return null;
  const expected = sign(`${purpose}.${docId}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { purpose, docId };
};

module.exports = {
  issueAccessToken,
  matchesHash,
  isUnsubscribeConfigured,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
};
