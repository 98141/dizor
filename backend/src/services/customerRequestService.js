const crypto = require("crypto");
const validator = require("validator");
const { Resend } = require("resend");
const CustomerRequest = require("../models/customerRequest");
const { CATEGORY_TYPES, STATUSES } = require("../models/customerRequest");
const AppError = require("../utils/AppError");
const { issueAccessToken, matchesHash } = require("../utils/opaqueTokens");
const { hashToken } = require("../utils/cryptoUtils");
const { requireAuthorization, recordConsent } = require("./consentService");
const { PURPOSES } = require("../config/legalTexts");
const { BUSINESS } = require("../config/businessInfo");

// El canal público solo se habilita cuando el propietario confirme quién lo
// atiende y por qué medio (E-2). Mientras tanto responde 503: el software no
// debe aparentar un procedimiento que nadie atiende.
const isPublicChannelEnabled = () => process.env.PQR_PUBLIC_ENABLED === "true";

// Radicado no secuencial: evita adivinar radicados ajenos. Aun así, consultar
// exige además el código de acceso.
const generateRadicado = (date = new Date()) => {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `PQR-${ymd}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

const cleanString = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const formatPublic = (doc) => ({
  radicado: doc.radicado,
  category: doc.category,
  type: doc.type,
  status: doc.status,
  receivedAt: doc.receivedAt,
  history: (doc.history || []).map((h) => ({
    status: h.status,
    note: h.publicNote || "",
    changedAt: h.changedAt,
  })),
});

const formatAdmin = (doc) => ({
  id: doc._id,
  radicado: doc.radicado,
  category: doc.category,
  type: doc.type,
  status: doc.status,
  receivedAt: doc.receivedAt,
  contact: doc.contact,
  orderNumber: doc.orderNumber,
  description: doc.description,
  user: doc.user,
  history: doc.history,
  updatedAt: doc.updatedAt,
});

// Constancia al solicitante. Transporte inyectable para pruebas.
let transport = null;
const setRequestReceiptTransport = (fn) => {
  transport = fn;
};

const defaultTransport = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Dizor] (sin RESEND_API_KEY) Constancia de radicado no enviada");
    return { devMode: true };
  }
  const client = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || "Dizor <onboarding@resend.dev>";
  const { error } = await client.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  return { devMode: false };
};

const sendReceipt = async (doc, accessCode) => {
  const when = doc.receivedAt.toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 20px; font-weight: 500;">Recibimos tu solicitud</h1>
      <p><strong>Radicado:</strong> ${doc.radicado}<br/>
         <strong>Fecha y hora de recepción:</strong> ${when} (hora de Colombia)<br/>
         <strong>Código de consulta:</strong> ${accessCode}</p>
      <p>Con el radicado y el código puedes consultar el estado de tu solicitud.</p>
      <p>La recepción por el sitio es permanente; la atención personal es de ${BUSINESS.attentionHours}.
         Si necesitas añadir información, escríbenos a ${BUSINESS.email} indicando tu radicado.</p>
      <p style="font-size: 12px; color: #999;">${BUSINESS.legalName} (${BUSINESS.brand}) · NIT ${BUSINESS.nit}.
         Mensaje transaccional. No compartas tu código de consulta.</p>
    </div>`;
  try {
    await (transport || defaultTransport)({
      to: doc.contact.email,
      subject: `Radicado ${doc.radicado} — Dizor`,
      html,
    });
    return true;
  } catch {
    return false;
  }
};

