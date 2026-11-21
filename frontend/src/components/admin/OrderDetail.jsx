"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OrderCommunications from "./OrderCommunications";
import OrderNextAction from "./OrderNextAction";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { getAdminOrder, updateOrderStatus, confirmPayment, reconcileWompi, updateOrderShipping } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, CARRIER_LABELS } from "@/lib/orderLabels";
import { formatOrderDate, returnToOrders } from "@/lib/orderWorkspace";
import styles from "./OrderWorkspace.module.css";
export default function OrderDetail(props) {
  return <Suspense fallback={<p role="status">Cargando pedido…</p>}><OrderWorkspaceDetail {...props} /></Suspense>;
}
function OrderWorkspaceDetail({ orderId, backHref = "/admin/pedidos" }) {
  const params = useSearchParams();
  const { siteName } = useSiteConfig();
  const back = returnToOrders(params.get("returnTo"), backHref);
  const [version, setVersion] = useState(0);
  const key = `${orderId}:${version}`;
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [communicationsVersion, setCommunicationsVersion] = useState(0);
  const inFlightRef = useRef(false);
  useEffect(() => {
    let active = true;
    getAdminOrder(orderId).then((result) => {
      if (active) { setState({ key, order: result.order }); setLocked(false); }
    }).catch((err) => { if (active) setState({ key, error: err.response?.status === 404 ? "No se encontró este pedido." : "No se pudo cargar el pedido. Inténtalo de nuevo." }); });
    return () => { active = false; };
  }, [key, orderId]);
  const loading = state?.key !== key;
  const order = !loading && state?.order;
  const loadError = !loading && state?.error;
  const execute = async (code, values) => {
    if (inFlightRef.current || locked) return false;
    inFlightRef.current = true; setBusy(true); setError(""); setMessage("");
    let recorded = false;
    try {
      if (code === "collect") await confirmPayment(orderId, values);
      else if (code === "reconcile") await reconcileWompi(orderId);
      else if (["dispatch", "correct"].includes(code)) await updateOrderShipping(orderId, values);
      else {
        const status = { prepare: "en_preparacion", deliver: "entregado", cancel: "cancelado", return: "devuelto" }[code];
        if (!status) throw new Error("Acción no disponible");
        await updateOrderStatus(orderId, { orderStatus: status, note: values.note || "" });
      }
      recorded = true;
      const result = await getAdminOrder(orderId);
      setState({ key, order: result.order });
      setCommunicationsVersion((v) => v + 1);
      setMessage(code === "collect" ? "Recaudo verificado en el registro. El despacho y la entrega no se modificaron." : code === "reconcile" ? "Consulta completada. Revisa el estado y las incidencias resultantes." : "Operación registrada. La siguiente acción y las comunicaciones se actualizaron.");
      return true;
    } catch (err) {
      const uncertain = recorded || !err.response || err.response.status >= 500;
      if (uncertain) setLocked(true);
      setError(recorded ? "La operación se registró, pero no se pudo actualizar la pantalla. Actualiza el pedido antes de continuar." : err.response?.data?.message || "No se pudo confirmar el resultado. Actualiza el pedido antes de volver a intentarlo.");
      return false;
    } finally { inFlightRef.current = false; setBusy(false); }
  };
  const refresh = () => { setError(""); setVersion((v) => v + 1); };
  const phone = (order?.buyer?.phone || "").replace(/\D/g, "");
  const waPhone = phone.length === 10 ? `57${phone}` : phone;
  const whatsappText = order ? encodeURIComponent(`Hola ${order.buyer?.name}, tu pedido ${order.orderNumber} en ${siteName} está ${ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}.`) : "";
  return <div className={styles.workspace}>
    <div className={styles.header}><Link href={back}>← Volver a pedidos</Link><button type="button" className="admin-btn" disabled={busy || loading} onClick={refresh}>Actualizar pedido</button></div>
    {loading && <p role="status" className={styles.notice}>Cargando pedido…</p>}
    {loadError && <div className={`${styles.notice} ${styles.error}`} role="alert"><p>{loadError}</p><button type="button" className="admin-btn" onClick={refresh}>Reintentar carga</button></div>}
    {message && <p role="status" className={`${styles.notice} ${styles.success}`}>{message}</p>}
    {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}
    {order && <>
      <header><p className={styles.eyebrow}>Pedido · {formatOrderDate(order.createdAt)}</p><h1>{order.orderNumber}</h1><div className={styles.summary}><span className={styles.badge}>{ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}</span><span>Pago: {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</span><span>{PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</span><strong>{formatCOP(order.total)}</strong>{order.operation?.requiresReview && <span className={`${styles.badge} ${styles.attention}`}>Requiere revisión</span>}</div></header>
      <OrderNextAction key={`${orderId}:${order.orderStatus}:${order.paymentStatus}`} order={order} execute={execute} busy={busy} locked={locked} />
      <div className={styles.detail}>
        <div className={styles.stack}>
          <section className={styles.panel}><h2>Productos · {order.items?.length || 0}</h2><ul className={styles.list}>{(order.items || []).map((item, index) => <li key={item._id || index}><div className={styles.product}>{item.productImage && <img src={item.productImage} alt="" loading="lazy" decoding="async" />}<div><strong>{item.productName}</strong><p className={styles.muted}>{[item.sizeName, item.colorName, item.sku].filter(Boolean).join(" · ")}</p><p>{item.quantity} × {formatCOP(item.unitPrice)} · <strong>{formatCOP(item.lineTotal)}</strong></p></div></div></li>)}</ul>
            <dl className={styles.rows}><dt>Subtotal</dt><dd>{formatCOP(order.subtotal)}</dd>{order.ivaEnabled && <><dt>IVA {order.ivaPercent || ""}%</dt><dd>{formatCOP(order.taxTotal)}</dd></>}<dt>Envío</dt><dd>{order.shippingIncluded ? "Incluido en el precio" : order.freeShippingApplied ? "Gratis (promoción anterior)" : formatCOP(order.shippingCost)}</dd><dt>Cupón</dt><dd>{order.couponCode ? `${order.couponCode} · −${formatCOP(order.discountTotal)}` : "Sin cupón"}</dd><dt>Total del pedido</dt><dd><strong>{formatCOP(order.total)}</strong></dd></dl>
          </section>
          <section className={styles.panel}><h2>Historial del pedido</h2>{order.statusHistory?.length ? <ol className={styles.list}>{[...order.statusHistory].reverse().map((entry, index) => <li key={entry._id || index}><strong>{ORDER_STATUS_LABELS[entry.status] || entry.status}</strong>{entry.note && <p>{entry.note}</p>}<small className={styles.muted}>{formatOrderDate(entry.changedAt)}</small></li>)}</ol> : <p>No hay cambios registrados en el historial disponible.</p>}</section>
          <OrderCommunications key={`${orderId}:${communicationsVersion}`} orderId={orderId} />
        </div>
        <div className={styles.stack}>
          <section className={styles.panel}><h2>Cliente y entrega</h2><p><strong>{order.buyer?.name}</strong></p><p>{order.buyer?.email}</p><p>{order.buyer?.phone}</p><p>{[order.shippingAddress?.address, order.shippingAddress?.city, order.shippingAddress?.department].filter(Boolean).join(", ")}</p>{order.customerNotes && <p>Nota del cliente: {order.customerNotes}</p>}{waPhone && <div className={styles.actions}><a href={`https://wa.me/${waPhone}?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="admin-btn">Abrir conversación en WhatsApp</a></div>}<p className={styles.muted}>Abrir la conversación no envía un mensaje.</p></section>
          <section className={styles.panel}><h2>Datos del envío</h2><dl className={styles.rows}><dt>Transportadora</dt><dd>{CARRIER_LABELS[order.carrier] || order.carrier || "Sin asignar"}</dd><dt>Guía</dt><dd>{order.trackingNumber || "Sin registrar"}</dd><dt>Entrega registrada</dt><dd>{order.deliveredAt ? formatOrderDate(order.deliveredAt) : "Sin fecha verificada"}</dd></dl>{order.shippingNotes && <p>Nota interna: {order.shippingNotes}</p>}</section>
          <section className={styles.panel}><h2>Información de pago</h2><p>{PAYMENT_METHOD_LABELS[order.paymentMethod]} · {PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>{order.collection?.reference && <p>Referencia de recaudo: {order.collection.reference} · {formatOrderDate(order.collection.receivedAt)}</p>}{order.paymentProofUrl && <p>Comprobante registrado: {order.paymentProofUrl}</p>}{order.wompi?.transactionId && <p>Transacción Wompi: {order.wompi.transactionId}</p>}{order.wompi?.expiresAt && <p>Vigencia del enlace: {formatOrderDate(order.wompi.expiresAt)}</p>}{order.operation?.reasons?.map((reason, index) => <p key={index} className={styles.notice}>{reason}</p>)}{order.incidents?.filter((i) => !i.resolvedAt).map((i, index) => <p key={i._id || index} className={styles.muted}>{i.detail}</p>)}{order.incidents?.some((i) => i.resolvedAt) && <details><summary>Incidencias resueltas</summary>{order.incidents.filter((i) => i.resolvedAt).map((i, index) => <p key={i._id || index}>Registro conciliado · {formatOrderDate(i.resolvedAt)}{i.detail && ` · ${i.detail}`}</p>)}</details>}</section>
        </div>
      </div>
    </>}
  </div>;
}
