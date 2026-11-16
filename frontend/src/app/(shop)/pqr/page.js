"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";
import {
  getCustomerRequestConfig,
  createCustomerRequest,
} from "@/services/customerRequestService";
import { CATEGORY_LABELS, TYPE_LABELS, formatDateTime } from "@/lib/customerRequestLabels";
import { getWhatsAppUrl } from "@/lib/whatsapp";

// Formulario de PQR y solicitudes de titulares (H-22, H-11). Solo muestra el
// radicado cuando el servidor confirma que la solicitud quedó guardada.
// Si el canal no está habilitado en el servidor (PQR_PUBLIC_ENABLED), se
// informa y se remite a WhatsApp, sin simular un procedimiento.
export default function PqrPage() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();
  const [form, setForm] = useState({
    category: "consumo",
    type: "peticion",
    name: "",
    email: "",
    phone: "",
    orderNumber: "",
    description: "",
  });
  const [privacyAuthorization, setPrivacyAuthorization] = useState(false);
  // Clave aleatoria por intento de radicación: si la respuesta se pierde y se
  // reenvía, el servidor devuelve el mismo radicado en vez de duplicarlo.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    getCustomerRequestConfig()
      .then((d) => setConfig(d))
      .catch(() => setConfigError(true));
  }, []);

  const types = config?.categories?.[form.category] || [];
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await createCustomerRequest({
        ...form,
        privacyAuthorization: privacyAuthorization === true,
        idempotencyKey,
      });
      setResult(data.request);
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo registrar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="special-page">
        <h1 className="special-page__title">Solicitud radicada</h1>
        <div className="special-form-card">
          <p><strong>Radicado:</strong> {result.radicado}</p>
          <p>
            <strong>Fecha y hora de recepción:</strong> {formatDateTime(result.receivedAt)}{" "}
            (hora de Colombia)
          </p>
          <p><strong>Código de consulta:</strong> <code>{result.accessCode}</code></p>
          <p style={{ fontSize: "0.9rem" }}>
            Guarda el radicado y el código: los necesitas para consultar el
            estado. El código no se vuelve a mostrar.
            {result.receiptSent ? " También te enviamos una constancia por correo." : ""}
          </p>
          <p>
            <Link href="/pqr/seguimiento">Consultar estado</Link>
          </p>
        </div>
      </div>
    );
  }

  if (configError || (config && !config.enabled)) {
    return (
      <div className="special-page">
        <h1 className="special-page__title">Peticiones, quejas y reclamos</h1>
        <p className="special-page__intro">
          Este canal aún no está habilitado. Mientras tanto, escríbenos por{" "}
          <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          .
        </p>
      </div>
    );
  }

  if (!config) return <p className="auth-loading">Cargando…</p>;

  return (
    <div className="special-page">
      <h1 className="special-page__title">Peticiones, quejas y reclamos</h1>
      <p className="special-page__intro">
        Radica una petición, queja o reclamo sobre una compra, o una solicitud
        sobre tus datos personales. Recibirás un número de radicado con fecha
        y hora. ¿Ya radicaste? <Link href="/pqr/seguimiento">Consulta el estado</Link>.
      </p>

      <div className="special-form-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="pqr-category">Tipo de solicitud</label>
            <select
              id="pqr-category"
              className="auth-field__input"
              value={form.category}
              onChange={(e) => {
                const category = e.target.value;
                const first = config.categories?.[category]?.[0] || "";
                setForm((p) => ({ ...p, category, type: first }));
              }}
            >
              {Object.keys(config.categories || {}).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="pqr-type">Motivo</label>
            <select id="pqr-type" className="auth-field__input" value={form.type} onChange={set("type")}>
              {types.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
              ))}
            </select>
          </div>
          <AuthFormField label="Nombre" name="name" value={form.name} onChange={set("name")} required />
          <AuthFormField label="Correo" name="email" type="email" value={form.email} onChange={set("email")} required />
          <AuthFormField label="Teléfono (opcional)" name="phone" value={form.phone} onChange={set("phone")} />
          {form.category === "consumo" && (
            <AuthFormField
              label="Número de pedido (si aplica)"
              name="orderNumber"
              value={form.orderNumber}
              onChange={set("orderNumber")}
            />
          )}
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="pqr-description">Descripción *</label>
            <textarea
              id="pqr-description"
              className="auth-field__input"
              rows={5}
              maxLength={3000}
              value={form.description}
              onChange={set("description")}
              required
              placeholder="Cuéntanos qué necesitas. No incluyas datos de tarjetas ni información de salud."
            />
          </div>
          <ConsentCheckbox
            notices={notices}
            noticesError={noticesError}
            purpose="customer_request"
            checked={privacyAuthorization}
            onChange={setPrivacyAuthorization}
          />
          <AuthErrorAlert message={error} />
          <AuthSubmitButton
            loading={loading}
            disabled={!isNoticeReady(notices, "customer_request") || !privacyAuthorization}
          >
            Radicar solicitud
          </AuthSubmitButton>
        </form>
      </div>
    </div>
  );
}
