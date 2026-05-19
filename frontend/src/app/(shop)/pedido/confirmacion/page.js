"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatCOP } from "@/lib/formatCurrency";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";

const PAYMENT_LABELS = {
  wompi: "Tarjeta / PSE (Wompi)",
  nequi_manual: "Nequi (transferencia manual)",
  contra_entrega: "Pago contra entrega",
};

function RegistroPrompt({ email, name }) {
  const { register } = useAuth();
  const [regName, setRegName] = useState(name || "");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (regSuccess) {
    return (
      <div className="checkout-register-prompt checkout-register-prompt--success">
        <p>
          ¡Cuenta creada! Tus pedidos quedan guardados en tu perfil.{" "}
          <Link href="/cuenta">Ver mi cuenta →</Link>
        </p>
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
      if (msg.toLowerCase().includes("ya está registrado") || msg.toLowerCase().includes("already")) {
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
    <div className="checkout-register-prompt">
      <div className="checkout-register-prompt__header">
        <h3 className="checkout-register-prompt__title">
          ¿Guardar tus datos para próximas compras?
        </h3>
        <p className="checkout-register-prompt__desc">
          Crea una cuenta en segundos y consulta tus pedidos en cualquier
          momento.
        </p>
      </div>
      <form
        className="checkout-register-prompt__form"
        onSubmit={handleSubmit}
        noValidate
      >
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
        {regError && (
          <AuthErrorAlert message={regError} />
        )}
        <div className="checkout-register-prompt__actions">
          <button
            type="submit"
            className="checkout-btn checkout-btn--primary"
            disabled={regLoading}
          >
            {regLoading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
          <button
            type="button"
            className="checkout-btn"
            onClick={() => setDismissed(true)}
          >
            Ahora no
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmacionContent() {
  const sp = useSearchParams();
  const { isAuthenticated } = useAuth();

  const orderNumber = sp.get("order");
  const total = sp.get("total");
  const payment = sp.get("payment");
  const guestEmail = sp.get("email") || "";
  const guestName = sp.get("name") || "";

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
            href="https://wa.me/573000000000"
            target="_blank"
            rel="noreferrer"
            className="checkout-btn checkout-btn--primary"
            style={{ display: "inline-block", marginTop: "0.75rem" }}
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

      {/* ── Prompt de registro para invitados ── */}
      {!isAuthenticated && guestEmail && (
        <RegistroPrompt email={guestEmail} name={guestName} />
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
