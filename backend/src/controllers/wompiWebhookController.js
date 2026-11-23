const catchAsync = require("../utils/catchAsync");
const { verifyEventChecksum, getExpectedEventEnvironment } = require("../services/wompiService");
const { processTransaction } = require("../services/wompiPaymentService");

exports.handleWompiEvent = catchAsync(async (req, res) => {
  // Verify the provider payload, before any global XSS sanitizer can alter text.
  const event = req.rawBody ? JSON.parse(req.rawBody.toString("utf8")) : req.body;
  const checksum = req.headers["x-event-checksum"] || event?.signature?.checksum;
  if (!verifyEventChecksum(event, checksum)) return res.status(401).json({ status: "fail", message: "Checksum inválido" });
  if (event.event !== "transaction.updated" || event.environment !== getExpectedEventEnvironment()) return res.status(200).send("OK");
  const tx = event.data?.transaction;
  if (!tx || typeof tx.id !== "string" || !["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"].includes(tx.status)) return res.status(400).send("Invalid transaction");
  // Receipt is durable even when no unambiguous Payment Link association exists.
  await processTransaction(null, tx, { environment: event.environment, checksum, timestamp: event.timestamp });
  res.status(200).send("OK");
});
