"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import { trackOrder } from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";
import { useAuth } from "@/context/AuthContext";

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

const PAYMENT_STATUS_LABELS = {
  pendiente: "Pendiente",
  pagado: "Aprobado",
  rechazado: "Rechazado",
  reembolsado: "Reembolsado",
};

const CARRIER_LABELS = {
  interrapidisimo: "Inter Rapidísimo",
  servientrega: "Servientrega",
  envia: "Envía",
  coordinadora: "Coordinadora",
};

const CARRIER_TRACKING_URL = {
  interrapidisimo: (guia) =>
    `https://www.interrapidisimo.com/servicios/rastreo/?guia=${encodeURIComponent(guia)}`,
  envia: (guia) => `https://www.envia.co/rastreo?numero=${encodeURIComponent(guia)}`,
  coordinadora: (guia) =>
    `https://www.coordinadora.com/portafolio-de-servicios/servicios-en-linea/rastrear-guias/?guia=${encodeURIComponent(guia)}`,
};

function statusTone(status) {
  if (status === "entregado" || status === "pagado") return "positive";
  if (status === "cancelado" || status === "rechazado" || status === "devuelto") return "critical";
  if (status === "pendiente" || status === "pago_pendiente") return "pending";
  return "neutral";
}

function formatOrderDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function OrderResult({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const registered = formatOrderDate(order.createdAt);
  const city = (order.city || "").trim();
  const department = (order.department || "").trim();
  const trackingNumber = (order.trackingNumber || "").trim();
  const carrier = (order.carrier || "").trim();
  const carrierLabel = CARRIER_LABELS[carrier] || carrier;
  const trackingUrl =
    trackingNumber && carrier ? CARRIER_TRACKING_URL[carrier]?.(trackingNumber) : null;
  const hasDelivery = Boolean(city || department || trackingNumber || carrier);

  return (
    <article className="order-view__panel order-result" id="pedido-resultado" aria-live="polite">
      <header className="order-detail__head">
        <div>
          <h2 className="order-detail__number">Pedido {order.orderNumber}</h2>
          {registered && <p className="order-detail__date">Registrado el {registered}</p>}
        </div>
        <p className={`order-status order-status--${statusTone(order.orderStatus)}`}>
          {STATUS_LABELS[order.orderStatus] || order.orderStatus}
        </p>
      </header>

      {items.length > 0 && (
        <section className="order-section" aria-labelledby="track-items-title">
          <h2 id="track-items-title" className="order-section__title">Productos</h2>
          <ul className="order-items">
            {items.map((it, idx) => (
              <li key={`${it.productName}-${idx}`}>
                <div>
                  <p className="order-line__name">{it.productName}</p>
                  <p className="order-line__meta">Cantidad: {it.quantity}</p>
                </div>
                <span className="order-line__amount">{formatCOP(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="order-section" aria-labelledby="track-total-title">
        <h2 id="track-total-title" className="order-section__title">Resumen</h2>
        <div className="order-totals">
          <div className="order-totals__grand">
            <span>Total</span>
            <strong>{formatCOP(order.total)}</strong>
          </div>
        </div>
      </section>

      <section className="order-section" aria-labelledby="track-payment-title">
        <h2 id="track-payment-title" className="order-section__title">Pago</h2>
        <dl className="order-meta">
          <div>
            <dt>Estado del pago</dt>
            <dd>{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</dd>
          </div>
        </dl>
      </section>

      {hasDelivery && (
        <section className="order-section" aria-labelledby="track-delivery-title">
          <h2 id="track-delivery-title" className="order-section__title">Entrega</h2>
          <dl className="order-meta">
            {(city || department) && (
              <div>
                <dt>Destino</dt>
                <dd>{[city, department].filter(Boolean).join(", ")}</dd>
              </div>
            )}
            {carrierLabel && (
              <div>
                <dt>Transportadora</dt>
                <dd>{carrierLabel}</dd>
              </div>
            )}
            {trackingNumber && (
              <div>
                <dt>Guía</dt>
                <dd>{trackingNumber}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <div className="order-actions order-actions--split">
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noreferrer"
            className="order-btn order-btn--primary"
          >
            Ver guía de envío
          </a>
        )}
        <Link
          href="/catalogo"
          className={trackingUrl ? "order-btn order-btn--ghost" : "order-btn order-btn--primary"}
        >
          Seguir explorando
        </Link>
      </div>
    </article>
  );
}

export default function SeguimientoPage() {
  const { isAuthenticated } = useAuth();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultRef = useRef(null);

  // Enlaces desde la confirmación traen solo ?order=. Enlaces antiguos podían
  // traer también el correo: se ignora y se elimina de la barra de
  // direcciones (H-06). Esto no borra el historial ya existente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = (params.get("order") || "").trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prellenado desde la URL tras hidratar
    if (fromUrl) setOrderNumber(fromUrl);
    if ([...params.keys()].some((k) => k !== "order")) {
      const clean = fromUrl ? `/seguimiento?order=${encodeURIComponent(fromUrl)}` : "/seguimiento";
      window.history.replaceState(window.history.state, "", clean);
    }
  }, []);

  useEffect(() => {
    if (!result || !resultRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [result]);

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
    <div className="order-view">
      <div className="order-view__shell">
        <header className="order-view__intro">
          <h1 className="order-view__title">Consulta de pedido</h1>
          <p className="order-view__lead">
            Indica el número de pedido y el correo con el que lo realizaste.
            El número por sí solo no muestra el detalle.
          </p>
        </header>

        <section className="order-lookup" aria-label="Datos para consultar">
          <form className="auth-form" onSubmit={handleSubmit}>
            <AuthFormField
              label="Número de pedido"
              name="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="DIZ-20250518-0001"
              autoComplete="off"
            />
            <AuthFormField
              label="Correo electrónico"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {error && (
              <p className="order-form-error" role="alert">
                {error}
              </p>
            )}
            <AuthSubmitButton loading={loading} loadingLabel="Consultando…">
              Consultar
            </AuthSubmitButton>
          </form>
          {isAuthenticated && (
            <p className="order-lookup__account">
              <Link href="/cuenta?tab=pedidos" className="order-view__quiet">
                Ver mis pedidos en la cuenta
              </Link>
            </p>
          )}
        </section>

        {result && (
          <div ref={resultRef} className="order-result-anchor">
            <OrderResult order={result} />
          </div>
        )}
      </div>
    </div>
  );
}
