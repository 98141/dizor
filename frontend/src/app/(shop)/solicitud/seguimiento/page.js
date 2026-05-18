"use client";

import { useState } from "react";
import Link from "next/link";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { trackSpecialRequest } from "@/services/specialRequestService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  getRequestBadgeClass,
} from "@/lib/specialRequestLabels";

export default function SolicitudSeguimientoPage() {
  const [form, setForm] = useState({ requestNumber: "", email: "" });
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRequest(null);
    try {
      const data = await trackSpecialRequest(
        form.requestNumber.trim().toUpperCase(),
        form.email.trim()
      );
      setRequest(data.request);
    } catch (err) {
      setError(err.response?.data?.message || "Solicitud no encontrada");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="special-page">
      <h1 className="special-page__title">Seguimiento de solicitud</h1>
      <p className="special-page__intro">
        Ingresa el número de solicitud (SOL-…) y el correo con el que la enviaste.
      </p>

      <div className="special-form-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthFormField
            label="Número de solicitud"
            name="requestNumber"
            value={form.requestNumber}
            onChange={(e) =>
              setForm((p) => ({ ...p, requestNumber: e.target.value }))
            }
            placeholder="SOL-20260518-0001"
            required
          />
          <AuthFormField
            label="Correo"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <AuthErrorAlert message={error} />
          <AuthSubmitButton loading={loading}>Buscar</AuthSubmitButton>
        </form>
      </div>

      {request && (
        <div className="special-form-card" style={{ marginTop: "1.5rem" }}>
          <p>
            <span
              className={`request-badge ${getRequestBadgeClass(request.status)}`}
            >
              {REQUEST_STATUS_LABELS[request.status]}
            </span>
          </p>
          <p>
            <strong>{request.requestNumber}</strong> ·{" "}
            {REQUEST_TYPE_LABELS[request.type]}
          </p>
          {request.productName && <p>Producto: {request.productName}</p>}
          {request.estimatedQuantity && (
            <p>Cantidad: {request.estimatedQuantity} unidades</p>
          )}
          {request.quotedAmount != null && (
            <p>Cotización: {formatCOP(request.quotedAmount)}</p>
          )}
          <p className="cuenta-muted">
            Actualizado:{" "}
            {new Date(request.updatedAt).toLocaleString("es-CO")}
          </p>
        </div>
      )}

      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        <Link href="/personalizar">Nueva personalización</Link> ·{" "}
        <Link href="/pedido-mayor">Pedido al por mayor</Link>
      </p>
    </div>
  );
}
