const ProductHistory = require("../models/productHistory");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");
const catalog = require("../services/catalogWorkspace");
const { dateBoundary, bogotaPeriod } = require("../services/orderWorkspace");

const EVENT_LABELS = {
  created: "Registro nuevo",
  updated: "Modificación",
  stock_adjustment: "Ajuste de stock",
  sale: "Venta",
  deleted: "Eliminado",
  price_change: "Cambio de precio",
  status_change: "Estado en tienda",
};

const REF_LABELS = { order: "Online", pos: "POS", admin: "Admin", system: "Sistema" };

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

const buildHistoryFilter = (query) => {
  const filter = {};
  if (query.productId) filter.productId = catalog.objectId(query.productId);
  if (query.variantId) filter.variantId = catalog.objectId(query.variantId);
  if (query.userId) filter.userId = catalog.objectId(query.userId);
  if (query.sku) { if (typeof query.sku !== "string" || query.sku.length > 160) throw new AppError("SKU inválido", 400); filter.sku = query.sku.trim().toUpperCase(); }
  // Exact bounded strings also allow legacy event types not written by today's enum.
  if (query.eventType) { if (typeof query.eventType !== "string" || query.eventType.length > 80) throw new AppError("Tipo de movimiento inválido", 400); filter.eventType = query.eventType; }
  if (query.referenceType) { if (!["order", "admin", "system", "pos"].includes(query.referenceType)) throw new AppError("Origen inválido", 400); filter.referenceType = query.referenceType; }
  if (query.movementKind) {
    const kinds = { restock: { eventType: "stock_adjustment", quantityChange: { $gt: 0 }, referenceType: { $ne: "order" } },
      withdrawal: { eventType: "stock_adjustment", quantityChange: { $lt: 0 }, referenceType: { $ne: "order" } },
      restoration: { eventType: "stock_adjustment", referenceType: "order", quantityChange: { $gt: 0 } }, sale: { eventType: "sale" },
      other: { $or: [{ eventType: { $nin: ["sale", "stock_adjustment"] } }, { eventType: "stock_adjustment", quantityChange: 0 }, { eventType: "stock_adjustment", referenceType: "order", quantityChange: { $lt: 0 } }] } };
    if (!Object.hasOwn(kinds, query.movementKind)) throw new AppError("Tipo de movimiento inválido", 400);
    filter.$and = [kinds[query.movementKind]];
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = dateBoundary(query.from);
    if (query.to) filter.createdAt.$lt = dateBoundary(query.to, true);
    if (filter.createdAt.$gte >= filter.createdAt.$lt) throw new AppError("Intervalo inválido", 400);
  }
  if (query.term && (typeof query.term !== "string" || query.term.length > 160)) throw new AppError("Búsqueda inválida", 400);

  const term = query.term?.trim();
  if (term) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { productName: regex },
      { sku: regex },
      { summary: regex },
      { referenceLabel: regex },
      { userEmail: regex },
    ];
  }
  return filter;
};

const formatEntry = (doc) => ({
  id: doc._id,
  productId: doc.productId,
  productName: doc.productName,
  productSlug: doc.productSlug,
  variantId: doc.variantId,
  sku: doc.sku,
  sizeName: doc.sizeName,
  colorName: doc.colorName,
  eventType: doc.eventType,
  quantityChange: doc.quantityChange,
  stockBefore: doc.stockBefore,
  stockAfter: doc.stockAfter,
  referenceType: doc.referenceType,
  referenceId: doc.referenceId,
  referenceLabel: doc.referenceLabel,
  userId: doc.userId,
  userEmail: doc.userEmail,
  movementKind: doc.eventType === "sale" ? "sale" : doc.eventType === "stock_adjustment" ? doc.referenceType === "order" && doc.quantityChange > 0 ? "restoration" : doc.referenceType === "order" ? "other" : doc.quantityChange > 0 ? "restock" : doc.quantityChange < 0 ? "withdrawal" : "other" : "other",
  role: doc.role,
  summary: doc.summary,
  details: doc.details,
  createdAt: doc.createdAt,
});

