"use client";
import { useState } from "react";
import { getPaymentEvents, reprocessPaymentEvent } from "@/services/orderAdminService";
export default function PaymentEventAlerts({ alerts, oldPending }) {
  const [events, setEvents] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const load = async () => {
    setBusy(true); setMessage("");
    try { setEvents((await getPaymentEvents()).events); } catch { setMessage("No se pudieron consultar los eventos. Intenta actualizar."); } finally { setBusy(false); }
  };
  return <section className="order-detail-card"><h2>Conciliación Wompi</h2>
    <p>Eventos sin completar: {alerts?.count || 0}. Pedidos pendientes por más de 24 horas: {oldPending?.count || 0}. Estas señales no confirman un pago.</p>
    <button type="button" className="admin-btn" disabled={busy} onClick={load}>Consultar eventos de pago pendientes</button>
    {message && <p role="status">{message}</p>}
    {(events || []).map(e => <div key={e._id}><p>{e.transactionId} · {e.status} · {e.environment} · {e.associationError || e.lastError || e.processingState}</p>
      <button className="admin-btn" type="button" disabled={busy} onClick={async () => {
        setBusy(true); setMessage("");
        try { await reprocessPaymentEvent(e._id); setEvents((await getPaymentEvents()).events); setMessage("Estado consultado con Wompi. Revisa el pedido y sus incidencias."); }
        catch (err) { setMessage(err.response?.data?.message || "Resultado sin confirmar. Actualiza antes de reintentar."); }
        finally { setBusy(false); }
      }}>Consultar y reprocesar con Wompi</button>
    </div>)}
  </section>;
}
