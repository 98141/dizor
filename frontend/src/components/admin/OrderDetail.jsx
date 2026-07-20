"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import {
  getAdminOrder,
  updateOrderStatus,
  confirmPayment,
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

export default function OrderDetail({ orderId, backHref }) {
  const { user } = useAuth();
  const { siteName } = useSiteConfig();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

  const allowedStatuses =
    user?.role === "vendedor"
      ? ["pago_pendiente", "pagado", "en_preparacion", "enviado"]
      : Object.keys(ORDER_STATUS_LABELS);

  const canConfirm =
    order?.paymentStatus === "pendiente" &&
    ["nequi_manual", "contra_entrega", "wompi"].includes(order?.paymentMethod);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrder(orderId);
      setOrder(data.order);
      setNewStatus(data.order.orderStatus);
      setTrackingNumber(data.order.trackingNumber || "");
      setCarrier(data.order.carrier || "interrapidisimo");
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
        note: "Pago confirmado desde panel",
      });
      setMessage("Pago confirmado");
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
                {order.freeShippingApplied
                  ? "Gratis"
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
              <span>Total pagado</span>
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
            {canConfirm && (
              <>
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
                  Confirmar pago
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
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
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
              onClick={handleUpdateShipping}
            >
              Guardar guía
            </button>
          </div>

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
