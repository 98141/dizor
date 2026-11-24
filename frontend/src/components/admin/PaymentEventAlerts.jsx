"use client";
import { useState } from "react";
import { getPaymentEvents, reprocessPaymentEvent, archivePaymentEvent, reopenPaymentEvent, concludePaymentEventFollowUp } from "@/services/orderAdminService";
export default function PaymentEventAlerts({ alerts, oldPending, financialFollowUp }) {
  const [events, setEvents] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState(null), [review, setReview] = useState(null), [proofs, setProofs] = useState([]);
  const [counts, setCounts] = useState(null);
  const [closed, setClosed] = useState([]);
  const refresh = async () => {
    const [pending, financial, completed] = await Promise.all([getPaymentEvents(), getPaymentEvents({ view: "financial-follow-up" }), getPaymentEvents({ view: "closed-follow-up" })]);
    setEvents(pending.events); setFollowUp(financial.events);
    setCounts({ pending: pending.count, financial: financial.count });
    setClosed(completed.events);
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
  // Sprint 01: presentation only (dz- classes); every request and decision flow is unchanged.
  return <div className="dz-payments"><h3 className="dz-payments__title">Conciliación Wompi</h3>
    <dl className="dz-payments__stats">
      <div><dt>Eventos sin completar</dt><dd>{counts?.pending ?? alerts?.count ?? 0}</dd></div>
      <div><dt>Pendientes &gt; 24 h</dt><dd>{oldPending?.count || 0}</dd></div>
      <div><dt>Seguimiento financiero abierto</dt><dd>{counts?.financial ?? financialFollowUp?.count ?? 0}</dd></div>
    </dl>
    <p className="dz-payments__note">Estas señales no confirman un pago. Archivar no resuelve el pago ni autoriza despacho.</p>
    <button type="button" className="dz-btn dz-btn--sm" disabled={busy} onClick={load}>Consultar eventos de pago pendientes</button>
    {message && <p role="status" className="dz-payments__message">{message}</p>}
    {(events || []).length > 0 && <h4 className="dz-payments__sub">Eventos pendientes</h4>}
    {(events || []).map(e => <div key={e._id} className="dz-payment-event"><p><span className="dz-mono">{e.transactionId}</span> · {e.status} · {e.environment} · {e.associationError || e.lastError || e.processingState}</p><div className="dz-payment-event__actions">
      <button className="admin-btn" type="button" disabled={busy} onClick={async () => {
        setBusy(true); setMessage("");
        try { await reprocessPaymentEvent(e._id); await refresh(); setMessage("Estado consultado con Wompi. Revisa el pedido y sus incidencias."); }
        catch (err) { setMessage(err.response?.data?.message || "Resultado sin confirmar. Actualiza antes de reintentar."); }
        finally { setBusy(false); }
      }}>Consultar y reprocesar con Wompi</button>
      <button className="admin-btn" type="button" disabled={busy} onClick={() => investigate(e, "archive")}>Investigar archivo</button>
    </div></div>)}
    {(followUp || []).length > 0 && <h4 className="dz-payments__sub">Seguimiento financiero de archivos</h4>}
    {(followUp || []).map(e => <div key={e._id} className="dz-payment-event">
      <p><span className="dz-mono">{e.transactionId}</span> · {e.status} · {e.administrativeArchive.reason} · Evidencia: {e.administrativeArchive.evidenceReceipt}</p>
      <div className="dz-payment-event__actions"><button className="admin-btn" type="button" disabled={busy} onClick={() => investigate(e, "reopen")}>Reabrir para revisar nueva evidencia</button>
      <button className="admin-btn" type="button" disabled={busy} onClick={() => investigate(e, "conclude")}>Concluir seguimiento con evidencia</button></div>
    </div>)}
    {closed.length > 0 && <h4 className="dz-payments__sub">Seguimientos concluidos · archivo consultable</h4>}
    {closed.map(e => <div key={e._id} className="dz-payment-event">
      <p><span className="dz-mono">{e.transactionId}</span> · {e.administrativeArchive.conclusionReason} · Concluido: {new Date(e.administrativeArchive.concludedAt).toLocaleString("es-CO")}</p>
      <div className="dz-payment-event__actions"><button className="admin-btn" type="button" disabled={busy} onClick={() => investigate(e, "reopen")}>Reabrir para revisar nueva evidencia</button></div>
    </div>)}
    {review && <form className="dz-payment-review" onSubmit={async ev => {
      ev.preventDefault(); setBusy(true); setMessage("");
      try {
        const operation = review.action === "archive" ? archivePaymentEvent : review.action === "conclude" ? concludePaymentEventFollowUp : reopenPaymentEvent;
        const result = await operation(review.event._id, { reason: review.reason, evidenceReceiptId: review.evidenceReceiptId });
        await refresh(); setReview(null); setMessage(result.message);
      } catch (err) { setMessage(err.response?.data?.message || "Resultado sin confirmar. Actualiza antes de reintentar."); }
      finally { setBusy(false); }
    }}>
      <h4>{review.action === "archive" ? "Archivo administrativo" : review.action === "conclude" ? "Concluir seguimiento financiero" : "Reapertura"}: {review.event.transactionId}</h4>
      {review.action === "conclude" && <p>Se comprobará de nuevo el pago con Wompi. Solo se concluye si el pedido está pagado, preparable y sin incidencias. El archivo seguirá visible y dejará de sumar alertas.</p>}
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
  </div>;
}
