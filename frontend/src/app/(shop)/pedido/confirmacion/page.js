"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { lookupOrderConfirmation } from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { trackWhatsAppClick } from "@/lib/analytics/events";
import {
  readOrderAccess,
  clearLegacyGuestData,
  confirmationPath,
} from "@/lib/orderAccess";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";

const PAYMENT_LABELS = {
  wompi: "Tarjeta / PSE (Wompi)",
  nequi_manual: "Nequi (transferencia manual)",
  nequi_api: "Nequi",
  contra_entrega: "Pago contra entrega",
};

const PAYMENT_STATUS_LABELS = {
  pendiente: "Pendiente",
  pagado: "Aprobado",
  rechazado: "Rechazado",
  reembolsado: "Reembolsado",
};

// Título según el estado REAL del pedido devuelto por el servidor (H-20).
// Una redirección desde la pasarela no implica pago aprobado.
function headingFor(order) {
  if (order.paymentStatus === "pagado") return "¡Pago aprobado! Pedido confirmado";
  if (order.paymentStatus === "rechazado") return "El pago no se completó";
  if (order.paymentMethod === "contra_entrega") return "Pedido recibido";
  return "Pedido recibido · pago pendiente";
}

function RegistroPromptModal({ email, name, isOpen, onClose }) {
  const { register } = useAuth();
  const { notices, error: noticesError } = useLegalNotices();
  const [regName, setRegName] = useState(name || "");
  const [regPassword, setRegPassword] = useState("");
  const [regAuthorization, setRegAuthorization] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  if (!isOpen) return null;

  if (regSuccess) {
    return (
      <div className="confirm-modal-overlay">
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          style={{ maxWidth: "480px", textAlign: "center" }}
        >
          <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>✓</p>
          <h2 className="guest-modal__title">¡Cuenta creada!</h2>
          <p className="confirm-modal__message">
            Tus pedidos quedan guardados en tu perfil.
          </p>
          <div className="confirm-modal__actions" style={{ justifyContent: "center" }}>
            <Link
              href="/cuenta"
              className="modal-action-btn modal-action-btn--primary"
              onClick={onClose}
            >
              Ver mi cuenta
            </Link>
            <button type="button" className="modal-action-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim()) {
      setRegError("Ingresa tu nombre");
      return;
    }
    if (regPassword.length < 8) {
      setRegError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!regAuthorization) {
      setRegError("Debes aceptar el tratamiento de datos para crear la cuenta");
      return;
    }
    setRegLoading(true);
    setRegError("");
    try {
      await register({
        name: regName.trim(),
        email,
        password: regPassword,
        passwordConfirm: regPassword,
        privacyAuthorization: true,
        registrationSource: "post_purchase",
      });
      setRegSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (
        msg.toLowerCase().includes("ya está registrado") ||
        msg.toLowerCase().includes("already")
      ) {
        // Sin el correo en la URL (H-06).
        setRegError(
          <>
            Ese correo ya tiene cuenta. <Link href="/login">Inicia sesión</Link>
          </>
        );
      } else {
        setRegError(msg || "No se pudo crear la cuenta");
      }
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registro-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        <h2 id="registro-modal-title" className="guest-modal__title">
          ¿Guardar tus datos para próximas compras?
        </h2>
        <p className="confirm-modal__message">
          Crea una cuenta en segundos y consulta tus pedidos en cualquier
          momento. Es opcional.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <AuthFormField
            label="Nombre completo"
            name="regName"
            value={regName}
            onChange={(e) => {
              setRegName(e.target.value);
              setRegError("");
            }}
            autoComplete="name"
          />
          <div className="auth-field">
            <label className="auth-field__label">Correo electrónico</label>
            <input
              className="auth-field__input"
              type="email"
              value={email}
              disabled
            />
          </div>
          <AuthFormField
            label="Contraseña (mín. 8 caracteres)"
            name="regPassword"
            type="password"
            value={regPassword}
            onChange={(e) => {
              setRegPassword(e.target.value);
              setRegError("");
            }}
            autoComplete="new-password"
          />
          <ConsentCheckbox
            notices={notices}
            noticesError={noticesError}
            purpose="account"
            checked={regAuthorization}
            onChange={(v) => {
              setRegAuthorization(v);
              setRegError("");
            }}
            compact
          />
          {regError && <AuthErrorAlert message={regError} />}
          <div
            className="confirm-modal__actions"
            style={{ marginTop: "1rem" }}
          >
            <button
              type="button"
              className="modal-action-btn"
              onClick={onClose}
            >
              Ahora no
            </button>
            <button
              type="submit"
              className="modal-action-btn modal-action-btn--primary"
              disabled={regLoading || !isNoticeReady(notices, "account") || !regAuthorization}
            >
              {regLoading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildWhatsAppMessage(order) {
  const fmt = (n) =>
    Number(n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  const lines = [
    `Hola! Quiero enviar mi comprobante de pago para el pedido *${order.orderNumber}*`,
    "",
    "📋 Resumen:",
    `Subtotal: ${fmt(order.subtotal)}`,
  ];
  if (Number(order.discountTotal) > 0) {
    lines.push(`Descuento${order.couponCode ? ` (${order.couponCode})` : ""}: -${fmt(order.discountTotal)}`);
  }
  if (Number(order.taxTotal) > 0) {
    lines.push(`IVA${order.ivaPercent > 0 ? ` (${order.ivaPercent}%)` : ""}: ${fmt(order.taxTotal)}`);
  }
  lines.push(Number(order.shippingCost) > 0 ? `Envío: ${fmt(order.shippingCost)}` : "Envío: Gratis");
  lines.push(`*Total a pagar: ${fmt(order.total)}*`, "", "Adjunto el comprobante Nequi.");
  return lines.join("\n");
}

function ConfirmacionContent() {
  const sp = useSearchParams();
  const { isAuthenticated, loadingAuth } = useAuth();
  const orderNumber = (sp.get("order") || "").trim();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | limited
  const [showRegistroModal, setShowRegistroModal] = useState(false);

  // Enlaces antiguos traían correo, nombre e importes en la URL. Se reescribe
  // la dirección para dejar solo el número de pedido (H-06). Esto evita nuevas
  // exposiciones desde esta página, pero NO borra el historial previo del
  // navegador ni registros ya escritos por servidores o terceros.
  useEffect(() => {
    clearLegacyGuestData();
    if (!orderNumber || typeof window === "undefined") return;
    const current = new URLSearchParams(window.location.search);
    const onlyOrder = [...current.keys()].every((k) => k === "order");
    if (!onlyOrder) {
      window.history.replaceState(window.history.state, "", confirmationPath(orderNumber));
    }
  }, [orderNumber]);

  useEffect(() => {
    if (!orderNumber || loadingAuth) return undefined;
    const token = readOrderAccess(orderNumber);
    if (!token && !isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el token solo existe en sessionStorage (cliente), tras hidratar
      setStatus("limited");
      return undefined;
    }
    let cancelled = false;
    lookupOrderConfirmation(orderNumber, token)
      .then((data) => {
        if (cancelled) return;
        setOrder(data.order);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("limited");
      });
    return () => {
      cancelled = true;
    };
  }, [orderNumber, isAuthenticated, loadingAuth]);

  // Ofrecer registro opcional al invitado, una vez cargado su pedido.
  useEffect(() => {
    if (isAuthenticated || status !== "ready" || !order?.buyer?.email) return undefined;
    const timer = setTimeout(() => setShowRegistroModal(true), 1500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, status, order]);

  if (!orderNumber) {
    return (
      <div className="checkout-page checkout-success">
        <p>Información de pedido no encontrada.</p>
        <Link href="/">Volver al inicio</Link>
      </div>
    );
  }

  if (status === "loading") {
    return <p className="auth-loading">Cargando confirmación...</p>;
  }

  if (status === "limited") {
    return (
      <div className="checkout-page">
        <h1 className="checkout-page__title checkout-success__heading">
          Pedido {orderNumber}
        </h1>
        <p className="checkout-success__sub">
          Por seguridad, el detalle del pedido solo se muestra en el navegador
          donde hiciste la compra o si inicias sesión con tu cuenta.
        </p>
        <div className="checkout-confirm-actions">
          <Link
            href={`/seguimiento?order=${encodeURIComponent(orderNumber)}`}
            className="checkout-btn checkout-btn--primary"
          >
            Consultar con número de pedido y correo
          </Link>
          <Link href="/login" className="checkout-btn">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const paid = order.paymentStatus === "pagado";

  return (
    <div className="checkout-page">
      <RegistroPromptModal
        email={order.buyer?.email || ""}
        name={order.buyer?.name || ""}
        isOpen={showRegistroModal && !isAuthenticated}
        onClose={() => setShowRegistroModal(false)}
      />

      <div className="checkout-success-icon" aria-hidden="true">
        {order.paymentStatus === "rechazado" ? "!" : "✓"}
      </div>

      <h1 className="checkout-page__title checkout-success__heading">{headingFor(order)}</h1>
      <p className="checkout-success__sub">
        {order.receiptSent
          ? "Te enviamos a tu correo el acuse de recibo con el detalle del pedido."
          : "Guarda tu número de pedido para hacer seguimiento."}
      </p>

      <div className="checkout-confirm-card">
        <div className="checkout-confirm-row">
          <span>Número de pedido</span>
          <strong className="checkout-confirm-highlight">{order.orderNumber}</strong>
        </div>
        {order.items.map((it, idx) => (
          <div className="checkout-confirm-row" key={`${it.productName}-${idx}`}>
            <span>
              {it.productName}
              {[it.sizeName, it.colorName].filter(Boolean).length > 0
                ? ` · ${[it.sizeName, it.colorName].filter(Boolean).join(" · ")}`
                : ""}{" "}
              × {it.quantity} ({formatCOP(it.unitPrice)} c/u)
            </span>
            <span>{formatCOP(it.lineTotal)}</span>
          </div>
        ))}
        <div className="checkout-confirm-row">
          <span>Subtotal</span>
          <span>{formatCOP(order.subtotal)}</span>
        </div>
        {order.discountTotal > 0 && (
          <div className="checkout-confirm-row" style={{ color: "var(--color-success)" }}>
            <span>Descuento{order.couponCode ? ` (${order.couponCode})` : ""}</span>
            <span>−{formatCOP(order.discountTotal)}</span>
          </div>
        )}
        {order.taxTotal > 0 && (
          <div className="checkout-confirm-row">
            <span>IVA{order.ivaPercent > 0 ? ` (${order.ivaPercent}%)` : ""}</span>
            <span>{formatCOP(order.taxTotal)}</span>
          </div>
        )}
        <div className="checkout-confirm-row">
          <span>Envío</span>
          <span>{order.shippingCost > 0 ? formatCOP(order.shippingCost) : "Gratis"}</span>
        </div>
        <div className="checkout-confirm-row">
          <span>{paid ? "Total pagado" : "Total"}</span>
          <strong>{formatCOP(order.total)}</strong>
        </div>
        <div className="checkout-confirm-row">
          <span>Método de pago</span>
          <span>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</span>
        </div>
        <div className="checkout-confirm-row">
          <span>Estado del pago</span>
          <span>{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</span>
        </div>
      </div>

      {order.paymentMethod === "nequi_manual" && !paid && (
        <div className="checkout-payment-notice checkout-payment-notice--nequi">
          <p className="checkout-payment-notice__title">Siguiente paso</p>
          <p>
            Envía el comprobante de tu transferencia Nequi por WhatsApp al
            número de atención de Dizor para confirmar tu pago.
          </p>
          <a
            href={getWhatsAppUrl(buildWhatsAppMessage(order))}
            target="_blank"
            rel="noreferrer"
            className="checkout-btn checkout-btn--primary"
            style={{ display: "inline-block", marginTop: "0.75rem" }}
            onClick={() =>
              trackWhatsAppClick({ linkLocation: "order_confirmation", purpose: "payment_proof" })
            }
          >
            Enviar comprobante por WhatsApp
          </a>
        </div>
      )}

      {order.paymentMethod === "wompi" && !paid && order.paymentStatus !== "rechazado" && (
        <div className="checkout-payment-notice">
          <p className="checkout-payment-notice__title">Pago en línea</p>
          <p>
            Estamos esperando la confirmación de Wompi. El estado del pago se
            actualizará cuando la pasarela lo confirme; puedes consultarlo en
            el seguimiento del pedido.
          </p>
        </div>
      )}

      {order.paymentMethod === "contra_entrega" && (
        <div className="checkout-payment-notice checkout-payment-notice--info">
          <p>
            Pagarás al recibir tu pedido. El repartidor cobrará el valor exacto
            en efectivo o con tu método acordado.
          </p>
        </div>
      )}

      <div className="checkout-confirm-actions">
        <Link
          href={`/seguimiento?order=${encodeURIComponent(order.orderNumber)}`}
          className="checkout-btn checkout-btn--primary"
        >
          Rastrear pedido
        </Link>
        {isAuthenticated && (
          <Link href="/cuenta?tab=pedidos" className="checkout-btn">
            Ver mis pedidos
          </Link>
        )}
        <Link href="/catalogo" className="checkout-btn">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<p className="auth-loading">Cargando confirmación...</p>}>
      <ConfirmacionContent />
    </Suspense>
  );
}
