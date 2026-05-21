const catchAsync = require("../utils/catchAsync");
const Order = require("../models/order");
const Coupon = require("../models/coupon");
const { verifyEventChecksum } = require("../services/wompiService");
const { markAbandonedCartRecovered } = require("../services/marketingService");
const { deductOrderStock } = require("../services/orderService");

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

  if (event.event !== "transaction.updated") {
    return res.status(200).send("OK");
  }

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

  // Guardar datos de la transacción
  order.wompi = {
    ...order.wompi?.toObject?.(),
    ...order.wompi,
    transactionId: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
  };

  if (transaction.status === "APPROVED") {
    // Descontar stock si aún no se hizo (órdenes Wompi siempre llegan aquí con stockDeducted=false)
    if (!order.stockDeducted) {
      try {
        await deductOrderStock(order.items);
        order.stockDeducted = true;
      } catch {
        // Stock agotado mientras esperaba el pago → marcar para revisión manual
        pushStatusHistory(
          order,
          order.orderStatus,
          "ALERTA: Pago aprobado pero stock insuficiente al confirmar. Revisión manual requerida."
        );
        order.customerNotes = (order.customerNotes || "") +
          "\n[SISTEMA] Pago Wompi aprobado pero stock no disponible al confirmar.";
        await order.save();
        return res.status(200).send("OK");
      }
    }

    // Consumir cupón si aplica
    if (order.couponCode && !order.couponConsumed) {
      const coupon = await Coupon.findOne({
        code: order.couponCode,
        isActive: true,
      });
      if (coupon) {
        coupon.usedCount += 1;
        await coupon.save();
      }
      order.couponConsumed = true;
    }

    order.paymentStatus = "pagado";
    if (["pendiente", "pago_pendiente"].includes(order.orderStatus)) {
      order.orderStatus = "pagado";
      pushStatusHistory(order, "pagado", "Pago confirmado vía Wompi");
    }
    order.paymentConfirmedAt = new Date();
    await markAbandonedCartRecovered(order.buyer?.email, order.orderNumber);

  } else if (["DECLINED", "ERROR", "VOIDED"].includes(transaction.status)) {
    // Auto-cancelar la orden y devolver nota
    order.paymentStatus = "rechazado";
    if (!["cancelado", "entregado", "devuelto"].includes(order.orderStatus)) {
      order.orderStatus = "cancelado";
      pushStatusHistory(
        order,
        "cancelado",
        `Pago Wompi rechazado (${transaction.status}). Orden cancelada automáticamente.`
      );
    } else {
      pushStatusHistory(order, order.orderStatus, `Pago Wompi: ${transaction.status}`);
    }
    // No es necesario restaurar stock porque para Wompi nunca se descontó
    // (stockDeducted se mantiene false)
  }

  await order.save();
  res.status(200).send("OK");
});
