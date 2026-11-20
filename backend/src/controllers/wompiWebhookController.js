const catchAsync = require("../utils/catchAsync");
const Order = require("../models/order");
const { verifyEventChecksum, getExpectedEventEnvironment } = require("../services/wompiService");
const { processTransaction } = require("../services/wompiPaymentService");

exports.handleWompiEvent = catchAsync(async (req, res) => {
  const event = req.body;
  const checksum = req.headers["x-event-checksum"] || event?.signature?.checksum;
  if (!verifyEventChecksum(event, checksum)) return res.status(401).json({ status: "fail", message: "Checksum inválido" });
  if (event.event !== "transaction.updated" || event.environment !== getExpectedEventEnvironment()) return res.status(200).send("OK");
  const tx = event.data?.transaction;
  if (!tx || typeof tx.id !== "string" || !["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"].includes(tx.status)) return res.status(400).send("Invalid transaction");
  const refs = [];
  for (const value of [tx.reference, tx.sku]) if (typeof value === "string" && value) refs.push({ orderNumber: value });
  if (typeof tx.payment_link_id === "string" && tx.payment_link_id) refs.push({ "wompi.paymentLinkId": tx.payment_link_id });
  if (!refs.length) return res.status(200).send("OK");
  const order = await Order.findOne({ paymentMethod: "wompi", $or: refs });
  if (!order) return res.status(200).send("OK");
  await processTransaction(order._id, tx, { environment: event.environment, checksum, timestamp: event.timestamp });
  res.status(200).send("OK");
});
