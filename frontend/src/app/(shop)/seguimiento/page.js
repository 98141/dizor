"use client";

import { useState } from "react";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { trackOrder } from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";

const STATUS_LABELS = {
  pendiente: "Pendiente",
  pago_pendiente: "Pago pendiente",
  pagado: "Pagado",
  en_preparacion: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  rechazado: "Rechazado",
  devuelto: "Devuelto",
};

export default function SeguimientoPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await trackOrder(orderNumber.trim(), email.trim());
      setResult(data.order);
    } catch (err) {
      setError(err.response?.data?.message || "Pedido no encontrado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page">
      <h1 className="checkout-page__title">Seguimiento de pedido</h1>
      <p style={{ marginBottom: "1.5rem", color: "var(--color-text-muted)" }}>
        Consulta el estado con tu número de pedido y correo electrónico.
      </p>

      <div className="checkout-card">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <AuthFormField
            label="Número de pedido"
            name="orderNumber"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="DIZ-20250518-0001"
          />
          <AuthFormField
            label="Correo electrónico"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthErrorAlert message={error} />
          <AuthSubmitButton loading={loading}>Consultar</AuthSubmitButton>
        </form>
      </div>

      {result && (
        <div className="checkout-card">
          <h2>Pedido {result.orderNumber}</h2>
          <p>
            <strong>Estado:</strong>{" "}
            {STATUS_LABELS[result.orderStatus] || result.orderStatus}
          </p>
          <p>
            <strong>Pago:</strong> {result.paymentStatus}
          </p>
          <p>
            <strong>Total:</strong> {formatCOP(result.total)}
          </p>
          {result.trackingNumber && (
            <p>
              <strong>Guía:</strong> {result.trackingNumber} (
              {result.carrier})
            </p>
          )}
          <p>
            <strong>Destino:</strong> {result.city}, {result.department}
          </p>
        </div>
      )}
    </div>
  );
}