// Aviso interno de nueva solicitud a la bandeja de atención (ADMIN_NOTIFY_EMAIL).
// Minimización: solo radicado, categoría, tipo y fecha; el detalle se consulta
// en el panel con sesión. Un fallo no impide radicar.
const notifyStaff = async (doc) => {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return false;
  const when = doc.receivedAt.toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1f1f1f;">
      <h1 style="font-size: 20px; font-weight: 500;">Nueva solicitud ${doc.radicado}</h1>
      <p>Categoría: ${doc.category} · Tipo: ${doc.type}<br/>Recibida: ${when} (hora de Colombia)</p>
      <p style="font-size: 12px; color: #999;">Revisa el detalle en el panel (Solicitudes).</p>
    </div>`;
  try {
    await (transport || defaultTransport)({
      to,
      subject: `[Dizor] Nueva solicitud ${doc.radicado}`,
      html,
    });
    return true;
  } catch {
    return false;
  }
};

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{16,100}$/;

// Busca una solicitud ya creada con la misma clave de idempotencia. Solo la
// reutiliza si coincide el correo (la clave nunca sirve para abrir solicitudes
// ajenas) y rota su código de consulta.
const resolveDuplicate = async (idempotencyKeyHash, email, newTokenHash) => {
  const existing = await CustomerRequest.findOne({ idempotencyKeyHash });
  if (!existing) return null;
  if (existing.contact.email !== email) {
    throw new AppError("No se pudo registrar la solicitud. Recarga la página e inténtalo de nuevo.", 409);
  }
  existing.accessTokenHash = newTokenHash;
  await existing.save();
  return existing;
};

/**
 * Radica una solicitud. Primero se PERSISTE; solo después se devuelve el
 * radicado (no se muestra éxito si no quedó guardada).
 */
const createCustomerRequest = async ({ body, user }) => {
  if (!isPublicChannelEnabled()) {
    throw new AppError(
      "Este canal aún no está habilitado. Mientras tanto, contáctanos por WhatsApp.",
      503
    );
  }

  requireAuthorization(body?.privacyAuthorization, PURPOSES.CUSTOMER_REQUEST);

  const category = cleanString(body?.category, 40);
  const type = cleanString(body?.type, 40);
  if (!CATEGORY_TYPES[category] || !CATEGORY_TYPES[category].includes(type)) {
    throw new AppError("Tipo de solicitud inválido", 400);
  }

  const name = cleanString(body?.name, 100);
  const email = cleanString(body?.email, 200).toLowerCase();
  const phone = cleanString(body?.phone, 30);
  const description = cleanString(body?.description, 3000);
  const orderNumber = cleanString(body?.orderNumber, 40).toUpperCase();

  if (!name) throw new AppError("El nombre es obligatorio", 400);
  if (!email || !validator.isEmail(email)) throw new AppError("Correo inválido", 400);
  if (description.length < 10) {
    throw new AppError("Describe tu solicitud (mínimo 10 caracteres)", 400);
  }

  // Idempotencia: el formulario envía una clave aleatoria por intento. Si la
  // respuesta se pierde y el cliente reintenta con la misma clave, no se crea
  // un segundo radicado: se devuelve el existente con un código nuevo (el
  // anterior queda invalidado) y se reenvía la constancia.
  const idemKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const idempotencyKeyHash = IDEMPOTENCY_KEY_PATTERN.test(idemKey) ? hashToken(idemKey) : null;

  const { token, tokenHash } = issueAccessToken();

  if (idempotencyKeyHash) {
    const existing = await resolveDuplicate(idempotencyKeyHash, email, tokenHash);
    if (existing) {
      const receiptSent = await sendReceipt(existing, token);
      return {
        radicado: existing.radicado,
        receivedAt: existing.receivedAt,
        category: existing.category,
        type: existing.type,
        accessCode: token,
        receiptSent,
        duplicate: true,
      };
    }
  }

  const receivedAt = new Date();

  let doc = null;
  for (let attempt = 0; attempt < 3 && !doc; attempt += 1) {
    try {
      doc = await CustomerRequest.create({
        radicado: generateRadicado(receivedAt),
        category,
        type,
        contact: { name, email, phone },
        orderNumber,
        description,
        status: "recibida",
        history: [{ status: "recibida", changedAt: receivedAt }],
        user: user?.id || null,
        accessTokenHash: tokenHash,
        idempotencyKeyHash,
        receivedAt,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Reintento concurrente con la misma clave: devolver el existente.
      if (idempotencyKeyHash && err?.keyPattern?.idempotencyKeyHash) {
        const existing = await resolveDuplicate(idempotencyKeyHash, email, tokenHash);
        if (existing) {
          const receiptSent = await sendReceipt(existing, token);
          return {
            radicado: existing.radicado,
            receivedAt: existing.receivedAt,
            category: existing.category,
            type: existing.type,
            accessCode: token,
            receiptSent,
            duplicate: true,
          };
        }
      }
      // Si no, fue una colisión de radicado: reintentar con otro.
    }
  }
  if (!doc) throw new AppError("No se pudo registrar la solicitud. Intenta de nuevo.", 500);

  await recordConsent({
    purpose: PURPOSES.CUSTOMER_REQUEST,
    subjectEmail: email,
    userId: user?.id || null,
    source: `customer_request:${category}`,
    referenceType: "CustomerRequest",
    referenceId: doc._id,
  });

  const receiptSent = await sendReceipt(doc, token);
  await notifyStaff(doc);

  return {
    radicado: doc.radicado,
    receivedAt: doc.receivedAt,
    category: doc.category,
    type: doc.type,
    accessCode: token,
    receiptSent,
  };
};

/** Seguimiento público: radicado + código. Respuesta 404 genérica. */
const trackCustomerRequest = async ({ radicado, accessCode }) => {
  const r = cleanString(radicado, 40).toUpperCase();
  const code = cleanString(accessCode, 128);
  const doc = r
    ? await CustomerRequest.findOne({ radicado: r }).select("+accessTokenHash")
    : null;
  if (!doc || !matchesHash(code, doc.accessTokenHash)) {
    throw new AppError("Solicitud no encontrada", 404);
  }
  return formatPublic(doc);
};

const listForAdmin = async ({ category, status, page = 1, limit = 30 }) => {
  const filter = {};
  if (category && CATEGORY_TYPES[category]) filter.category = category;
  if (status && STATUSES.includes(status)) filter.status = status;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, parseInt(limit, 10) || 30);
  const [docs, total] = await Promise.all([
    CustomerRequest.find(filter).sort({ receivedAt: -1 }).skip((p - 1) * l).limit(l),
    CustomerRequest.countDocuments(filter),
  ]);
  return { requests: docs.map(formatAdmin), total, page: p };
};

const getForAdmin = async (id) => {
  const doc = await CustomerRequest.findById(id);
  if (!doc) throw new AppError("Solicitud no encontrada", 404);
  return formatAdmin(doc);
};

const updateStatusByAdmin = async (id, { status, publicNote, internalNote }, userId) => {
  if (!STATUSES.includes(status)) throw new AppError("Estado inválido", 400);
  const doc = await CustomerRequest.findById(id);
  if (!doc) throw new AppError("Solicitud no encontrada", 404);
  doc.status = status;
  doc.history.push({
    status,
    publicNote: cleanString(publicNote, 2000),
    internalNote: cleanString(internalNote, 2000),
    changedBy: userId || null,
    changedAt: new Date(),
  });
  await doc.save();
  return formatAdmin(doc);
};

module.exports = {
  isPublicChannelEnabled,
  createCustomerRequest,
  trackCustomerRequest,
  listForAdmin,
  getForAdmin,
  updateStatusByAdmin,
  setRequestReceiptTransport,
  generateRadicado,
};
