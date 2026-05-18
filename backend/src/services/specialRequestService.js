const SpecialRequest = require("../models/specialRequest");
const Product = require("../models/product");

const generateRequestNumber = async () => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const prefix = `SOL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const count = await SpecialRequest.countDocuments({
    createdAt: { $gte: startOfDay },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

const pushStatusHistory = (doc, status, note, userId) => {
  doc.statusHistory.push({
    status,
    note: note || "",
    changedBy: userId || null,
    changedAt: new Date(),
  });
};

exports.formatRequestPublic = (doc) => ({
  id: doc._id,
  requestNumber: doc.requestNumber,
  type: doc.type,
  status: doc.status,
  contact: {
    name: doc.contact.name,
    email: doc.contact.email,
    phone: doc.contact.phone,
    company: doc.contact.company || "",
  },
  productName: doc.productName,
  productSlug: doc.productSlug,
  variantSummary: doc.variantSummary,
  quantity: doc.quantity,
  customizationDetails: doc.customizationDetails,
  selectedOptions: doc.selectedOptions,
  productsDescription: doc.productsDescription,
  estimatedQuantity: doc.estimatedQuantity,
  estimatedBudget: doc.estimatedBudget,
  deliveryDepartment: doc.deliveryDepartment,
  desiredTimeline: doc.desiredTimeline,
  customerNotes: doc.customerNotes,
  quotedAmount: doc.quotedAmount,
  quotedCurrency: doc.quotedCurrency,
  quotedAt: doc.quotedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

exports.formatRequestAdmin = (doc) => ({
  ...exports.formatRequestPublic(doc),
  adminNotes: doc.adminNotes,
  assignedTo: doc.assignedTo,
  statusHistory: doc.statusHistory,
  user: doc.user,
});

exports.createRequest = async ({ body, user }) => {
  const { type } = body;

  if (!["customization", "wholesale"].includes(type)) {
    const err = new Error("Tipo de solicitud inválido");
    err.statusCode = 400;
    throw err;
  }

  const contact = {
    name: body.contact?.name?.trim() || body.name?.trim(),
    email: (body.contact?.email || body.email || "").trim().toLowerCase(),
    phone: (body.contact?.phone || body.phone || "").trim(),
    company: (body.contact?.company || body.company || "").trim(),
  };

  if (!contact.name || !contact.email || !contact.phone) {
    const err = new Error("Nombre, correo y teléfono son obligatorios");
    err.statusCode = 400;
    throw err;
  }

  const payload = {
    requestNumber: await generateRequestNumber(),
    type,
    user: user?.id || null,
    contact,
    customerNotes: body.customerNotes?.trim() || "",
    statusHistory: [],
  };

  if (type === "customization") {
    if (!body.customizationDetails?.trim()) {
      const err = new Error("Describe la personalización que necesitas");
      err.statusCode = 400;
      throw err;
    }

    payload.quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
    payload.customizationDetails = body.customizationDetails.trim();
    payload.selectedOptions = Array.isArray(body.selectedOptions)
      ? body.selectedOptions.filter(Boolean)
      : [];
    payload.variantSummary = body.variantSummary?.trim() || "";

    if (body.productId) {
      const product = await Product.findById(body.productId);
      if (product) {
        payload.product = product._id;
        payload.productName = product.name;
        payload.productSlug = product.slug;
      }
    } else {
      payload.productName = body.productName?.trim() || "";
      payload.productSlug = body.productSlug?.trim() || "";
    }
  }

  if (type === "wholesale") {
    if (!body.productsDescription?.trim()) {
      const err = new Error("Describe los productos que necesitas");
      err.statusCode = 400;
      throw err;
    }

    const qty = parseInt(body.estimatedQuantity, 10);
    if (!qty || qty < 5) {
      const err = new Error("El pedido al por mayor requiere mínimo 5 unidades");
      err.statusCode = 400;
      throw err;
    }

    payload.productsDescription = body.productsDescription.trim();
    payload.estimatedQuantity = qty;
    payload.estimatedBudget =
      body.estimatedBudget != null && body.estimatedBudget !== ""
        ? Number(body.estimatedBudget)
        : null;
    payload.deliveryDepartment = body.deliveryDepartment?.trim() || "";
    payload.desiredTimeline = body.desiredTimeline?.trim() || "";
  }

  const doc = await SpecialRequest.create(payload);
  pushStatusHistory(doc, "pendiente", "Solicitud recibida", null);
  await doc.save();

  return doc;
};

exports.pushStatusHistory = pushStatusHistory;
