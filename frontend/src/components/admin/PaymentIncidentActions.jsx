"use client";
import styles from "./OrderWorkspace.module.css";
const labels = {
  accept_discount: "Asumir el descuento ya cobrado", acknowledge_closed_watch: "Archivar vigilancia del pedido cerrado",
  archive_failed_checkout: "Archivar checkout fallido cerrado", record_void_review: "Registrar revisión de anulación consultada",
  manual_refund_confirmed: "Registrar evidencia de devolución manual realizada",
};
export default function PaymentIncidentActions({ order, execute, disabled }) {
  const incidents = (order.incidents || []).filter(i => !i.resolvedAt && i.allowedResolutions?.length);
  if (!incidents.length) return null;
  return <section className={styles.panel}><h2>Atender incidencias</h2>
    <p>Estas acciones conservan el historial. No confirman pagos ni ejecutan devoluciones de dinero. Las demás condiciones de pago e inventario siguen siendo obligatorias.</p>
    {incidents.map(i => <details key={i._id}><summary>{i.code} · {i.detail}</summary>
      <form className={styles.form} onSubmit={async e => {
        e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form));
        const evidence = { transactionId: data.transactionId, reference: data.reference, url: data.url,
          amountInCents: Number(data.amountInCents), currency: "COP", recordedAt: data.recordedAt ? new Date(`${data.recordedAt}:00-05:00`).toISOString() : undefined };
        if (await execute("resolveIncident", { incidentId: i._id, reason: data.reason, decision: data.decision, evidence })) form.reset();
      }}>
        <label>Decisión<select name="decision" required disabled={disabled}>{i.allowedResolutions.map(d => <option key={d} value={d}>{labels[d]}</option>)}</select></label>
        <label>Motivo y gestión realizada<textarea name="reason" required minLength={10} maxLength={1000} disabled={disabled} /></label>
        {i.allowedResolutions.includes("manual_refund_confirmed") && <fieldset><legend>Evidencia de devolución externa (sólo superadministración)</legend>
          <p>Adjunta el comprobante verificable del proceso manual ya realizado. Registrar esta evidencia no llama a una API de reembolso.</p>
          <label>ID del cobro devuelto<input name="transactionId" required disabled={disabled} /></label>
          <label>Referencia de devolución<input name="reference" minLength={6} maxLength={200} required disabled={disabled} /></label>
          <label>Comprobante HTTPS<input name="url" type="url" required disabled={disabled} /></label>
          <label>Importe devuelto en centavos COP<input name="amountInCents" type="number" min={1} step={1} required disabled={disabled} /></label>
          <label>Fecha y hora de devolución (Colombia)<input name="recordedAt" type="datetime-local" required disabled={disabled} /></label>
        </fieldset>}
        <button className="admin-btn" type="submit" disabled={disabled}>Registrar resolución con auditoría</button>
      </form>
    </details>)}
  </section>;
}
