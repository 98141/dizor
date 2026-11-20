"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OrderCommunications from "./OrderCommunications";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import {
  getAdminOrder,
  updateOrderStatus,
  confirmPayment,
  reconcileWompi,
  updateOrderShipping,
} from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  CARRIER_LABELS,
  getStatusBadgeClass,
} from "@/lib/orderLabels";

const INCIDENT_LABELS = {
  checkout_completion_failed: "Pedido registrado pendiente de completar",
  approved_without_stock: "Pago recibido sin inventario disponible",
  approved_after_cancellation: "Pago recibido después del cierre del pedido",
  payment_amount_or_currency_mismatch: "El monto o la moneda recibidos requieren conciliación",
  additional_approved_payment: "Hay un pago aprobado adicional",
  payment_processing_failed: "Aplicación del pago pendiente de reintento",
  received_payment_pending_resolution: "Dinero recibido pendiente de tratamiento administrativo",
  cancelled_wompi_watch: "Cancelación pendiente de vigilancia de pagos tardíos",
  cancellation_verification_pending: "Cancelación pendiente de verificar el pago",
  payment_link_creation_failed: "Enlace de pago pendiente de revisión",
  approval_on_refunded_order: "Aprobación recibida sobre un pago con reembolso histórico",
  coupon_reconciliation: "Cupón pendiente de conciliación",
};

