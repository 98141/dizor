"use client";
import { useState } from "react";
import { getPaymentEvents, reprocessPaymentEvent, archivePaymentEvent, reopenPaymentEvent } from "@/services/orderAdminService";
export default function PaymentEventAlerts({ alerts, oldPending, financialFollowUp }) {
  const [events, setEvents] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState(null), [review, setReview] = useState(null), [proofs, setProofs] = useState([]);
  const [counts, setCounts] = useState(null);
  const refresh = async () => {
    const [pending, financial] = await Promise.all([getPaymentEvents(), getPaymentEvents({ view: "financial-follow-up" })]);
    setEvents(pending.events); setFollowUp(financial.events);
    setCounts({ pending: pending.count, financial: financial.count });
  };
  const load = async () => {
    setBusy(true); setMessage("");
    try { await refresh(); } catch { setMessage("No se pudieron consultar los eventos. Intenta actualizar."); } finally { setBusy(false); }
  };
  const investigate = async (event, action) => {
    setBusy(true); setMessage("");
    try {
      const candidates = action === "archive" ? (await getPaymentEvents({ view: "verified", transactionId: event.transactionId })).events : [];
      setProofs(candidates); setReview({ event, action, reason: "", evidenceReceiptId: "" });
    } catch { setMessage("No se pudo consultar la evidencia. Intenta actualizar."); }
    finally { setBusy(false); }
  };
  return <section className="order-detail-card"><h2>Conciliación Wompi</h2>
    <p>Eventos sin completar: {counts?.pending ?? alerts?.count ?? 0}. Pedidos pendientes por más de 24 horas: {oldPending?.count || 0}. Estas señales no confirman un pago.</p>
    <p>Archivos con seguimiento financiero abierto: {counts?.financial ?? financialFollowUp?.count ?? 0}. Archivar no resuelve el pago ni autoriza despacho.</p>
    <button type="button" className="admin-btn" disabled={busy} onClick={load}>Consultar eventos de pago pendientes</button>
    {message && <p role="status">{message}</p>}
    {(events || []).map(e => <div key={e._id}><p>{e.transactionId} · {e.status} · {e.environment} · {e.associationError || e.lastError || e.processingState}</p>
      <button className="admin-btn" type="button" disabled={busy} onClick={async () => {
        setBusy(true); setMessage("");
        try { await reprocessPaymentEvent(e._id); await refresh(); setMessage("Estado consultado con Wompi. Revisa el pedido y sus incidencias."); }
        catch (err) { setMessage(err.response?.data?.message || "Resultado sin confirmar. Actualiza antes de reintentar."); }
        finally { setBusy(false); }
      }}>Consultar y reprocesar con Wompi</button>
      <button className="admin-btn" type="button" disabled={busy} onClick={() => investigate(e, "archive")}>Investigar archivo</button>
    </div>)}
    {(followUp || []).length > 0 && <h3>Seguimiento financiero de archivos</h3>}
    {(followUp || []).map(e => <div key={e._id}>
      <p>{e.transactionId} · {e.status} · {e.administrativeArchive.reason} · Evidencia: {e.administrativeArchive.evidenceReceipt}</p>
      <button className="admin-btn" type="button" disabled={busy} onClick={() => investigate(e, "reopen")}>Reabrir para revisar nueva evidencia</button>
    </div>)}
    {review && <form onSubmit={async ev => {
      ev.preventDefault(); setBusy(true); setMessage("");
      try {
        const operation = review.action === "archive" ? archivePaymentEvent : reopenPaymentEvent;
        const result = await operation(review.event._id, { reason: review.reason, evidenceReceiptId: review.evidenceReceiptId });
        await refresh(); setReview(null); setMessage(result.message);
      } catch (err) { setMessage(err.response?.data?.message || "Resultado sin confirmar. Actualiza antes de reintentar."); }
      finally { setBusy(false); }
    }}>
      <h3>{review.action === "archive" ? "Archivo administrativo" : "Reapertura"}: {review.event.transactionId}</h3>
      <label>Motivo de la decisión <textarea required maxLength={1000} value={review.reason} onChange={ev => setReview({ ...review, reason: ev.target.value })} /></label>
      {review.action === "archive" && <>
        <label>Recibo autenticado procesado <select required value={review.evidenceReceiptId} onChange={ev => setReview({ ...review, evidenceReceiptId: ev.target.value })}>
          <option value="">Selecciona la evidencia investigada</option>
          {proofs.map(p => <option key={p._id} value={p._id}>{p._id} · {p.status} · {p.amountInCents / 100} {p.currency}</option>)}
        </select></label>
        {!proofs.length && <p>Falta evidencia autenticada procesada. Concilia el pedido antes de archivar.</p>}
        <p>El evento y su evidencia se conservan. El seguimiento financiero permanece abierto.</p>
      </>}
      <button className="admin-btn" type="submit" disabled={busy || (review.action === "archive" && !proofs.length)}>Registrar decisión</button>
      <button className="admin-btn" type="button" disabled={busy} onClick={() => setReview(null)}>Cancelar</button>
    </form>}
  </section>;
}
