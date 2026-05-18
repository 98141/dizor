const catchAsync = require("../utils/catchAsync");
const Order = require("../models/order");
const { verifyEventChecksum } = require("../services/wompiService");
const { markAbandonedCartRecovered } = require("../services/marketingService");

const pushStatusHistory = (order, status, note) => {
  order.statusHistory.push({
    status,
    note: note || "",
    changedAt: new Date(),
  });
};

exports.handleWompiEvent = catchAsync(async (req, res) => {
  const checksum = req.headers["x-event-checksum"];
  const event = req.body;

  if (!verifyEventChecksum(event, checksum)) {
    return res.status(401).json({ status: "fail", message: "Checksum inválido" });
  }

  if (event.event === "transaction.updated") {
    const transaction = event.data?.transaction;
    if (!transaction) {
      return res.status(200).send("OK");
    }

    const order = await Order.findOne({
      $or: [
        { orderNumber: transaction.reference },
        { orderNumber: transaction.sku },
        { "wompi.paymentLinkId": transaction.payment_link_id },
      ],
    });

    if (!order) {
      return res.status(200).send("OK");
    }

    order.wompi = {
      ...order.wompi?.toObject?.(),
      ...order.wompi,
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
    };

    if (transaction.status === "APPROVED") {
      order.paymentStatus = "pagado";
      if (["pendiente", "pago_pendiente"].includes(order.orderStatus)) {
        order.orderStatus = "pagado";
        pushStatusHistory(order, "pagado", "Pago confirmado vía Wompi");
      }
      order.paymentConfirmedAt = new Date();
      await markAbandonedCartRecovered(order.buyer?.email, order.orderNumber);
    } else if (["DECLINED", "ERROR", "VOIDED"].includes(transaction.status)) {
      order.paymentStatus = "rechazado";
      pushStatusHistory(
        order,
        order.orderStatus,
        `Pago Wompi: ${transaction.status}`
      );
    }

    await order.save();
  }

  res.status(200).send("OK");
});
