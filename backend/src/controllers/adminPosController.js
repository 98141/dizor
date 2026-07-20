const PosOrder = require("../models/posOrder");
const Product = require("../models/product");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  logPosSale,
  logPosVoidReturn,
  safeLogProductHistory,
} = require("../services/productHistoryService");

const formatMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

// Parse "YYYY-MM-DD" as LOCAL midnight to avoid UTC offset shifting the day
const parseLocalDay = (dateStr) => {
  if (!dateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

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
      productSlug: product.slug || null,
      variantId: variant._id,
      productName: product.name,
      sizeName: item.sizeName || variant.size?.name || "",
      colorName: item.colorName || variant.color?.name || "",
      sku: variant.sku || "",
      quantity: qty,
      unitPrice,
      lineTotal,
      stockBefore: variant.stock,
      stockAfter: variant.stock - qty,
    });
  }

  const discount = Math.max(0, Number(discountAmount) || 0);
  const total = Math.max(0, subtotal - discount);

  // Descontar stock atómicamente — el $gte evita stock negativo por doble envío
  const deductedPos = [];
  for (const item of safeItems) {
    // $elemMatch evita que "variants._id" y "variants.stock" se evalúen
    // contra elementos distintos del array cuando la venta tiene varios
    // ítems del mismo producto (ver orderService.deductOrderStock).
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } },
      },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
    if (!updated) {
      for (const prev of deductedPos) {
        await Product.findOneAndUpdate(
          { _id: prev.productId, "variants._id": prev.variantId },
          { $inc: { "variants.$.stock": prev.quantity } }
        ).catch(() => {});
      }
      return next(new AppError(`Stock insuficiente: ${item.productName} (ya no hay unidades disponibles)`, 400));
    }
    deductedPos.push(item);
  }

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
    soldBy: req.user.id,
    notes: (notes || "").trim(),
  });

  await sale.populate("soldBy", "name");

  // Log each item to inventory history
  for (const item of safeItems) {
    safeLogProductHistory(
      logPosSale({
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        variantId: item.variantId,
        sku: item.sku,
        sizeName: item.sizeName,
        colorName: item.colorName,
        quantity: item.quantity,
        stockBefore: item.stockBefore,
        stockAfter: item.stockAfter,
        posOrderNumber: sale.posOrderNumber,
        posOrderId: sale._id,
        user: req.user,
        unitPrice: item.unitPrice,
      })
    );
  }

  safeLog(
    logAuditEvent({
      req,
      action: "pos_sale_created",
      module: "pos",
      user: req.user,
      entityId: sale._id,
      entityType: "pos_order",
      summary: `Venta POS registrada · ${sale.posOrderNumber} · ${formatMoney(sale.total)}`,
      newData: {
        posOrderNumber: sale.posOrderNumber,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        itemCount: safeItems.reduce((s, i) => s + i.quantity, 0),
      },
    })
  );

  res.status(201).json({ sale });
});

exports.getPosSales = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 30);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.all !== "true") {
    const day = parseLocalDay(req.query.date);
    const nextDay = new Date(day.getTime() + 86400000);
    filter.createdAt = { $gte: day, $lt: nextDay };
  } else if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = parseLocalDay(req.query.from);
    if (req.query.to) {
      const to = parseLocalDay(req.query.to);
      filter.createdAt.$lte = new Date(to.getTime() + 86400000 - 1);
    }
  }

  if (req.query.includeVoided !== "true") filter.isVoided = false;

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
  sale.voidedBy = req.user.id;
  sale.voidReason = (req.body.reason || "").trim();
  await sale.save();

  // Fetch current stocks before restoring (for before/after tracking)
  const stockSnapshots = {};
  for (const item of sale.items) {
    const prod = await Product.findOne(
      { _id: item.productId, "variants._id": item.variantId },
      { "variants.$": 1 }
    ).lean();
    stockSnapshots[String(item.variantId)] = prod?.variants?.[0]?.stock ?? 0;
  }

  await Promise.all(
    sale.items.map((item) =>
      Product.findOneAndUpdate(
        { _id: item.productId, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": item.quantity } }
      )
    )
  );

  // Log each item return to inventory history
  for (const item of sale.items) {
    const stockBefore = stockSnapshots[String(item.variantId)] ?? 0;
    safeLogProductHistory(
      logPosVoidReturn({
        productId: item.productId,
        productName: item.productName,
        productSlug: null,
        variantId: item.variantId,
        sku: item.sku,
        sizeName: item.sizeName,
        colorName: item.colorName,
        quantity: item.quantity,
        stockBefore,
        stockAfter: stockBefore + item.quantity,
        posOrderNumber: sale.posOrderNumber,
        posOrderId: sale._id,
        user: req.user,
      })
    );
  }

  safeLog(
    logAuditEvent({
      req,
      action: "pos_sale_voided",
      module: "pos",
      user: req.user,
      entityId: sale._id,
      entityType: "pos_order",
      summary: `Venta POS anulada · ${sale.posOrderNumber} · Motivo: ${sale.voidReason || "sin motivo"}`,
      previousData: { posOrderNumber: sale.posOrderNumber, total: sale.total, isVoided: false },
      newData: { isVoided: true, voidReason: sale.voidReason, voidedAt: sale.voidedAt },
    })
  );

  res.json({ sale });
});

