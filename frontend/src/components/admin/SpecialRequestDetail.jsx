"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/formatCurrency";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  getRequestBadgeClass,
} from "@/lib/specialRequestLabels";
import {
  updateSpecialRequestQuote,
  updateSpecialRequestStatus,
} from "@/services/specialRequestAdminService";

export default function SpecialRequestDetail({ request: initial, onUpdated }) {
  const [request, setRequest] = useState(initial);
  const [status, setStatus] = useState(request.status);
  const [statusNote, setStatusNote] = useState("");
  const [quotedAmount, setQuotedAmount] = useState(
    request.quotedAmount ?? ""
  );
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleStatus = async () => {
    setSaving(true);
    setMessage("");
    try {
      const data = await updateSpecialRequestStatus(request.id, {
        status,
        note: statusNote,
      });
      setRequest(data.request);
      onUpdated?.(data.request);
      setMessage("Estado actualizado");
    } catch (err) {
      setMessage(err.response?.data?.message || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleQuote = async () => {
    setSaving(true);
    setMessage("");
    try {
      const data = await updateSpecialRequestQuote(request.id, {
        quotedAmount: quotedAmount === "" ? null : Number(quotedAmount),
        adminNotes,
      });
      setRequest(data.request);
      onUpdated?.(data.request);
      setMessage("Cotización guardada");
    } catch (err) {
      setMessage(err.response?.data?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="request-detail-grid">
      <section className="order-detail-card">
        <h2>Cliente</h2>
        <div className="order-detail-row">
          <span>Nombre</span>
          <span>{request.contact.name}</span>
        </div>
        <div className="order-detail-row">
          <span>Correo</span>
          <span>{request.contact.email}</span>
        </div>
        <div className="order-detail-row">
          <span>Teléfono</span>
          <span>{request.contact.phone}</span>
        </div>
        {request.contact.company && (
          <div className="order-detail-row">
            <span>Empresa</span>
            <span>{request.contact.company}</span>
          </div>
        )}
      </section>

      <section className="order-detail-card">
        <h2>Solicitud</h2>
        <p>
          <span
            className={`request-badge ${getRequestBadgeClass(request.status)}`}
          >
            {REQUEST_STATUS_LABELS[request.status]}
          </span>
        </p>
        <div className="order-detail-row">
          <span>Tipo</span>
          <span>{REQUEST_TYPE_LABELS[request.type]}</span>
        </div>
        <div className="order-detail-row">
          <span>Número</span>
          <span>{request.requestNumber}</span>
        </div>
        {request.type === "customization" && (
          <>
            {request.productName && (
              <div className="order-detail-row">
                <span>Producto</span>
                <span>{request.productName}</span>
              </div>
            )}
            <div className="order-detail-row">
              <span>Cantidad</span>
              <span>{request.quantity}</span>
            </div>
            <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
              {request.customizationDetails}
            </p>
          </>
        )}
        {request.type === "wholesale" && (
          <>
            <div className="order-detail-row">
              <span>Cantidad est.</span>
              <span>{request.estimatedQuantity}</span>
            </div>
            <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
              {request.productsDescription}
            </p>
          </>
        )}
        {request.customerNotes && (
          <p className="admin-muted">Notas cliente: {request.customerNotes}</p>
        )}
      </section>

      <section className="order-detail-card">
        <h2>Gestionar</h2>
        {message && <p className="admin-muted">{message}</p>}
        <div className="admin-form__group">
          <label htmlFor="status">Estado</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form__group">
          <label htmlFor="statusNote">Nota (opcional)</label>
          <input
            id="statusNote"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={saving}
          onClick={handleStatus}
        >
          Actualizar estado
        </button>

        <hr style={{ margin: "1.25rem 0", border: "none", borderTop: "1px solid var(--color-border)" }} />

        <div className="admin-form__group">
          <label htmlFor="quotedAmount">Cotización (COP)</label>
          <input
            id="quotedAmount"
            type="number"
            min="0"
            value={quotedAmount}
            onChange={(e) => setQuotedAmount(e.target.value)}
          />
          {request.quotedAmount != null && (
            <p className="admin-muted">
              Actual: {formatCOP(request.quotedAmount)}
            </p>
          )}
        </div>
        <div className="admin-form__group">
          <label htmlFor="adminNotes">Notas internas</label>
          <textarea
            id="adminNotes"
            rows={3}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-btn"
          disabled={saving}
          onClick={handleQuote}
        >
          Guardar cotización
        </button>
      </section>
    </div>
  );
}
