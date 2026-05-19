const catchAsync = require("../utils/catchAsync");
const { buildFinanceReport } = require("../services/financeService");
const {
  buildFinanceCsv,
  buildFinanceXlsx,
  buildFinancePdf,
} = require("../utils/financeExport");

exports.getReport = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);

  res.status(200).json({
    status: "success",
    ...report,
  });
});

/** @deprecated use getReport */
exports.getOverview = exports.getReport;

exports.exportCsv = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const csv = buildFinanceCsv(report);
  const filename = `dizor-finanzas-${Date.now()}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

exports.exportXlsx = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const buffer = await buildFinanceXlsx(report);
  const filename = `dizor-finanzas-${Date.now()}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
});

exports.exportPdf = catchAsync(async (req, res) => {
  const report = await buildFinanceReport(req.query);
  const buffer = await buildFinancePdf(report);
  const filename = `dizor-finanzas-${Date.now()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});
