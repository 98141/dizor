"use client";

import { useState } from "react";
import Link from "next/link";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { trackCustomerRequest } from "@/services/customerRequestService";
import {
  CATEGORY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  formatDateTime,
} from "@/lib/customerRequestLabels";

// Seguimiento protegido: radicado + código de consulta (H-22). Cambiar el
// radicado sin el código correcto no muestra solicitudes ajenas.
export default function PqrSeguimientoPage() {
  const [form, setForm] = useState({ radicado: "", accessCode: "" });
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRequest(null);
    try {
      const data = await trackCustomerRequest(form.radicado.trim(), form.accessCode.trim());
      setRequest(data.request);
    } catch (err) {
      setError(err.response?.data?.message || "Solicitud no encontrada");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="special-page">
      <h1 className="special-page__title">Estado de mi solicitud</h1>
      <p className="special-page__intro">
        Ingresa el radicado (PQR-…) y el código de consulta que recibiste.{" "}
        <Link href="/pqr">Radicar una nueva solicitud</Link>.
      </p>
      <div className="special-form-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <AuthFormField
            label="Radicado"
            name="radicado"
            value={form.radicado}
            onChange={(e) => setForm((p) => ({ ...p, radicado: e.target.value }))}
            required
          />
          <AuthFormField
            label="Código de consulta"
            name="accessCode"
            value={form.accessCode}
            onChange={(e) => setForm((p) => ({ ...p, accessCode: e.target.value }))}
            required
            autoComplete="off"
          />
          <AuthErrorAlert message={error} />
          <AuthSubmitButton loading={loading}>Consultar</AuthSubmitButton>
        </form>
      </div>

      {request && (
        <div className="special-form-card" style={{ marginTop: "1rem" }}>
          <p><strong>Radicado:</strong> {request.radicado}</p>
          <p>
            <strong>Tipo:</strong> {CATEGORY_LABELS[request.category]} ·{" "}
            {TYPE_LABELS[request.type] || request.type}
          </p>
          <p><strong>Recibida:</strong> {formatDateTime(request.receivedAt)}</p>
          <p><strong>Estado:</strong> {STATUS_LABELS[request.status] || request.status}</p>
          <h2 style={{ fontSize: "1rem", marginTop: "1rem" }}>Historial</h2>
          <ul>
            {request.history.map((h, i) => (
              <li key={i}>
                {formatDateTime(h.changedAt)} — {STATUS_LABELS[h.status] || h.status}
                {h.note ? `: ${h.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
