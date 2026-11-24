const Order = require("../models/order");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logAuditEvent, safeLog } = require("../services/auditService");
const {
  isAdmin,
  canConfirmPayment,
} = require("../utils/orderPermissions");
const { mutateOrder, transition, history } = require("../services/orderOperations");
const { allowedTransitions, assertCollection } = require("../services/orderTransitions");

const workspace = require("../services/orderWorkspace");
const formatOrderList = workspace.listDTO;

exports.getOrderStats = catchAsync(async (req, res) => {
  const result = await workspace.queryWorkspace({ limit: 1 }, req.user.role);
  const { today, tomorrow } = workspace.bogotaPeriod();
  const [pendingPayment, shippedToday] = await Promise.all([
    Order.countDocuments({ paymentMethod: "wompi", paymentStatus: "pendiente", orderStatus: { $nin: ["cancelado", "devuelto", "rechazado"] } }),
    workspace.countDispatches(today, tomorrow),
  ]);
  res.json({ status: "success", counts: result.counts, stats: { total: result.counts.all,
    pendingPayment, toPrepare: result.counts.prepare, shippedToday } });
});

exports.getOrders = catchAsync(async (req, res) => {
  res.json(await workspace.queryWorkspace(req.query, req.user.role));
});

exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "assignedTo",
    "name email role"
  );

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  const dto = order.toObject();
  if (!isAdmin(req.user.role)) for (const item of dto.items) delete item.unitCost;
  dto.operation = workspace.operationalActions(dto, req.user.role);
  dto.incidents = dto.incidents.map(i => ({ ...i, allowedResolutions: require("../services/paymentIncidentResolution").decisions(i, req.user.role) }));
  dto.allowedTransitions = allowedTransitions(dto, req.user.role);
  dto.canConfirmCollection = isAdmin(req.user.role) && dto.paymentMethod === "contra_entrega"
    && dto.orderStatus === "entregado" && dto.paymentStatus === "pendiente";
  dto.canUpdateShipping = ["en_preparacion", "enviado"].includes(dto.orderStatus)
    && require("../services/orderReadiness").canFulfill(dto);
  res.status(200).json({ status: "success", order: dto });
});

exports.updateOrderStatus = catchAsync(async (req, res) => {
  const { order, changed } = await mutateOrder(req.params.id, async (order, session) => {
    const changed = await transition(order, req.body.orderStatus, req.user, req.body.note, session);
    return { changed };
  });
  if (changed) safeLog(logAuditEvent({ req, user: req.user, action: "order_status_changed", module: "orders",
    entityId: order._id, entityType: "order", summary: `Pedido ${order.orderNumber}: ${order.orderStatus}` }));
  res.status(200).json({ status: "success", message: changed ? "Estado actualizado" : "El pedido ya tenía este estado. No se registró una nueva transición.", order: formatOrderList(order, req.user.role) });
});

exports.confirmPayment = catchAsync(async (req, res) => {
  const { order, changed } = await mutateOrder(req.params.id, async (order) => {
    // Check role and method even on retries; payment is never an operational transition.
    if (!canConfirmPayment(req.user.role)) throw new AppError("Solo administradores pueden registrar recaudos", 403);
    if (order.paymentMethod !== "contra_entrega") throw new AppError("Wompi no admite confirmación manual", 409);
    if (["cancelado", "devuelto", "rechazado"].includes(order.orderStatus)) throw new AppError("Pedido cerrado", 409);
    if (order.paymentStatus === "pagado") return;
    assertCollection(order, req.user.role, req.body);
    order.collection = { receivedAt: new Date(req.body.receivedAt), recordedAt: new Date(),
      reference: req.body.reference.trim(), proofUrl: req.body.paymentProofUrl || "", recordedBy: req.user.id };
    order.paymentStatus = "pagado";
    order.paymentConfirmedAt = new Date(); order.paymentConfirmedBy = req.user.id;
    order.paymentProofUrl = req.body.paymentProofUrl || "";
    history(order, `Recaudo confirmado: ${order.collection.reference}`, req.user);
    return { changed: true };
  });
  if (changed) safeLog(logAuditEvent({ req, user: req.user, action: "payment_confirmed", module: "orders",
    entityId: order._id, entityType: "order", summary: `Recaudo registrado · ${order.orderNumber}` }));
  res.status(200).json({ status: "success", message: "Recaudo registrado", order: formatOrderList(order, req.user.role) });
});

