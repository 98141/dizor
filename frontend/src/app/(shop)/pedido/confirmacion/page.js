"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatCOP } from "@/lib/formatCurrency";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { trackWhatsAppClick } from "@/lib/analytics/events";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";

const PAYMENT_LABELS = {
  wompi: "Tarjeta / PSE (Wompi)",
  nequi_manual: "Nequi (transferencia manual)",
  contra_entrega: "Pago contra entrega",
};

function RegistroPromptModal({ email, name, isOpen, onClose }) {
  const { register } = useAuth();
  const [regName, setRegName] = useState(name || "");
  const [regPassword, setRegPassword] = useState("");
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
    setRegLoading(true);
    setRegError("");
    try {
      await register({
        name: regName.trim(),
        email,
        password: regPassword,
        passwordConfirm: regPassword,
      });
      setRegSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (
        msg.toLowerCase().includes("ya está registrado") ||
        msg.toLowerCase().includes("already")
      ) {
        setRegError(
          <>
            Ese correo ya tiene cuenta.{" "}
            <Link href={`/login?email=${encodeURIComponent(email)}`}>
              Inicia sesión
            </Link>
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
          momento.
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
              disabled={regLoading}
            >
              {regLoading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildWhatsAppMessage({ orderNumber, subtotal, discount, couponCode, iva, ivaPercent, shipping, total, freeShipping }) {
  const fmt = (n) =>
    Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  const lines = [
    `Hola! Quiero enviar mi comprobante de pago para el pedido *${orderNumber}*`,
    "",
    "📋 Resumen:",
    `Subtotal: ${fmt(subtotal)}`,
  ];

  if (Number(discount) > 0) {
    lines.push(`Descuento${couponCode ? ` (${couponCode})` : ""}: -${fmt(discount)}`);
  }

  if (Number(iva) > 0) {
    lines.push(`IVA${ivaPercent > 0 ? ` (${ivaPercent}%)` : ""}: ${fmt(iva)}`);
  }

  if (freeShipping === "1") {
    lines.push("Envío: Gratis");
  } else {
    lines.push(`Envío: ${fmt(shipping)}`);
  }

  lines.push(`*Total a pagar: ${fmt(total)}*`, "", "Adjunto el comprobante Nequi.");
  return lines.join("\n");
}

function ConfirmacionContent() {
  const sp = useSearchParams();
  const { isAuthenticated } = useAuth();

  const orderNumber = sp.get("order");
  const total = sp.get("total");
  const payment = sp.get("payment");

  const subtotal = sp.get("subtotal") || "0";
  const discount = sp.get("discount") || "0";
  const couponCode = sp.get("couponCode") || "";
  const iva = sp.get("iva") || "0";
  const ivaPercent = Number(sp.get("ivaPercent") || "0");
  const shipping = sp.get("shipping") || "0";
  const freeShipping = sp.get("freeShipping") || "0";

  // Para Wompi: el redirect externo no incluye email/nombre en la URL,
  // por lo que se recuperan del sessionStorage guardado antes de la redirección.
  const urlEmail = sp.get("email") || "";
  const urlName = sp.get("name") || "";
  const [guestEmail, setGuestEmail] = useState(urlEmail);
  const [guestName, setGuestName] = useState(urlName);

  const [showRegistroModal, setShowRegistroModal] = useState(false);

  useEffect(() => {
    if (!urlEmail) {
      try {
        const storedEmail = sessionStorage.getItem("dizor_guest_email") || "";
        const storedName = sessionStorage.getItem("dizor_guest_name") || "";
        if (storedEmail) {
          setGuestEmail(storedEmail);
          setGuestName(storedName);
        }
      } catch {}
    }
  }, [urlEmail]);

  // Abrir el modal automáticamente 1.5 s después de llegar a la confirmación
  useEffect(() => {
    if (isAuthenticated) return;
    const resolvedEmail = urlEmail || (() => {
      try { return sessionStorage.getItem("dizor_guest_email") || ""; } catch { return ""; }
    })();
    if (!resolvedEmail) return;

    const timer = setTimeout(() => setShowRegistroModal(true), 1500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, urlEmail]);

  const handleCloseModal = () => {
    setShowRegistroModal(false);
    try {
      sessionStorage.removeItem("dizor_guest_email");
      sessionStorage.removeItem("dizor_guest_name");
    } catch {}
  };

  if (!orderNumber) {
    return (
      <div className="checkout-page checkout-success">
        <p>Información de pedido no encontrada.</p>
        <Link href="/">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <RegistroPromptModal
        email={guestEmail}
        name={guestName}
        isOpen={showRegistroModal && !isAuthenticated && !!guestEmail}
        onClose={handleCloseModal}
      />

      {/* ── Icono de éxito ── */}
      <div className="checkout-success-icon" aria-hidden="true">✓</div>

      <h1 className="checkout-page__title checkout-success__heading">
        ¡Pedido confirmado!
      </h1>
      <p className="checkout-success__sub">
        Gracias por comprar en Dizor. En breve recibirás novedades de tu pedido.
      </p>

      {/* ── Resumen del pedido ── */}
      <div className="checkout-confirm-card">
        <div className="checkout-confirm-row">
          <span>Número de pedido</span>
          <strong className="checkout-confirm-highlight">{orderNumber}</strong>
        </div>
        {Number(subtotal) > 0 && (
          <>
            <div className="checkout-confirm-row">
              <span>Subtotal</span>
              <span>{formatCOP(Number(subtotal))}</span>
            </div>
            {Number(discount) > 0 && (
              <div className="checkout-confirm-row" style={{ color: "var(--color-success)" }}>
                <span>Descuento{couponCode ? ` (${couponCode})` : ""}</span>
                <span>−{formatCOP(Number(discount))}</span>
              </div>
            )}
            {Number(iva) > 0 && (
              <div className="checkout-confirm-row">
                <span>IVA{ivaPercent > 0 ? ` (${ivaPercent}%)` : ""}</span>
                <span>{formatCOP(Number(iva))}</span>
              </div>
            )}
            <div className="checkout-confirm-row">
              <span>Envío</span>
              <span>
                {freeShipping === "1" || Number(shipping) === 0
                  ? "Gratis"
                  : formatCOP(Number(shipping))}
              </span>
            </div>
          </>
        )}
        <div className="checkout-confirm-row">
          <span>Total pagado</span>
          <strong>{formatCOP(Number(total))}</strong>
        </div>
        <div className="checkout-confirm-row">
          <span>Método de pago</span>
          <span>{PAYMENT_LABELS[payment] || payment}</span>
        </div>
      </div>

      {/* ── Instrucciones por método de pago ── */}
      {payment === "nequi_manual" && (
        <div className="checkout-payment-notice checkout-payment-notice--nequi">
          <p className="checkout-payment-notice__title">Siguiente paso</p>
          <p>
            Envía el comprobante de tu transferencia Nequi por WhatsApp al
            número de atención de Dizor para confirmar tu pago.
          </p>
          <a
            href={getWhatsAppUrl(
              buildWhatsAppMessage({ orderNumber, subtotal, discount, couponCode, iva, ivaPercent, shipping, total, freeShipping })
            )}
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

      {payment === "wompi" && (
        <div className="checkout-payment-notice">
          <p className="checkout-payment-notice__title">Pago en línea</p>
          <p>
            Si fuiste redirigido a Wompi y completaste el pago, tu pedido está
            confirmado. Si aún no lo has hecho, vuelve a iniciar el proceso
            desde el carrito.
          </p>
        </div>
      )}

      {payment === "contra_entrega" && (
        <div className="checkout-payment-notice checkout-payment-notice--info">
          <p>
            Pagarás al recibir tu pedido. El repartidor cobrará el valor exacto
            en efectivo o con tu método acordado.
          </p>
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="checkout-confirm-actions">
        <Link
          href={`/seguimiento?order=${orderNumber}&email=${encodeURIComponent(guestEmail)}`}
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
