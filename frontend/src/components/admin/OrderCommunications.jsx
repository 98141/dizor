"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderCommunications, retryOrderCommunication, resendOrderCommunication } from "@/services/orderAdminService";
import styles from "./OrderCommunications.module.css";
const STATES = { pending: "Pendiente", processing: "En procesamiento", sent: "Aceptado por el proveedor", failed: "Fallido", skipped: "No enviado", delivered: "Entrega verificada" };
const date = (value) => value ? new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—";

export default function OrderCommunications({ orderId }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);
  const inFlightRef = useRef(false);
  const resendPayloadRef = useRef(null);
  const completedResendRef = useRef(false);
  const reasonRef = useRef(null);
  const load = useCallback(async () => {
    try { const result = await getOrderCommunications(orderId, page); setData(result); setError(""); }
    catch { setError("No se pudo cargar el historial de comunicaciones."); }
    finally { setLoading(false); }
  }, [orderId, page]);
  useEffect(() => {
    let active = true;
    getOrderCommunications(orderId, page).then((result) => {
      if (active) { setData(result); setError(""); }
    }).catch(() => { if (active) setError("No se pudo cargar el historial de comunicaciones."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId, page]);
  useEffect(() => { if (confirm) reasonRef.current?.focus(); }, [confirm]);
  const run = async (row, resend = false) => {
    if (inFlightRef.current || (resend && completedResendRef.current)) return;
    if (resend && (reason.trim().length < 5 || (row.ambiguous && !acknowledge))) {
      setError("Escribe un motivo de al menos cinco caracteres y confirma el posible envío previo cuando corresponda."); return;
    }
    inFlightRef.current = true; setBusy(row.id); setError(""); setMessage("");
    try {
      if (resend) {
        setResendLocked(true);
        resendPayloadRef.current ||= { requestKey: crypto.randomUUID(), reason: reason.trim(), confirmed: true, acknowledgeDuplicateRisk: acknowledge };
        await resendOrderCommunication(orderId, row.id, resendPayloadRef.current);
        completedResendRef.current = true;
        setResendLocked(false);
        setConfirm(null); resendPayloadRef.current = null;
        setMessage("Reenvío registrado. Su aceptación por el proveedor se mostrará en el historial.");
      } else { await retryOrderCommunication(orderId, row.id); setMessage("Reintento registrado con la misma comunicación."); }
      await load();
    } catch (err) {
      if (resend && [400, 403, 404, 409, 422].includes(err.response?.status)) {
        resendPayloadRef.current = null; setResendLocked(false);
      }
      setError(err.response?.data?.message || "No se pudo confirmar la operación. Reintenta conservando esta solicitud.");
    }
    finally { inFlightRef.current = false; setBusy(null); }
  };
  return <section className={`order-detail-card ${styles.panel}`} aria-labelledby="order-communications-title">
    <h2 id="order-communications-title">Comunicaciones</h2>
    <p className={styles.hint}>Aceptado por el proveedor significa que recibió la solicitud. No confirma entrega al buzón.</p>
    <button type="button" className="admin-btn" disabled={!!busy || loading} onClick={() => { setLoading(true); void load(); }}>Actualizar historial</button>
    {loading && <p role="status">Cargando comunicaciones…</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {data?.deliveryEnabled === false && <p role="status">La entrega de correos está desactivada en este entorno. Los eventos se conservan sin envío.</p>}
    {data?.legacyReceipt && <p>Existe un registro histórico de acuse del {date(data.legacyReceipt.recordedAt)}. Esta bandeja no verifica su aceptación ni su entrega y no lo reenvía automáticamente.</p>}
    {data && !loading && data.notifications.length === 0 && <p>No hay comunicaciones registradas en esta bandeja.</p>}
    {data?.notifications.map((row) => <article key={row.id} className={styles.item} aria-busy={busy === row.id}>
      <h3>{row.event}{row.resend ? " · Reenvío explícito" : ""}</h3>
      <p>{row.recipient} · <strong>{STATES[row.status] || "Pendiente de revisión"}</strong></p>
      <p className={styles.hint}>Creado: {date(row.createdAt)} · Intentos: {row.attempts}</p>
      {row.lastAttemptAt && <p className={styles.hint}>Último intento: {date(row.lastAttemptAt)}</p>}
      {row.acceptedAt && <p className={styles.hint}>Aceptación: {date(row.acceptedAt)}</p>}
      {row.deliveredAt && <p className={styles.hint}>Entrega verificada: {date(row.deliveredAt)}</p>}
      {row.nextAttemptAt && row.status === "failed" && <p>Próximo intento: {date(row.nextAttemptAt)}</p>}
      {row.error && <p>{row.error}</p>}
      {row.superseded && <p>Reemplazado por un reenvío explícito. Se conserva este registro histórico.</p>}
      <div className={styles.actions}>
        {row.retryable && <button type="button" className="admin-btn" disabled={!!busy} onClick={() => run(row)}>Reintentar pendiente</button>}
        {row.canResend && <button type="button" className="admin-btn" disabled={!!busy || !!confirm} onClick={() => {
          setConfirm(row); setReason(""); setAcknowledge(false); setResendLocked(false); resendPayloadRef.current = null; completedResendRef.current = false;
        }}>Solicitar reenvío</button>}
      </div>
      {busy === row.id && <p role="status">Registrando solicitud…</p>}
    </article>)}
    {confirm && <fieldset className={styles.confirm}>
      <legend>Confirmar nuevo envío de «{confirm.event}»</legend>
      <p>Se creará una comunicación adicional. El envío anterior se conservará. No se repetirá ninguna operación del pedido.</p>
      <label>Motivo del reenvío<input ref={reasonRef} value={reason} minLength={5} maxLength={300} disabled={!!busy || resendLocked} onChange={(e) => setReason(e.target.value)} /></label>
      {confirm.ambiguous && <label><input type="checkbox" checked={acknowledge} disabled={!!busy || resendLocked} onChange={(e) => setAcknowledge(e.target.checked)} />Entiendo que el envío anterior puede haber sido aceptado y que este nuevo correo podría duplicarlo.</label>}
      <div className={styles.actions}>
        <button type="button" className="admin-btn admin-btn--primary" disabled={!!busy} onClick={() => run(confirm, true)}>Confirmar reenvío</button>
        <button type="button" className="admin-btn" disabled={!!busy || resendLocked} onClick={() => { setConfirm(null); resendPayloadRef.current = null; }}>Cancelar</button>
      </div>
    </fieldset>}
    {data?.pages > 1 && <nav className={styles.actions} aria-label="Páginas de comunicaciones">
      <button type="button" className="admin-btn" disabled={page === 1 || !!busy || loading} onClick={() => { setLoading(true); setPage(page - 1); }}>Anterior</button>
      <span>Página {page} de {data.pages}</span>
      <button type="button" className="admin-btn" disabled={page === data.pages || !!busy || loading} onClick={() => { setLoading(true); setPage(page + 1); }}>Siguiente</button>
    </nav>}
  </section>;
}