exports.getCashClose = catchAsync(async (req, res) => {
  const Order = require("../models/order");

  const day = parseLocalDay(req.query.date);
  const nextDay = new Date(day.getTime() + 86400000);

  const [sales, onlineOrders] = await Promise.all([
    PosOrder.find({ createdAt: { $gte: day, $lt: nextDay }, isVoided: false })
      .populate("soldBy", "name")
      .sort({ createdAt: 1 })
      .lean(),
    Order.find({ createdAt: { $gte: day, $lt: nextDay }, paymentStatus: "pagado" })
      .select("orderNumber buyer total paymentMethod createdAt items")
      .sort({ createdAt: 1 })
      .lean(),
  ]);

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

  const onlineByMethod = {};
  let onlineTotal = 0;
  let onlineItems = 0;
  for (const order of onlineOrders) {
    const pm = order.paymentMethod;
    if (!onlineByMethod[pm]) onlineByMethod[pm] = { count: 0, total: 0 };
    onlineByMethod[pm].count += 1;
    onlineByMethod[pm].total += order.total;
    onlineTotal += order.total;
    onlineItems += (order.items || []).reduce((s, i) => s + i.quantity, 0);
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
    online: {
      salesCount: onlineOrders.length,
      total: onlineTotal,
      totalItems: onlineItems,
      byMethod: onlineByMethod,
      orders: onlineOrders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.buyer?.name || "—",
        total: o.total,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        itemCount: (o.items || []).reduce((s, i) => s + i.quantity, 0),
      })),
    },
    combinedTotal: grandTotal + onlineTotal,
  });
});