exports.updateShipping = catchAsync(async (req, res) => {
  const { order } = await mutateOrder(req.params.id, async (order, session) => {
    if (!["en_preparacion", "enviado"].includes(order.orderStatus)
        || !require("../services/orderReadiness").canFulfill(order)) {
      throw new AppError("No se puede registrar una guía en este estado", 409);
    }
    const previous = `${order.carrier}|${order.trackingNumber}|${order.shippingNotes}`;
    for (const key of ["carrier", "trackingNumber", "shippingNotes"]) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== "string") throw new AppError("Información de envío inválida", 400);
        order[key] = req.body[key].trim();
      }
    }
    if (!order.carrier || !order.trackingNumber) throw new AppError("Registra transportadora y guía", 400);
    const changed = await transition(order, "enviado", req.user, `Guía registrada: ${order.trackingNumber}`, session);
    if (!changed && previous !== `${order.carrier}|${order.trackingNumber}|${order.shippingNotes}`) history(order, `Guía corregida: ${order.trackingNumber}`, req.user);
    return { changed };
  });
  res.status(200).json({ status: "success", message: "Guía guardada", order: formatOrderList(order, req.user.role) });
});

exports.exportOrdersPdf = catchAsync(async (req, res) => {
  const PDFDocument = require("pdfkit");

  const all = [];
  // Export is bounded, paginated on the server and shares the list predicate.
  for (let page = 1; page <= 10; page++) {
    const result = await workspace.queryWorkspace({ ...req.query, page, limit: 50 }, req.user.role);
    all.push(...result.orders);
    if (page >= result.totalPages) break;
  }
  const orders = all;

  const STATUS_ES = {
    pendiente: "Pendiente",
    pago_pendiente: "Pago pendiente",
    pagado: "Pagado",
    en_preparacion: "En preparación",
    enviado: "Enviado",
    entregado: "Entregado",
    cancelado: "Cancelado",
    rechazado: "Rechazado",
    devuelto: "Devuelto",
  };
  const PM_ES = { wompi: "Wompi", nequi_manual: "Nequi", contra_entrega: "Contraentrega" };
  const fmt = (n) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);

    doc.fontSize(16).text("Listado de pedidos — Dizor", { align: "center" });
    doc.fontSize(10).text(
      `Generado: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}   Total: ${orders.length} pedido(s)`,
      { align: "center" }
    );
    doc.moveDown(1);

    for (const order of orders) {
      const date = new Date(order.createdAt).toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota",
      });
      doc
        .fontSize(10)
        .text(
          `${order.orderNumber}  ·  ${date}  ·  ${order.buyer.name}  ·  ${STATUS_ES[order.orderStatus] || order.orderStatus}  ·  ${PM_ES[order.paymentMethod] || order.paymentMethod}  ·  ${fmt(order.total)}`
        );
    }

    doc.end();
  });

  const filename = `dizor-pedidos-${Date.now()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.concat(chunks));
});

exports.assignOrder = catchAsync(async (req, res, next) => {
  if (!isAdmin(req.user.role)) {
    return next(new AppError("Solo administradores pueden asignar pedidos", 403));
  }

  const { assignedTo } = req.body;
  if (assignedTo) {
    const User = require("../models/user");
    if (!await User.exists({ _id: assignedTo, isActive: true, role: { $in: ["admin", "superadmin", "vendedor"] } })) {
      throw new AppError("El responsable debe ser personal activo", 400);
    }
  }
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { assignedTo: assignedTo || null },
    { new: true }
  );

  if (!order) {
    return next(new AppError("Pedido no encontrado", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Pedido asignado",
    order: formatOrderList(order, req.user.role),
  });
});

exports.reconcileWompi = catchAsync(async (req, res) => {
  if (!isAdmin(req.user.role)) throw new AppError("Solo administradores pueden conciliar", 403);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Pedido no encontrado", 404);
  if (order.paymentMethod !== "wompi") throw new AppError("Este pedido no usa Wompi", 409);
  const transactionIds = Object.hasOwn(req.body, "transactionId") ? [req.body.transactionId]
    : await require("../services/wompiTransactionRecovery").knownTransactionIds(order);
  for (const transactionId of transactionIds) await reconcileWompiTransaction(order, transactionId, req.user);
  const updated = await Order.findById(order._id);
  const message = updated.requiresReview || updated.incidents.some(i => !i.resolvedAt)
    ? "Verificación completada. El pedido conserva incidencias que requieren revisión."
    : updated.paymentStatus === "pagado" ? "Pago confirmado con Wompi."
      : "Wompi todavía no confirma un pago aprobado para este pedido.";
  res.json({ status: "success", message });
});

async function reconcileWompiTransaction(order, transactionId, actor) {
  if (!require("../services/wompiTransactionRecovery").validId(transactionId)) throw new AppError("ID de transacción inválido", 409);
  const { getTransaction, getExpectedEventEnvironment } = require("../services/wompiService");
  let tx;
  try { tx = await getTransaction(transactionId); }
  catch (err) {
    if (["WOMPI_TRANSACTION_ID_INVALID", "WOMPI_TRANSACTION_NOT_FOUND"].includes(err.code)) throw err;
    await mutateOrder(order._id, async current => {
      const count = current.incidents.length;
      require("../services/orderOperations").addIncident(current, "reconciliation_query_failed", transactionId);
      if (current.incidents.length !== count) history(current, `Consulta Wompi fallida: ${transactionId}. ${err.code || "Proveedor no disponible"}`, actor);
    });
    throw new AppError("No se pudo consultar a Wompi. Conserva el pedido para revisión.", 503);
  }
  const completed = await require("../services/wompiPaymentService").processTransaction(order._id, tx, { environment: getExpectedEventEnvironment(), reconcile: true });
  if (!completed?.processedAt) throw new AppError("Conciliación aún no completada", 503);
  await mutateOrder(order._id, async (current, session) => {
    const failures = current.incidents.filter(i => i.code === "reconciliation_query_failed" && !i.resolvedAt);
    for (const i of failures) {
      i.resolvedAt = new Date(); i.resolution = { actor: actor.id, decision: "reconciled_with_provider",
        reason: "Consulta autenticada del pedido completada", evidence: { transactionId: tx.id, recordedAt: new Date() } };
    }
    if (failures.length) {
      history(current, `Incidencias de consulta superadas: ${failures.length}. Transacción consultada: ${tx.id}`, actor);
      await require("../models/AuditLog").create([{ userId: actor.id, userEmail: actor.email, role: actor.role,
        action: "wompi_query_failures_resolved", module: "orders", entityId: current._id, entityType: "order", success: true,
        previousData: { incidents: failures.map(i => ({ id: i._id, detail: i.detail })) }, newData: { transactionId: tx.id, receipt: completed._id, status: tx.status },
        summary: "Fallos de consulta superados mediante conciliación autenticada" }], { session });
    }
    if (failures.length || tx.status === "APPROVED") current.requiresReview = current.incidents.some(i => !i.resolvedAt);
  });
}

exports.resolveIncident = catchAsync(async (req, res) => {
  const { order } = await require("../services/paymentIncidentResolution").resolve(req.params.id, req.params.incidentId, req.body, req.user);
  res.json({ status: "success", message: "Resolución registrada con evidencia y auditoría", order: formatOrderList(order, req.user.role) });
});
exports.listPaymentEvents = catchAsync(async (req, res) => {
  const view = req.query.view || "pending";
  if (!["pending", "financial-follow-up", "closed-follow-up", "verified"].includes(view)) throw new AppError("Vista de eventos inválida", 400);
  if (view === "verified" && (typeof req.query.transactionId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(req.query.transactionId))) throw new AppError("Indica una transacción para consultar evidencia", 400);
  const filter = view === "verified" ? { $or: [{ source: "provider_query" }, { "providerObservation.checkedAt": { $exists: true } }], processedAt: { $ne: null }, processingState: "processed",
    transactionId: req.query.transactionId, environment: require("../services/wompiService").getExpectedEventEnvironment() }
    : require("../services/paymentEventArchive").filter(view);
  const events = await require("../models/paymentEvent").find(filter).sort({ createdAt: 1 }).limit(100)
    .select("transactionId status amountInCents currency environment reference paymentLinkId order processingState associationError lastError createdAt processedAt administrativeArchive").lean();
  const count = await require("../models/paymentEvent").countDocuments(filter);
  res.json({ status: "success", events, count });
});
exports.archivePaymentEvent = catchAsync(async (req, res) => {
  await require("../services/paymentEventArchive").archive(req.params.eventId, req.body, req.user);
  res.json({ status: "success", message: "Archivo administrativo registrado. El seguimiento financiero continúa abierto." });
});
exports.reopenPaymentEvent = catchAsync(async (req, res) => {
  await require("../services/paymentEventArchive").reopen(req.params.eventId, req.body, req.user);
  res.json({ status: "success", message: "Evento reabierto para revisión y conciliación" });
});
exports.concludePaymentEventFollowUp = catchAsync(async (req, res) => {
  await require("../services/paymentEventArchive").conclude(req.params.eventId, req.body, req.user);
  res.json({ status: "success", message: "Seguimiento concluido con evidencia autenticada. El archivo y la auditoría se conservan." });
});
exports.reprocessPaymentEvent = catchAsync(async (req, res) => {
  await require("../services/wompiEventRecovery").reprocess(req.params.eventId);
  res.json({ status: "success", message: "Estado actual consultado y reprocesado sin asociación manual" });
});

exports.getWompiRecoveryStatus = catchAsync(async (_req, res) => {
  res.json({ status: "success", ...await require("../services/wompiRecoveryStatus").inspect() });
});

