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
    // Defensa en profundidad: el monto pagado debe coincidir con el total de la orden.
    // El link de pago se crea con amount_in_cents = order.total * 100 (ver
    // wompiService.createPaymentLink), así que aquí debe cuadrar exactamente.
    const expectedCents = Math.round(order.total * 100);
    const paidCents = Number(transaction.amount_in_cents);
    if (!Number.isFinite(paidCents) || paidCents !== expectedCents) {
      pushStatusHistory(
        order,
        order.orderStatus,
        `ALERTA: monto pagado (${paidCents} cts) no coincide con el total esperado (${expectedCents} cts). Revisión manual requerida.`
      );
      order.customerNotes = (order.customerNotes || "") +
        `\n[SISTEMA] Pago Wompi con monto ${paidCents} cts distinto al total esperado ${expectedCents} cts. No se confirmó automáticamente.`;
      await order.save();
      return res.status(200).send("OK");
    }

    // Descontar stock si aún no se hizo (órdenes Wompi siempre llegan aquí con stockDeducted=false)
    if (!order.stockDeducted) {
      try {
        await deductOrderStock(order.items, {
          orderId: order._id,
          orderNumber: order.orderNumber,
        });
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

    // Consumir cupón de forma atómica: incremento condicional evita race conditions
    if (order.couponCode && !order.couponConsumed) {
      await Coupon.findOneAndUpdate(
        {
          code: order.couponCode,
          isActive: true,
          $or: [
            { maxUses: null },
            { $expr: { $lt: ["$usedCount", "$maxUses"] } },
          ],
        },
        { $inc: { usedCount: 1 } }
      );
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