export default function OrderDetail({ orderId, backHref }) {
  const { user } = useAuth();
  const { siteName } = useSiteConfig();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [collectionReference, setCollectionReference] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

  const allowedStatuses = order ? [order.orderStatus, ...(order.allowedTransitions || [])] : [];
  const canConfirm = !!order?.canConfirmCollection;

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrder(orderId);
      setOrder(data.order);
      setNewStatus(data.order.orderStatus);
      setTrackingNumber(data.order.trackingNumber || "");
      setCarrier(data.order.carrier || "");
      setPaymentProofUrl(data.order.paymentProofUrl || "");
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) load();
  }, [orderId]);

  const handleConfirmPayment = async () => {
    setError("");
    setMessage("");
    try {
      await confirmPayment(orderId, {
        paymentProofUrl,
        reference: collectionReference,
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : "",
        note: "Pago confirmado desde panel",
      });
      setMessage("Recaudo registrado");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Error al confirmar pago");
    }
  };

  const handleUpdateStatus = async () => {
    setError("");
    setMessage("");
    try {
      await updateOrderStatus(orderId, {
        orderStatus: newStatus,
        note: statusNote,
      });
      setMessage("Estado actualizado");

      const rawPhone = order?.buyer?.phone?.replace(/\D/g, "");
      if (rawPhone) {
        const statusLabel = ORDER_STATUS_LABELS[newStatus] || newStatus;

        const productLines = (order.items || []).map((item) => {
          const variant = [item.sizeName, item.colorName].filter(Boolean).join(" / ");
          return `• ${item.productName}${variant ? ` (${variant})` : ""} x${item.quantity}`;
        });

        const lines = [
          `Hola ${order.buyer.name},`,
          ``,
          `Tu pedido *${order.orderNumber}* en ${siteName} ha cambiado de estado:`,
          `*${statusLabel}*`,
          ``,
          `📦 Productos:`,
          ...productLines,
          ``,
          `Total: ${formatCOP(order.total)}`,
        ];

        if (newStatus === "enviado" && carrier && trackingNumber) {
          lines.push(
            ``,
            `🚚 Transportadora: ${CARRIER_LABELS[carrier] || carrier}`,
            `📋 Guía: ${trackingNumber}`
          );
        }

        lines.push(``, `Gracias por tu compra.`);
        window.open(
          `https://wa.me/57${rawPhone}?text=${encodeURIComponent(lines.join("\n"))}`,
          "_blank",
          "noopener,noreferrer"
        );
      }

      load();
    } catch (err) {
      setError(err.response?.data?.message || "Error al actualizar estado");
    }
  };

  const handleUpdateShipping = async () => {
    setError("");
    setMessage("");
    try {
      await updateOrderShipping(orderId, {
        carrier,
        trackingNumber,
      });
      setMessage("Envío actualizado");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Error al actualizar envío");
    }
  };

  const handleReconcile = async () => {
    setError(""); setMessage("");
    try {
      const result = await reconcileWompi(orderId);
      setMessage(result.message); load();
    } catch (err) { setError(err.response?.data?.message || "No se pudo consultar a Wompi"); }
  };

  if (loading) return <p className="auth-loading">Cargando pedido...</p>;
  if (!order) return <p className="catalog-empty">Pedido no encontrado</p>;

  const whatsappMsg = encodeURIComponent(
    `Hola ${order.buyer.name}, tu pedido ${order.orderNumber} en ${siteName} está ${ORDER_STATUS_LABELS[order.orderStatus]}.`
  );

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link href={backHref}>← Volver a pedidos</Link>
      </p>

      <div className="admin-page__header">
        <h1 className="admin-page__title">{order.orderNumber}</h1>
        <span className={`status-badge ${getStatusBadgeClass(order.orderStatus)}`}>
          {ORDER_STATUS_LABELS[order.orderStatus]}
        </span>
      </div>

      {message && (
        <p style={{ color: "var(--color-success)", marginBottom: "1rem" }}>
          {message}
        </p>
      )}
      {error && (
        <p style={{ color: "var(--color-error)", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      <div className="order-detail-grid">
        <div>
          <div className="order-detail-card">
            <h2>Cliente</h2>
            <div className="order-detail-row">
              <span>Nombre</span>
              <span>{order.buyer.name}</span>
            </div>
            <div className="order-detail-row">
              <span>Correo</span>
              <span>{order.buyer.email}</span>
            </div>
            <div className="order-detail-row">
              <span>Teléfono</span>
              <span>
                <a
                  href={`https://wa.me/57${order.buyer.phone.replace(/\D/g, "")}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {order.buyer.phone} (WhatsApp)
                </a>
              </span>
            </div>
          </div>

          <div className="order-detail-card">
            <h2>Envío</h2>
            <div className="order-detail-row">
              <span>Dirección</span>
              <span>{order.shippingAddress.address}</span>
            </div>
            <div className="order-detail-row">
              <span>Ciudad</span>
              <span>
                {order.shippingAddress.city}, {order.shippingAddress.department}
              </span>
            </div>
            {order.customerNotes && (
              <div className="order-detail-row">
                <span>Notas</span>
                <span>{order.customerNotes}</span>
              </div>
            )}
          </div>

          <div className="order-detail-card">
            <h2>Productos ({order.items.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table order-items-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Talla</th>
                    <th>Color</th>
                    <th>Cant.</th>
                    <th>Precio unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="order-item-cell">
                          <div className="order-item__img-wrap">
                            {item.productImage ? (
                              <img
                                src={item.productImage}
                                alt={item.productName}
                                className="order-item__img"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="order-item__img-placeholder" />
                            )}
                          </div>
                          <div>
                            <p className="order-item__name">{item.productName}</p>
                            {item.sku && (
                              <p className="order-item__sku">SKU: {item.sku}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{item.sizeName || "—"}</td>
                      <td>{item.colorName || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {(item.unitPrice ?? 0) > 0
                          ? formatCOP(item.unitPrice)
                          : "—"}
                      </td>
                      <td className="order-item__total-cell">
                        {formatCOP(item.lineTotal ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="order-detail-card">
            <h2>Resumen de precios</h2>
            {(order.subtotal ?? 0) > 0 && (
              <div className="order-detail-row">
                <span>Subtotal</span>
                <span>{formatCOP(order.subtotal)}</span>
              </div>
            )}
            {order.ivaEnabled && (order.taxTotal ?? 0) > 0 && (
              <div className="order-detail-row">
                <span>
                  IVA
                  {(order.ivaPercent ?? 0) > 0
                    ? ` (${order.ivaPercent}%)`
                    : ""}
                </span>
                <span>{formatCOP(order.taxTotal)}</span>
              </div>
            )}
            <div className="order-detail-row">
              <span>Envío</span>
              <span>
                {order.shippingIncluded
                  ? "Incluido en el precio"
                  : order.freeShippingApplied
                    ? "Gratis (promoción anterior)"
                    : formatCOP(order.shippingCost ?? 0)}
              </span>
            </div>
            <div className="order-detail-row">
              <span>Cupón</span>
              <span>
                {order.couponCode
                  ? `${order.couponCode} — −${formatCOP(
                      order.discountTotal ?? 0
                    )}`
                  : "Sin cupón"}
              </span>
            </div>
            <div className="order-detail-row order-pricing__total">
              <span>Total del pedido</span>
              <span>{formatCOP(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="order-actions">
          <div className="order-detail-card">
            <h2>Pago</h2>
            <p>
              {PAYMENT_METHOD_LABELS[order.paymentMethod]} —{" "}
              <span className={`status-badge ${getStatusBadgeClass(order.paymentStatus)}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </span>
            </p>
            {order.requiresReview && <p role="alert">Requiere revisión y conciliación administrativa.</p>}
            {order.paymentMethod === "wompi" && order.wompi?.transactionId && ["admin", "superadmin"].includes(user?.role) && (
              <button type="button" className="admin-btn" onClick={handleReconcile}>Consultar y conciliar con Wompi</button>
            )}
            {order.incidents?.map((incident) => <p key={incident._id}>{INCIDENT_LABELS[incident.code] || "Incidencia administrativa"}: {incident.detail}{incident.resolvedAt ? " (conciliado)" : ""}</p>)}
            {order.wompi?.expiresAt && <p>Vigencia del enlace: {new Date(order.wompi.expiresAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>}
            {order.collection?.reference && <p>Recaudo: {order.collection.reference} · {new Date(order.collection.receivedAt).toLocaleString("es-CO")}</p>}
            {canConfirm && (
              <>
                <label className="auth-field__label">Referencia de recaudo
                  <input value={collectionReference} onChange={(e) => setCollectionReference(e.target.value)} required />
                </label>
                <label className="auth-field__label">Fecha del recaudo
                  <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
                </label>
                <label className="auth-field__label" style={{ marginTop: "1rem" }}>
                  URL comprobante (opcional)
                </label>
                <input
                  value={paymentProofUrl}
                  onChange={(e) => setPaymentProofUrl(e.target.value)}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  style={{ marginTop: "0.75rem", width: "100%" }}
                  onClick={handleConfirmPayment}
                >
                  Registrar recaudo
                </button>
              </>
            )}
          </div>

          <div className="order-detail-card">
            <h2>Cambiar estado</h2>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {allowedStatuses.map((k) => (
                <option key={k} value={k}>
                  {ORDER_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
            {newStatus === "enviado" && (!order.carrier || !order.trackingNumber) && (
              <p style={{ fontSize: "0.82rem", color: "var(--color-error)", marginTop: "0.4rem" }}>
                Para enviar debes guardar primero transportadora y número de guía.
              </p>
            )}
            <textarea
              rows={2}
              placeholder="Nota interna"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              style={{ marginTop: "0.5rem" }}
            />
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              style={{ marginTop: "0.5rem", width: "100%" }}
              onClick={handleUpdateStatus}
            >
              Actualizar estado
            </button>
          </div>

          <div className="order-detail-card">
            <h2>Guía de envío</h2>
            <select disabled={!order.canUpdateShipping} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              {Object.entries(CARRIER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              style={{ marginTop: "0.5rem" }}
              placeholder="Número de guía"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
            <button
              type="button"
              className="admin-btn"
              style={{ marginTop: "0.5rem", width: "100%" }}
              disabled={!order.canUpdateShipping}
              onClick={handleUpdateShipping}
            >
              Guardar guía
            </button>
          </div>

          <OrderCommunications key={orderId} orderId={orderId} />
          {order.statusHistory?.length > 0 && (
            <div className="order-detail-card">
              <h2>Historial</h2>
              <ul className="order-history">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <li key={i}>
                    <strong>{ORDER_STATUS_LABELS[h.status] || h.status}</strong>
                    {h.note && ` — ${h.note}`}
                    <br />
                    <small>
                      {new Date(h.changedAt).toLocaleString("es-CO")}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
