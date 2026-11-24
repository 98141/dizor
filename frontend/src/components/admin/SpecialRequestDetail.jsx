"use client";
// Sprint 04: presentation only. Same endpoints, payloads, locks and messages as before;
// the backend (vendor included) keeps deciding which updates are allowed.
import { useRef, useState } from "react";
import AdminFeedback from "./AdminFeedback";
import { formatCOP } from "@/lib/formatCurrency";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/specialRequestLabels";
import { updateSpecialRequestQuote, updateSpecialRequestStatus } from "@/services/specialRequestAdminService";
import { formatWhen } from "@/components/admin/attention/AttentionUI";

const CLOSING = ["rechazado", "cancelado"];
const Row = ({ label, children }) => children === null || children === undefined || children === "" ? null
  : <div className="cs-row"><dt>{label}</dt><dd>{children}</dd></div>;

export default function SpecialRequestDetail({ request: initial, onUpdated }) {
  const [request, setRequest] = useState(initial);
  const [status, setStatus] = useState(request.status);
  const [statusNote, setStatusNote] = useState("");
  const [quotedAmount, setQuotedAmount] = useState(request.quotedAmount ?? "");
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || "");
  const [saving, setSaving] = useState(null); // "status" | "quote" | null
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const lock = useRef(false);

  const handleStatus = async () => {
    if (lock.current) return;
    lock.current = true; setError(false); setSaving("status"); setMessage("");
    try {
      const data = await updateSpecialRequestStatus(request.id, { status, note: statusNote });
      setRequest(data.request); onUpdated?.(data.request); setStatusNote(""); setMessage("Estado actualizado");
    } catch (err) { setError(true); setMessage(err.response?.data?.message || "Error al actualizar"); }
    finally { lock.current = false; setSaving(null); }
  };
  const handleQuote = async () => {
    if (lock.current) return;
    lock.current = true; setError(false); setSaving("quote"); setMessage("");
    try {
      const data = await updateSpecialRequestQuote(request.id, { quotedAmount: quotedAmount === "" ? null : Number(quotedAmount), adminNotes });
      setRequest(data.request); onUpdated?.(data.request); setStatus(data.request.status); setMessage("Cotización guardada");
    } catch (err) { setError(true); setMessage(err.response?.data?.message || "Error al guardar"); }
    finally { lock.current = false; setSaving(null); }
  };
  const history = [...(request.statusHistory || [])].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
  const closing = CLOSING.includes(status) && status !== request.status;
  const customization = request.type === "customization";

  return <div className="request-detail-grid cs-detail">
    <div className="cs-detail__main">
      <section className="dz-card cs-card" aria-labelledby="cs-request-title">
        <header className="dz-card__head"><div><h2 id="cs-request-title">Solicitud</h2><p className="dz-card__sub">{REQUEST_TYPE_LABELS[request.type]} · recibida {formatWhen(request.createdAt)}</p></div></header>
        <dl className="cs-rows">
          {customization && <Row label="Producto">{request.productName || null}</Row>}
          {customization && <Row label="Variante">{request.variantSummary || null}</Row>}
          {customization && <Row label="Cantidad">{request.quantity}</Row>}
          {!customization && <Row label="Cantidad estimada">{request.estimatedQuantity != null ? `${request.estimatedQuantity} unidades` : null}</Row>}
          {!customization && <Row label="Presupuesto estimado">{request.estimatedBudget != null ? formatCOP(request.estimatedBudget) : null}</Row>}
          <Row label="Entrega en">{request.deliveryDepartment || null}</Row>
          <Row label="Plazo deseado">{request.desiredTimeline || null}</Row>
          {request.selectedOptions?.length > 0 && <Row label="Opciones elegidas"><ul className="cs-tags">{request.selectedOptions.map((o) => <li key={o}>{o}</li>)}</ul></Row>}
        </dl>
        <h3 className="cs-subtitle">{customization ? "Personalización solicitada" : "Productos solicitados"}</h3>
        <p className="cs-longtext">{(customization ? request.customizationDetails : request.productsDescription) || "El cliente no agregó una descripción."}</p>
        {request.customerNotes && <><h3 className="cs-subtitle">Notas del cliente</h3><p className="cs-longtext">{request.customerNotes}</p></>}
      </section>

      <section className="dz-card cs-card" aria-labelledby="cs-history-title">
        <header className="dz-card__head"><div><h2 id="cs-history-title">Historial</h2><p className="dz-card__sub">Cambios de estado registrados. Las notas son internas.</p></div></header>
        {history.length ? <ol className="cs-timeline">{history.map((h, i) => <li key={`${h.changedAt}-${i}`}>
          <span className="cs-timeline__dot" aria-hidden="true" />
          <div><p className="cs-timeline__title"><strong>{REQUEST_STATUS_LABELS[h.status] || h.status}</strong> <time dateTime={h.changedAt}>{formatWhen(h.changedAt)}</time></p>
            {h.note && <p className="cs-timeline__note">{h.note}</p>}</div>
        </li>)}</ol> : <p className="cs-muted">Aún no hay cambios de estado registrados.</p>}
      </section>
    </div>

    <aside className="cs-detail__side">
      <section className="dz-card cs-card" aria-labelledby="cs-client-title">
        <header className="dz-card__head"><h2 id="cs-client-title">Cliente</h2></header>
        <dl className="cs-rows cs-rows--stack">
          <Row label="Nombre">{request.contact.name}</Row>
          <Row label="Correo"><span className="cs-break">{request.contact.email}</span></Row>
          <Row label="Teléfono">{request.contact.phone}</Row>
          <Row label="Empresa">{request.contact.company || null}</Row>
        </dl>
      </section>

      <section className="dz-card cs-card cs-manage" aria-labelledby="cs-manage-title">
        <header className="dz-card__head"><div><h2 id="cs-manage-title">Gestionar</h2><p className="dz-card__sub">Estos cambios no envían mensajes automáticos al cliente.</p></div></header>
        <AdminFeedback message={message} variant={error ? "error" : "success"} />
        <div className="cs-manage__block">
          <h3 className="cs-subtitle">Estado <span className="cs-visibility cs-visibility--public">Visible en el seguimiento del cliente</span></h3>
          <div className="admin-form__group">
            <label htmlFor="status">Nuevo estado</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="admin-form__group">
            <label htmlFor="statusNote">Nota del cambio (opcional, interna)</label>
            <input id="statusNote" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </div>
          {closing && <p className="cs-warning" role="note">Vas a cerrar la solicitud como «{REQUEST_STATUS_LABELS[status]}».</p>}
          <button type="button" className={`admin-btn ${closing ? "admin-btn--danger" : "admin-btn--primary"}`} disabled={!!saving} aria-busy={saving === "status"} onClick={handleStatus}>Actualizar estado</button>
        </div>
        <div className="cs-manage__block">
          <h3 className="cs-subtitle">Cotización <span className="cs-visibility cs-visibility--public">Visible en el seguimiento del cliente</span></h3>
          <div className="admin-form__group">
            <label htmlFor="quotedAmount">Valor cotizado (COP)</label>
            <input id="quotedAmount" type="number" min="0" inputMode="numeric" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} />
            {request.quotedAmount != null && <p className="cs-muted">Actual: {formatCOP(request.quotedAmount)}{request.quotedAt ? ` · ${formatWhen(request.quotedAt)}` : ""}</p>}
          </div>
          <div className="admin-form__group">
            <label htmlFor="adminNotes">Notas internas <span className="cs-visibility">Solo equipo</span></label>
            <textarea id="adminNotes" rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
          </div>
          {["pendiente", "en_revision"].includes(request.status) && <p className="cs-muted">Al guardar un valor, la solicitud pasa a «Cotizado».</p>}
          <button type="button" className="admin-btn" disabled={!!saving} aria-busy={saving === "quote"} onClick={handleQuote}>Guardar cotización</button>
        </div>
      </section>
    </aside>
  </div>;
}