exports.exportCashClosePdf = catchAsync(async (req, res) => {
  const PDFDocument = require("pdfkit");
  const Order = require("../models/order");

  const day = parseLocalDay(req.query.date);
  const nextDay = new Date(day.getTime() + 86400000);

  const [sales, onlineOrders] = await Promise.all([
    PosOrder.find({ createdAt: { $gte: day, $lt: nextDay }, isVoided: false })
      .populate("soldBy", "name")
      .sort({ createdAt: 1 })
      .lean(),
    Order.find({ createdAt: { $gte: day, $lt: nextDay }, paymentStatus: "pagado" })
      .select("orderNumber buyer total paymentMethod createdAt items")
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const byMethod = {};
  let grandTotal = 0;
  for (const sale of sales) {
    const pm = sale.paymentMethod;
    if (!byMethod[pm]) byMethod[pm] = { count: 0, total: 0 };
    byMethod[pm].count += 1;
    byMethod[pm].total += sale.total;
    grandTotal += sale.total;
  }

  const onlineByMethod = {};
  let onlineTotal = 0;
  for (const order of onlineOrders) {
    const pm = order.paymentMethod;
    if (!onlineByMethod[pm]) onlineByMethod[pm] = { count: 0, total: 0 };
    onlineByMethod[pm].count += 1;
    onlineByMethod[pm].total += order.total;
    onlineTotal += order.total;
  }

  const POS_PM_LABELS = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    nequi: "Nequi",
    transferencia: "Transferencia",
  };

  const ONLINE_PM_LABELS = {
    wompi: "Wompi (PSE / Tarjeta)",
    nequi_manual: "Nequi (transferencia)",
    contra_entrega: "Contraentrega pagada",
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

    // ── Header ──
    doc.fontSize(18).font("Helvetica-Bold").text("Cierre de caja — Dizor", { align: "center" });
    doc.fontSize(12).font("Helvetica").text(dateLabel, { align: "center" });
    doc.moveDown(0.5);

    // ── Combined total banner ──
    doc.fontSize(13).font("Helvetica-Bold")
      .text(`INGRESO TOTAL DEL DÍA: ${formatMoney(grandTotal + onlineTotal)}`, { align: "center" });
    doc.font("Helvetica").moveDown(1.2);

    // ── POS section ──
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#d1d5db").moveDown(0.5);
    doc.fontSize(13).font("Helvetica-Bold").text("Ventas presenciales (POS)");
    doc.font("Helvetica").moveDown(0.5);
    doc.fontSize(10);
    if (Object.keys(byMethod).length === 0) {
      doc.fillColor("#999").text("Sin ventas POS para este día.").fillColor("#000");
    } else {
      for (const [pm, d] of Object.entries(byMethod)) {
        doc.text(`  ${POS_PM_LABELS[pm] || pm}: ${d.count} venta(s) — ${formatMoney(d.total)}`);
      }
      doc.moveDown(0.3).font("Helvetica-Bold")
        .text(`  Subtotal POS: ${formatMoney(grandTotal)}`);
      doc.font("Helvetica");
    }
    doc.moveDown(1);

    // ── POS detail ──
    if (sales.length > 0) {
      doc.fontSize(11).font("Helvetica-Bold").text("Detalle ventas POS");
      doc.font("Helvetica").moveDown(0.4).fontSize(9);
      for (const sale of sales) {
        const time = new Date(sale.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        doc.text(`${sale.posOrderNumber}  ${time}  ${sale.customerName}  —  ${POS_PM_LABELS[sale.paymentMethod] || sale.paymentMethod}  ${formatMoney(sale.total)}`);
        for (const item of sale.items) {
          doc.text(`      ${item.productName} ${item.sizeName} ${item.colorName} x${item.quantity} = ${formatMoney(item.lineTotal)}`);
        }
        doc.moveDown(0.3);
      }
    }

    // ── Online section ──
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#d1d5db").moveDown(0.5);
    doc.fontSize(13).font("Helvetica-Bold").text("Pedidos online confirmados");
    doc.font("Helvetica").moveDown(0.5).fontSize(10);
    if (onlineOrders.length === 0) {
      doc.fillColor("#999").text("Sin pedidos online pagados para este día.").fillColor("#000");
    } else {
      for (const [pm, d] of Object.entries(onlineByMethod)) {
        doc.text(`  ${ONLINE_PM_LABELS[pm] || pm}: ${d.count} pedido(s) — ${formatMoney(d.total)}`);
      }
      doc.moveDown(0.3).font("Helvetica-Bold")
        .text(`  Subtotal online: ${formatMoney(onlineTotal)}`);
      doc.font("Helvetica").moveDown(0.8).fontSize(9);
      for (const order of onlineOrders) {
        const time = new Date(order.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        const itemCount = (order.items || []).reduce((s, i) => s + i.quantity, 0);
        doc.text(`${order.orderNumber}  ${time}  ${order.buyer?.name || "—"}  —  ${ONLINE_PM_LABELS[order.paymentMethod] || order.paymentMethod}  ${formatMoney(order.total)}  (${itemCount} und.)`);
        doc.moveDown(0.25);
      }
    }

    // ── Footer ──
    doc.moveDown(0.8);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#d1d5db").moveDown(0.4);
    doc.fontSize(8).fillColor("#999")
      .text(`Generado automáticamente por Dizor · ${dateLabel}`, { align: "center" });

    doc.end();
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cierre-caja-${day.toISOString().split("T")[0]}.pdf"`
  );
  res.send(Buffer.concat(chunks));
});
