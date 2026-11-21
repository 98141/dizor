"use client";
import { useEffect, useId, useRef } from "react";

export default function AdminConfirmModal({ isOpen, title = "Confirmar acción", message = "¿Deseas eliminar este elemento? Esta acción no se puede deshacer.", confirmLabel = "Eliminar", cancelLabel = "Cancelar", onConfirm, onCancel }) {
  const dialog = useRef(null), cancel = useRef(null), locked = useRef(false);
  const callbacks = useRef({ onConfirm, onCancel });
  const id = useId();
  useEffect(() => { callbacks.current = { onConfirm, onCancel }; });
  useEffect(() => {
    if (!isOpen) return;
    locked.current = false;
    const previous = document.activeElement, shell = document.querySelector(".admin-shell");
    // The modal lives inside main. Inert its siblings instead of inerting its ancestor.
    const overlay = dialog.current?.parentElement;
    const siblings = [];
    for (let element = overlay; element && element !== shell; element = element.parentElement) {
      for (const sibling of element.parentElement?.children || []) {
        if (sibling !== element && sibling instanceof HTMLElement) { siblings.push([sibling, sibling.inert]); sibling.inert = true; }
      }
    }
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancel.current?.focus();
    const keydown = event => {
      if (event.key === "Escape") { event.preventDefault(); callbacks.current.onCancel?.(); }
      if (event.key !== "Tab") return;
      const nodes = [...dialog.current.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)")].filter(n => n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = scroll; for (const [element, inert] of siblings) element.inert = inert; if (previous?.isConnected) previous.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <div className="admin-confirm-overlay" onClick={() => callbacks.current.onCancel?.()}>
    <section ref={dialog} className="admin-confirm" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onClick={e => e.stopPropagation()}>
      <h2 id={`${id}-title`}>{title}</h2><p id={`${id}-message`}>{message}</p>
      <div className="admin-confirm__actions"><button ref={cancel} type="button" className="admin-btn" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="admin-btn admin-btn--danger" onClick={() => { if (locked.current) return; locked.current = true; callbacks.current.onConfirm?.(); }}>{confirmLabel}</button></div>
    </section>
  </div>;
}
