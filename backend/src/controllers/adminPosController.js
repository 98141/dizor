const PosOrder = require("../models/posOrder");
const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const formatMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

const generatePosNumber = async () => {
  const today = new Date();
  const prefix = `POS-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start.getTime() + 86400000);
  const count = await PosOrder.countDocuments({ createdAt: { $gte: start, $lt: end } });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
};

exports.searchProducts = catchAsync(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ products: [] });

  const products = await Product.find({
    isActive: true,
    $or: [
      { name: { $regex: q, $options: "i" } },
      { "variants.sku": { $regex: q, $options: "i" } },
    ],
  })
    .select("name mainImage variants salePrice")
    .populate("variants.size", "name")
    .populate("variants.color", "name")
    .limit(20)
    .lean();

  const results = [];
  for (const p of products) {
    for (const v of p.variants || []) {
      if (v.isActive === false) continue;
      if ((v.stock || 0) <= 0) continue;
      results.push({
        productId: p._id,
        variantId: v._id,
        productName: p.name,
        productImage: p.mainImage || "",
        sizeName: v.size?.name || "",
        colorName: v.color?.name || "",
        sku: v.sku || "",
        stock: v.stock || 0,
        unitPrice: v.price != null ? v.price : (p.salePrice || 0),
      });
    }
  }

  res.json({ products: results });
});

exports.createPosSale = catchAsync(async (req, res, next) => {
  const { customerName, items, paymentMethod, cashReceived, discountAmount, notes } =
    req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return next(new AppError("Agrega al menos un producto", 400));
  }
  if (!paymentMethod) {
    return next(new AppError("Selecciona un método de pago", 400));
  }

  const safeItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId).select("+internalCost salePrice name variants");
    if (!product) {
      return next(new AppError(`Producto no encontrado: ${item.productId}`, 404));
    }

    const variant = product.variants.id(item.variantId);
    if (!variant) {
      return next(new AppError("Variante no encontrada", 404));
    }

    const qty = Number(item.quantity) || 1;

    if (variant.stock < qty) {
      return next(
        new AppError(
          `Stock insuficiente para ${product.name} (disponible: ${variant.stock})`,
          400
        )
      );
    }

    const unitPrice =
      item.unitPrice != null
        ? Number(item.unitPrice)
        : variant.price != null
        ? variant.price
        : product.salePrice || 0;

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    safeItems.push({
      productId: product._id,
      variantId: variant._id,
      productName: product.name,
      sizeName: item.sizeName || "",
      colorName: item.colorName || "",
      sku: variant.sku || "",
      quantity: qty,
      unitPrice,
      lineTotal,
    });
  }

  const discount = Math.max(0, Number(discountAmount) || 0);
  const total = Math.max(0, subtotal - discount);

  await Promise.all(
    safeItems.map((item) =>
      Product.findOneAndUpdate(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": -item.quantity } }
      )
    )
  );

  const posOrderNumber = await generatePosNumber();

  const cashIn = paymentMethod === "efectivo" ? (Number(cashReceived) || total) : 0;
  const changeOut = paymentMethod === "efectivo" ? Math.max(0, cashIn - total) : 0;

  const sale = await PosOrder.create({
    posOrderNumber,
    customerName: (customerName || "").trim() || "Cliente mostrador",
    items: safeItems,
    subtotal,
    discountAmount: discount,
    total,
    paymentMethod,
    cashReceived: cashIn,
    changeGiven: changeOut,
    soldBy: req.user._id,
    notes: (notes || "").trim(),
  });

  await sale.populate("soldBy", "name");

  res.status(201).json({ sale });
});

exports.getPosSales = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 30);
  const skip = (page - 1) * limit;

  const day = req.query.date ? new Date(req.query.date) : new Date();
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day.getTime() + 86400000);

  const filter = {
    createdAt: { $gte: day, $lt: nextDay },
    ...(req.query.includeVoided !== "true" ? { isVoided: false } : {}),
  };

  const [sales, total] = await Promise.all([
    PosOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("soldBy", "name"),
    PosOrder.countDocuments(filter),
  ]);

  res.json({ sales, total, page, totalPages: Math.ceil(total / limit) || 1 });
});

exports.voidPosSale = catchAsync(async (req, res, next) => {
  const sale = await PosOrder.findById(req.params.id);
  if (!sale) return next(new AppError("Venta no encontrada", 404));
  if (sale.isVoided) return next(new AppError("Esta venta ya fue anulada", 400));

  sale.isVoided = true;
  sale.voidedAt = new Date();
  sale.voidedBy = req.user._id;
  sale.voidReason = (req.body.reason || "").trim();
  await sale.save();

  await Promise.all(
    sale.items.map((item) =>
      Product.findOneAndUpdate(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": item.quantity } }
      )
    )
  );

  res.json({ sale });
});

exports.getCashClose = catchAsync(async (req, res) => {
  const day = req.query.date ? new Date(req.query.date) : new Date();
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day.getTime() + 86400000);

  const sales = await PosOrder.find({
    createdAt: { $gte: day, $lt: nextDay },
    isVoided: false,
  })
    .populate("soldBy", "name")
    .sort({ createdAt: 1 })
    .lean();

  const byMethod = {};
  let grandTotal = 0;
  let totalItems = 0;

  for (const sale of sales) {
    const pm = sale.paymentMethod;
    if (!byMethod[pm]) byMethod[pm] = { count: 0, total: 0 };
    byMethod[pm].count += 1;
    byMethod[pm].total += sale.total;
    grandTotal += sale.total;
    totalItems += sale.items.reduce((s, i) => s + i.quantity, 0);
  }

  const label = day.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  res.json({
    date: day.toISOString().split("T")[0],
    label,
    salesCount: sales.length,
    grandTotal,
    totalItems,
    expectedCash: byMethod["efectivo"]?.total || 0,
    byMethod,
    sales,
  });
});

exports.exportCashClosePdf = catchAsync(async (req, res) => {
  const PDFDocument = require("pdfkit");

  const day = req.query.date ? new Date(req.query.date) : new Date();
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day.getTime() + 86400000);

  const sales = await PosOrder.find({
    createdAt: { $gte: day, $lt: nextDay },
    isVoided: false,
  })
    .populate("soldBy", "name")
    .sort({ createdAt: 1 })
    .lean();

  const byMethod = {};
  let grandTotal = 0;
  for (const sale of sales) {
    const pm = sale.paymentMethod;
    if (!byMethod[pm]) byMethod[pm] = { count: 0, total: 0 };
    byMethod[pm].count += 1;
    byMethod[pm].total += sale.total;
    grandTotal += sale.total;
  }

  const PM_LABELS = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    nequi: "Nequi",
    transferencia: "Transferencia",
  };

  const dateLabel = day.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);

    doc.fontSize(18).text("Cierre de caja — Dizor", { align: "center" });
    doc.fontSize(12).text(dateLabel, { align: "center" });
    doc.moveDown(1.5);

    doc.fontSize(13).text("Resumen por método de pago", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const [pm, data] of Object.entries(byMethod)) {
      doc.text(
        `${PM_LABELS[pm] || pm}: ${data.count} venta(s) — ${formatMoney(data.total)}`
      );
    }
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`TOTAL DEL DÍA: ${formatMoney(grandTotal)}`);
    doc.font("Helvetica").moveDown(1.5);

    doc.fontSize(13).text("Detalle de ventas", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    for (const sale of sales) {
      const time = new Date(sale.createdAt).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(
        `${sale.posOrderNumber}  ${time}  ${sale.customerName}  —  ${PM_LABELS[sale.paymentMethod] || sale.paymentMethod}  ${formatMoney(sale.total)}`
      );
      for (const item of sale.items) {
        doc.text(
          `      ${item.productName} ${item.sizeName} ${item.colorName} x${item.quantity} = ${formatMoney(item.lineTotal)}`
        );
      }
      doc.moveDown(0.3);
    }

    doc.end();
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cierre-caja-${day.toISOString().split("T")[0]}.pdf"`
  );
  res.send(Buffer.concat(chunks));
});
