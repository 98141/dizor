"use client";
import { useEffect, useRef, useState } from "react";
import { CARRIER_LABELS } from "@/lib/orderLabels";
import styles from "./OrderWorkspace.module.css";

const CONFIRM = {
  dispatch: ["Confirmar despacho", "Se registrarán la guía y el despacho en una sola operación. El recaudo no cambia."],
  correct: ["Confirmar corrección de guía", "El cliente recibirá la información corregida mediante la bandeja de comunicaciones."],
  deliver: ["Confirmar entrega", "Confirma que el pedido fue entregado. Esta operación no registra el recaudo."],
  collect: ["Confirmar recaudo", "Confirma que tienes evidencia de la confirmación o giro de la transportadora. No basta con la entrega."],
  cancel: ["Confirmar cancelación", "El pedido se cerrará y se aplicará la devolución de inventario cuando corresponda. No se realiza un reembolso automático."],
  return: ["Confirmar devolución", "Se registrará la devolución y se repondrá el inventario cuando corresponda. El tratamiento del dinero es independiente."],
  reconcile: ["Consultar evidencia de Wompi", "El servidor consultará al proveedor. Solo aplicará cambios respaldados por esa evidencia; no aprobará el pago manualmente."],
};
export default function OrderNextAction({ order, execute, busy, locked }) {
  const operation = order.operation;
  const [confirmation, setConfirmation] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [operationNote, setOperationNote] = useState("");
  const confirmRef = useRef(null);
  useEffect(() => { if (confirmation) confirmRef.current?.focus(); }, [confirmation]);
  if (!operation) return <p role="alert">No se pudieron consultar las acciones permitidas. Actualiza el pedido.</p>;
  const { primary } = operation;
  const disabled = busy || locked;
  const submit = (code) => (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (code === "collect" && values.receivedAt) values.receivedAt = new Date(`${values.receivedAt}:00-05:00`).toISOString();
    setConfirmation({ code, values });
  };
  return <section className={styles.next} aria-labelledby="next-action-title" aria-busy={busy}>
    <p className={styles.eyebrow}>Siguiente acción</p><h2 id="next-action-title">{primary.label}</h2><p>{primary.description}</p>
    {["prepare", "deliver"].includes(primary.code) && <details><summary>Añadir nota interna (opcional)</summary><label>Nota de la operación<textarea name="operationNote" rows={2} maxLength={500} value={operationNote} disabled={disabled} onChange={(e) => setOperationNote(e.target.value)} /></label></details>}
    {primary.code === "prepare" && <button type="button" className="admin-btn admin-btn--primary" disabled={disabled} onClick={() => execute("prepare", { note: operationNote })}>Comenzar preparación</button>}
    {(primary.code === "dispatch" || correcting) && <form className={styles.form} onSubmit={submit(correcting ? "correct" : "dispatch")}>
      <label>Transportadora<select name="carrier" required defaultValue={order.carrier || ""} disabled={disabled}><option value="">Seleccionar transportadora</option>{Object.entries(CARRIER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Número de guía<input name="trackingNumber" required maxLength={120} defaultValue={order.trackingNumber || ""} disabled={disabled} /></label>
      <label>Nota interna de envío (opcional)<textarea name="shippingNotes" rows={2} maxLength={500} defaultValue={order.shippingNotes || ""} disabled={disabled} /></label>
      <div className={styles.actions}><button className="admin-btn admin-btn--primary" disabled={disabled} type="submit">{correcting ? "Guardar corrección de guía" : "Registrar envío y despachar"}</button>{correcting && <button type="button" className="admin-btn" disabled={disabled} onClick={() => setCorrecting(false)}>Cancelar corrección</button>}</div>
    </form>}
    {primary.code === "deliver" && <button type="button" className="admin-btn admin-btn--primary" disabled={disabled} onClick={() => setConfirmation({ code: "deliver", values: { note: operationNote } })}>Registrar entrega</button>}
    {primary.code === "collect" && <form className={styles.form} onSubmit={submit("collect")}>
      <label>Referencia o comprobante del recaudo<input name="reference" required maxLength={200} disabled={disabled} /></label>
      <label>Fecha y hora del recaudo (Colombia)<input name="receivedAt" type="datetime-local" required disabled={disabled} /></label>
      <label>URL de evidencia (opcional)<input name="paymentProofUrl" type="url" placeholder="https://…" disabled={disabled} /></label>
      <button type="submit" className="admin-btn admin-btn--primary" disabled={disabled}>Registrar recaudo</button>
    </form>}
    {operation.canReconcile && <form className={styles.form} onSubmit={submit("reconcile")}>
      <label>ID de transacción del panel o comprobante de Wompi<input name="transactionId" defaultValue={order.wompi?.transactionId || ""} required maxLength={150} pattern="[A-Za-z0-9_-]+" disabled={disabled} /></label>
      <p>El ID sólo permite consultar. El servidor verifica el enlace, importe y moneda antes de confirmar un pago.</p>
      <button type="submit" className="admin-btn" disabled={disabled}>Consultar y conciliar con Wompi</button>
    </form>}
    {confirmation && <fieldset className={styles.confirm}>
      <legend>{CONFIRM[confirmation.code][0]}</legend><p>{CONFIRM[confirmation.code][1]}</p>
      {confirmation.values.trackingNumber && <p><strong>{CARRIER_LABELS[confirmation.values.carrier]} · {confirmation.values.trackingNumber}</strong></p>}
      {confirmation.values.reference && <p>Referencia: <strong>{confirmation.values.reference}</strong></p>}
      {["cancel", "return"].includes(confirmation.code) && <label>Motivo interno<textarea maxLength={500} value={confirmation.values.note || ""} disabled={disabled} onChange={(e) => setConfirmation((c) => ({ ...c, values: { note: e.target.value } }))} /></label>}
      <div className={styles.actions}><button ref={confirmRef} type="button" className="admin-btn admin-btn--primary" disabled={disabled || (["cancel", "return"].includes(confirmation.code) && (confirmation.values.note || "").trim().length < 5)} onClick={async () => {
        if (await execute(confirmation.code, confirmation.values)) { setConfirmation(null); setCorrecting(false); }
      }}>{busy ? "Procesando…" : CONFIRM[confirmation.code][0]}</button><button type="button" className="admin-btn" disabled={busy} onClick={() => setConfirmation(null)}>Volver sin confirmar</button></div>
    </fieldset>}
    <div className={styles.actions}>
      {operation.canCorrectShipping && !correcting && <button type="button" className="admin-btn" disabled={disabled} onClick={() => setCorrecting(true)}>Corregir guía</button>}
      {operation.canCancel && <button type="button" className="admin-btn" disabled={disabled} onClick={() => setConfirmation({ code: "cancel", values: {} })}>Cancelar pedido</button>}
      {operation.canReturn && <button type="button" className="admin-btn" disabled={disabled} onClick={() => setConfirmation({ code: "return", values: {} })}>Registrar devolución</button>}
    </div>
    {busy && <p role="status">Procesando operación…</p>}
    {locked && <p role="status">Actualiza el pedido para verificar el resultado antes de otra acción.</p>}
  </section>;
}