exports.getHistory = catchAsync(async (req, res) => {
  const { page, limit } = catalog.page(req.query);
  const skip = (page - 1) * limit;

  const filter = buildHistoryFilter(req.query);

  const [entries, total, eventTypes, productsAgg, actors] = await Promise.all([
    ProductHistory.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductHistory.countDocuments(filter),
    ProductHistory.distinct("eventType"),
    ProductHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$productId",
          productName: { $last: "$productName" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
    ProductHistory.aggregate([{ $match: { userId: { $ne: null } } },
      { $group: { _id: "$userId", email: { $last: "$userEmail" } } }, { $sort: { _id: 1 } }, { $limit: 50 }]),
  ]);

  res.status(200).json({
    status: "success",
    results: entries.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    filters: {
      eventTypes: eventTypes.sort(),
      actors: actors.map((a) => ({ id: a._id, email: a.email })),
      products: productsAgg.map((p) => ({
        id: p._id,
        name: p.productName,
        count: p.count,
      })),
    },
    history: entries.map(formatEntry),
  });
});

exports.getStats = catchAsync(async (req, res) => {
  const { today } = bogotaPeriod();

  const [total, todayCount, salesToday, stockMovesToday, byType] =
    await Promise.all([
      ProductHistory.countDocuments(),
      ProductHistory.countDocuments({ createdAt: { $gte: today } }),
      ProductHistory.aggregate([
        {
          $match: {
            eventType: "sale",
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            units: { $sum: { $abs: "$quantityChange" } },
            count: { $sum: 1 },
          },
        },
      ]),
      ProductHistory.countDocuments({
        eventType: "stock_adjustment",
        createdAt: { $gte: today },
      }),
      ProductHistory.aggregate([
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

  const sales = salesToday[0] || { units: 0, count: 0 };

  res.status(200).json({
    status: "success",
    stats: {
      total,
      today: todayCount,
      salesToday: sales.count,
      unitsSoldToday: sales.units,
      stockAdjustmentsToday: stockMovesToday,
      byType: byType.map((row) => ({
        eventType: row._id,
        count: row.count,
      })),
    },
  });
});

exports.exportPdf = catchAsync(async (req, res) => {
  const PDFDocument = require("pdfkit");

  const filter = buildHistoryFilter(req.query);
  const entries = await ProductHistory.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(5000)
    .lean();

  const now = new Date();
  const dateLabel = now.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build filter description for the PDF header
  const filterParts = [];
  if (req.query.from || req.query.to) {
    filterParts.push(
      `Período: ${req.query.from || "inicio"} → ${req.query.to || "hoy"}`
    );
  }
  if (req.query.eventType) {
    filterParts.push(`Tipo: ${EVENT_LABELS[req.query.eventType] || req.query.eventType}`);
  }
  if (req.query.term) filterParts.push(`Búsqueda: "${req.query.term}"`);

  const doc = new PDFDocument({ margin: 36, size: "A4" });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(16).font("Helvetica-Bold")
      .text("Historial de Inventario — Dizor", { align: "center" });
    doc.fontSize(10).font("Helvetica")
      .text(`Generado el ${dateLabel} a las ${timeLabel}`, { align: "center" });

    if (filterParts.length) {
      doc.moveDown(0.4).fontSize(9).fillColor("#666")
        .text(filterParts.join("   |   "), { align: "center" });
    }

    doc.fillColor("#000").moveDown(0.6);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).stroke().moveDown(0.5);

    // ── Summary line ────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold")
      .text(`Total de registros: ${entries.length}`, { continued: true });
    const sales = entries.filter((e) => e.eventType === "sale").length;
    const adjustments = entries.filter((e) => e.eventType === "stock_adjustment").length;
    doc.font("Helvetica")
      .text(`   ·   Ventas: ${sales}   ·   Ajustes de stock: ${adjustments}`);
    doc.moveDown(0.8);

    // ── Column headers ──────────────────────────────────────
    const COL = { date: 36, type: 115, product: 195, variant: 315, qty: 390, stock: 420, ref: 475 };
    const headerY = doc.y;
    doc.rect(36, headerY - 2, 523, 14).fill("#f3f4f6");
    doc.fillColor("#374151").fontSize(7.5).font("Helvetica-Bold");
    doc.text("Fecha", COL.date, headerY, { width: 75 });
    doc.text("Tipo", COL.type, headerY, { width: 76 });
    doc.text("Producto", COL.product, headerY, { width: 116 });
    doc.text("Variante", COL.variant, headerY, { width: 71 });
    doc.text("Mov.", COL.qty, headerY, { width: 28, align: "right" });
    doc.text("Stock", COL.stock, headerY, { width: 52 });
    doc.text("Referencia", COL.ref, headerY, { width: 84 });
    doc.moveDown(0.2);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).stroke("#d1d5db").moveDown(0.3);

    // ── Rows ─────────────────────────────────────────────────
    doc.fillColor("#000").font("Helvetica").fontSize(7.5);

    let rowIndex = 0;
    for (const row of entries) {
      if (doc.y > 760) {
        doc.addPage();
        doc.fontSize(7).fillColor("#999")
          .text(`Historial de Inventario — Dizor  ·  ${dateLabel}`, 36, 20, { align: "center" });
        doc.fillColor("#000").fontSize(7.5).moveDown(0.5);
      }

      const y = doc.y;
      if (rowIndex % 2 === 0) {
        doc.rect(36, y - 1, 523, 12).fill("#fafafa");
      }

      const dateStr = new Date(row.createdAt).toLocaleString("es-CO", {
        timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });

      const eventLabel = EVENT_LABELS[row.eventType] || row.eventType;
      const variant = [row.sku, row.sizeName, row.colorName].filter(Boolean).join(" / ");
      const qtyStr = row.quantityChange > 0 ? `+${row.quantityChange}` : String(row.quantityChange || "—");
      const stockStr = row.stockBefore != null
        ? `${row.stockBefore}→${row.stockAfter ?? "?"}`
        : "—";
      const refLabel = row.referenceLabel
        ? `${REF_LABELS[row.referenceType] || ""} ${row.referenceLabel}`.trim()
        : REF_LABELS[row.referenceType] || "—";

      doc.fillColor("#000");
      doc.text(dateStr, COL.date, y, { width: 75, lineBreak: false });
      doc.text(eventLabel, COL.type, y, { width: 76, lineBreak: false });
      doc.text((row.productName || "").slice(0, 28), COL.product, y, { width: 116, lineBreak: false });
      doc.text(variant.slice(0, 22), COL.variant, y, { width: 71, lineBreak: false });
      doc.fillColor(row.quantityChange > 0 ? "#166534" : row.quantityChange < 0 ? "#991b1b" : "#374151");
      doc.text(qtyStr, COL.qty, y, { width: 28, align: "right", lineBreak: false });
      doc.fillColor("#374151");
      doc.text(stockStr, COL.stock, y, { width: 52, lineBreak: false });
      doc.text(refLabel.slice(0, 20), COL.ref, y, { width: 84, lineBreak: false });

      doc.moveDown(0.85);
      rowIndex++;
    }

    // ── Footer line ──────────────────────────────────────────
    doc.moveDown(0.5);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).stroke("#d1d5db");
    doc.moveDown(0.3).fontSize(7).fillColor("#999")
      .text(
        `Historial no modificable — generado automáticamente por Dizor el ${dateLabel} ${timeLabel}`,
        { align: "center" }
      );

    doc.end();
  });

  const filename = `historial-inventario-${now.toISOString().split("T")[0]}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.concat(chunks));
});
