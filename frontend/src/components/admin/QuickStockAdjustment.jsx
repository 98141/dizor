"use client";
import { useEffect, useRef, useState } from "react";
import { adjustProductStock, getStockOperation } from "@/services/adminCatalogService";
import { variantName } from "@/lib/catalogWorkspace";

export default function QuickStockAdjustment({ product, variant, actorId, onRecorded, onClose }) {
  const storageKey = `dizor-stock:${actorId}:${product.id}:${variant.id}`;
  const [mode, setMode] = useState("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const operationRef = useRef(null), inFlightRef = useRef(false), completedRef = useRef(false), confirmRef = useRef(null);
  useEffect(() => {
    // Restore only this actor/product/variant intent after navigation or reload.
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
        if (saved?.variantId === variant.id && typeof saved.operationKey === "string") {
          operationRef.current = saved; setPending(saved); setMessage("Existe un ajuste por comprobar. Conservamos su cantidad, motivo y clave.");
        }
      } catch { /* Storage may be unavailable; the in-memory operation remains protected. */ }
    });
  }, [storageKey, variant.id]);
  useEffect(() => { if (confirmation) confirmRef.current?.focus(); }, [confirmation]);
  const amount = Number(quantity), delta = mode === "add" ? amount : -amount;
  const predicted = variant.stock + delta;
  const valid = Number.isSafeInteger(amount) && amount > 0 && Number.isSafeInteger(predicted) && predicted >= 0 && reason.trim().length > 0 && reason.trim().length <= 500;
  const clear = () => { operationRef.current = null; setPending(null); try { sessionStorage.removeItem(storageKey); } catch {} };
  const finish = async (result) => {
    completedRef.current = true; clear();
    await onRecorded(Object.hasOwn(result, "currentStock") ? result.currentStock : result.stock, result);
  };
  const send = async () => {
    if (inFlightRef.current || completedRef.current) return;
    if (!operationRef.current && !valid) { setError("Registra una cantidad entera positiva, stock previsto no negativo y motivo."); return; }
    inFlightRef.current = true; setBusy(true); setError(""); setMessage("");
    const payload = operationRef.current ||= { variantId: variant.id, delta, reason: reason.trim(), operationKey: crypto.randomUUID() };
    // Persist BEFORE the HTTP call. A lost response cannot become a new intent.
    try { sessionStorage.setItem(storageKey, JSON.stringify(payload)); } catch {}
    try { await finish(await adjustProductStock(product.id, payload)); }
    catch (err) {
      const explicit = [400, 403, 404, 409, 422].includes(err.response?.status);
      if (explicit && (!pending || err.response?.data?.operationRejected)) { clear(); setConfirmation(false); }
      else setPending(payload);
      setError(err.response?.data?.message || "No se pudo confirmar el resultado. Comprueba el ajuste antes de continuar.");
    } finally { inFlightRef.current = false; setBusy(false); }
  };
  const verify = async () => {
    if (inFlightRef.current || !operationRef.current || completedRef.current) return;
    inFlightRef.current = true; setBusy(true); setError("");
    try {
      const result = await getStockOperation(product.id, operationRef.current.operationKey);
      if (result.found) await finish(result);
      else if (result.rejected) { clear(); setConfirmation(false); setError(`El ajuste terminó rechazado y no movió existencias: ${result.message}. Puedes corregir la solicitud.`); }
      else setMessage("Aún no hay constancia confirmada. Puedes reintentar exactamente el mismo ajuste; no se generará otra clave.");
    } catch { setError("No se pudo comprobar el ajuste. Conservamos la misma operación."); }
    finally { inFlightRef.current = false; setBusy(false); }
  };
  return <section className="op-adjust" aria-label={`Ajustar ${variant.sku}`} aria-busy={busy}>
    <h3>Ajustar existencias</h3><p>{product.name} · {variantName(variant)} · {variant.sku}</p><p>Stock actual mostrado: <strong>{variant.stock}</strong></p>
    {error && <p role="alert" className="op-alert">{error}</p>}{message && <p role="status">{message}</p>}
    {pending ? <><p>Ajuste por comprobar: <strong>{pending.delta > 0 ? "+" : ""}{pending.delta}</strong> · {pending.reason}</p><div className="op-adjust-actions"><button type="button" className="op-btn op-btn--primary" disabled={busy} onClick={verify}>Comprobar resultado</button><button type="button" className="op-btn" disabled={busy} onClick={send}>Reintentar mismo ajuste</button></div><p className="op-muted">Una consulta sin resultado no demuestra que la petición anterior haya terminado. Se conserva la misma operación.</p></>
      : <form className="op-adjust-form" onSubmit={(e) => { e.preventDefault(); if (valid) setConfirmation(true); else setError("Revisa la cantidad, el stock previsto y el motivo."); }}>
        <label>Operación<select value={mode} disabled={busy} onChange={(e) => { setMode(e.target.value); setConfirmation(false); }}><option value="add">Agregar unidades</option><option value="remove">Retirar unidades</option></select></label>
        <label>Cantidad<input name="adjustmentQuantity" type="number" min="1" step="1" required value={quantity} disabled={busy} onChange={(e) => { setQuantity(e.target.value); setConfirmation(false); }} /></label>
        <label className="op-wide">Motivo<input name="adjustmentReason" required maxLength={500} value={reason} disabled={busy} onChange={(e) => { setReason(e.target.value); setConfirmation(false); }} /></label>
        <p>Stock resultante previsto: <strong>{quantity && Number.isFinite(predicted) ? predicted : "—"}</strong></p><p className="op-muted">El resultado final se comprueba al registrar; otras ventas o ajustes pueden cambiarlo.</p>
        {!confirmation && <button type="submit" className="op-btn" disabled={busy || !valid}>Revisar ajuste</button>}
      </form>}
    {confirmation && !pending && <fieldset className="op-confirm"><legend>Confirmar ajuste</legend><p>{mode === "add" ? "Agregar" : "Retirar"} {amount} unidades · previsto {predicted}. Motivo: {reason}</p><button ref={confirmRef} type="button" className="op-btn op-btn--primary" disabled={busy} onClick={send}>{busy ? "Registrando…" : "Confirmar ajuste"}</button></fieldset>}
    {busy && <p role="status">Procesando ajuste…</p>}
    <button type="button" className="op-btn" disabled={busy} onClick={onClose}>{pending ? "Cerrar panel (se conserva la operación)" : "Cerrar ajuste"}</button>
  </section>;
}
