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

const validSecret = (value) =>
  typeof value === "string" && value.length >= MIN_SECRET_LENGTH ? value : null;

// Secreto vigente: firma los enlaces nuevos.
const getUnsubscribeSecret = () => validSecret(process.env.MARKETING_TOKEN_SECRET || "");

// Secreto anterior (opcional): solo VERIFICA enlaces ya enviados tras una
// rotación, para que los correos antiguos sigan permitiendo darse de baja.
const getPreviousUnsubscribeSecret = () =>
  validSecret(process.env.MARKETING_TOKEN_SECRET_PREVIOUS || "");

const isUnsubscribeConfigured = () => Boolean(getUnsubscribeSecret());

const sign = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("base64url");

const createUnsubscribeToken = (purpose, docId) => {
  const secret = getUnsubscribeSecret();
  if (!secret) return null;
  const payload = `${purpose}.${String(docId)}`;
  return `${payload}.${sign(payload, secret)}`;
};

const signatureMatches = (payload, signature, secret) => {
  if (!secret) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(payload, secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyUnsubscribeToken = (token) => {
  const current = getUnsubscribeSecret();
  const previous = getPreviousUnsubscribeSecret();
  if ((!current && !previous) || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [purpose, docId, signature] = parts;
  if (!/^[a-f0-9]{24}$/i.test(docId)) return null;
  const payload = `${purpose}.${docId}`;
  if (!signatureMatches(payload, signature, current) && !signatureMatches(payload, signature, previous)) {
    return null;
  }
  return { purpose, docId };
};

module.exports = {
  issueAccessToken,
  matchesHash,
  isUnsubscribeConfigured,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
};
