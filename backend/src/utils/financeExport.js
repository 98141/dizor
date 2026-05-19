const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const formatMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

exports.buildFinanceCsv = (report) => {
  const lines = [];
  const push = (row) =>
    lines.push(
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    );

  push(["Reporte financiero Dizor"]);
  push(["Período", report.period?.label || ""]);
  push([]);

  const { sales, inventory, pending } = report;
  push(["RESUMEN"]);
  push(["Ganancia bruta", sales.grossProfit]);
  push(["Margen %", sales.grossMarginPct]);
  push(["Ingresos productos", sales.productRevenue]);
  push(["COGS", sales.cogs]);
  push(["Pedidos pagados", sales.ordersCount]);
  push(["Por cobrar", pending.amount]);
  push([]);

  push(["INVENTARIO"]);
  push(["Inversión costo", inventory.investmentAtCost]);
  push(["Venta potencial", inventory.potentialRetail]);
  push(["Ganancia potencial", inventory.potentialProfit]);
  push([]);

  push([
    "Fecha",
    "Pedido",
    "Producto",
    "SKU",
    "Cant",
    "Ingreso",
    "Costo",
    "Ganancia",
  ]);
  for (const row of report.salesLines || []) {
    push([
      formatDate(row.date),
      row.orderNumber,
      row.productName,
      row.sku,
      row.quantity,
      row.revenue,
      row.lineCost ?? "",
      row.lineProfit ?? "",
    ]);
  }

  return `\uFEFF${lines.join("\n")}`;
};

exports.buildFinanceXlsx = async (report) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dizor";
  wb.created = new Date();

  const summary = wb.addWorksheet("Resumen");
  summary.addRow(["Reporte financiero Dizor"]);
  summary.addRow(["Período", report.period?.label]);
  summary.addRow([]);
  summary.addRow(["Métrica", "Valor"]);
  const { sales, inventory, pending } = report;
  [
    ["Ganancia bruta", sales.grossProfit],
    ["Margen bruto %", sales.grossMarginPct],
    ["Ingresos productos", sales.productRevenue],
    ["Costo de ventas", sales.cogs],
    ["Total cobrado", sales.totalCollected],
    ["Pedidos pagados", sales.ordersCount],
    ["Unidades vendidas", sales.unitsSold],
    ["Ticket promedio", sales.averageOrderValue],
    ["Por cobrar", pending.amount],
    ["Inversión inventario", inventory.investmentAtCost],
    ["Venta potencial stock", inventory.potentialRetail],
    ["Ganancia potencial stock", inventory.potentialProfit],
  ].forEach((row) => summary.addRow(row));

  const salesSheet = wb.addWorksheet("Ventas");
  salesSheet.addRow([
    "Fecha",
    "Pedido",
    "Producto",
    "SKU",
    "Talla",
    "Color",
    "Cantidad",
    "Precio unit.",
    "Ingreso",
    "Costo línea",
    "Ganancia",
    "Pago",
  ]);
  for (const row of report.salesLines || []) {
    salesSheet.addRow([
      formatDate(row.date),
      row.orderNumber,
      row.productName,
      row.sku,
      row.sizeName,
      row.colorName,
      row.quantity,
      row.unitPrice,
      row.revenue,
      row.lineCost,
      row.lineProfit,
      row.paymentMethod,
    ]);
  }

  const invSheet = wb.addWorksheet("Inventario");
  invSheet.addRow([
    "Producto",
    "Stock",
    "Costo unit.",
    "Precio",
    "Inversión",
    "Venta pot.",
    "Ganancia pot.",
    "Margen %",
  ]);
  for (const row of inventory.catalogSummary || []) {
    invSheet.addRow([
      row.name,
      row.unitsInStock,
      row.internalCost,
      row.effectivePrice,
      row.investmentAtCost,
      row.potentialRetail,
      row.potentialProfit,
      row.marginPct,
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
};

exports.buildFinancePdf = (report) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];

    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Reporte financiero — Dizor", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).text(report.period?.label || "", { align: "center" });
    doc.moveDown(1.5);

    const { sales, inventory, pending } = report;
    const block = (title, rows) => {
      doc.fontSize(13).text(title, { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10);
      rows.forEach(([label, value]) => {
        doc.text(`${label}: ${typeof value === "number" ? formatMoney(value) : value}`);
      });
      doc.moveDown(1);
    };

    block("Ventas y ganancias", [
      ["Ganancia bruta", sales.grossProfit],
      ["Margen bruto", `${sales.grossMarginPct}%`],
      ["Ingresos productos", sales.productRevenue],
      ["Costo de ventas", sales.cogs],
      ["Pedidos pagados", sales.ordersCount],
      ["Total cobrado", sales.totalCollected],
      ["Por cobrar", pending.amount],
    ]);

    block("Inventario", [
      ["Inversión (costo)", inventory.investmentAtCost],
      ["Venta potencial", inventory.potentialRetail],
      ["Ganancia potencial", inventory.potentialProfit],
      ["Unidades en stock", inventory.unitsInStock],
    ]);

    doc.fontSize(13).text("Top productos por ingresos", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9);
    (sales.topByRevenue || []).slice(0, 8).forEach((p, i) => {
      doc.text(
        `${i + 1}. ${p.name} — ${formatMoney(p.revenue)} (ganancia ${formatMoney(p.profit)})`
      );
    });

    doc.end();
  });
