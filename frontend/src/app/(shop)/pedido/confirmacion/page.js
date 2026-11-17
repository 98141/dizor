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
  efectivo: "Efectivo",
  nequi_presencial: "Nequi presencial",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const PAYMENT_STATUS_LABELS = {
  pendiente: "Pendiente",
  pagado: "Aprobado",
  rechazado: "Rechazado",
  reembolsado: "Reembolsado",
};

const ORDER_STATUS_LABELS = {
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

// El título no afirma un pago que el servidor no haya marcado como aprobado.
function confirmationCopy(order) {
  if (order.paymentStatus === "rechazado" || order.orderStatus === "rechazado") {
    return {
      tone: "alert",
      title: "El pago no se completó",
      lead: "El pedido quedó registrado, pero el pago no fue aprobado. El estado que ves es el que devolvió el sistema.",
    };
  }
  if (order.orderStatus === "cancelado") {
    return {
      tone: "alert",
      title: "Este pedido fue cancelado",
      lead: "Conserva el número si necesitas consultarlo más adelante.",
    };
  }
  if (order.orderStatus === "devuelto") {
    return {
      tone: "quiet",
      title: "Pedido devuelto",
      lead: "El estado que ves es el registrado en el sistema.",
    };
  }

  let lead = order.receiptSent
    ? "Te enviamos a tu correo el acuse de recibo con el detalle del pedido."
    : "Tu pedido quedó registrado. Conserva este número para consultarlo cuando lo necesites.";

  if (order.paymentStatus === "pendiente" && order.paymentMethod !== "contra_entrega") {
    lead = order.receiptSent
      ? "Te enviamos el acuse de recibo. El pago sigue pendiente de confirmación."
      : "Tu pedido quedó registrado. El pago sigue pendiente de confirmación.";
  }

  return {
    tone: "ok",
    title: "¡Gracias por tu compra!",
    lead,
  };
}

function OrderGlyph({ tone }) {
  const alert = tone === "alert";
  return (
    <span className={`order-glyph${alert ? " order-glyph--alert" : tone === "quiet" ? " order-glyph--quiet" : ""}`} aria-hidden="true">
      {alert ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx="12" cy="16.6" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      ) : tone === "quiet" ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M7 8.5h10v9.5H7z" />
          <path d="M9 8.5V7.2A3 3 0 0 1 12 4a3 3 0 0 1 3 3.2v1.3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6.5 12.5 10 16l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
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
          className="confirm-modal order-register order-register--done"
          role="dialog"
          aria-modal="true"
        >
          <OrderGlyph tone="ok" />
          <h2 className="guest-modal__title">¡Cuenta creada!</h2>
          <p className="confirm-modal__message">
            Tus pedidos quedan guardados en tu perfil.
          </p>
          <div className="confirm-modal__actions">
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
        className="confirm-modal order-register"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registro-modal-title"
        onClick={(e) => e.stopPropagation()}
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
          <div className="confirm-modal__actions order-register__actions">
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

// Consulta sobre un pedido registrado con un medio de pago que ya no se
// ofrece (Nequi directo / transferencia manual, desactivados 2026-11-16).
// No pide comprobantes ni transferencias: solo abre la conversación.
function buildWhatsAppMessage(order) {
  return `Hola, tengo una consulta sobre el pago de mi pedido *${order.orderNumber}*.`;
}

function shippingLabel(order) {
  if (order.shippingIncluded) return "Incluido en el precio";
  return Number(order.shippingCost) > 0 ? formatCOP(order.shippingCost) : "Sin costo";
}

function NextStep({ order }) {
  const paid = order.paymentStatus === "pagado";
  const rejected = order.paymentStatus === "rechazado";
  const closed = ["cancelado", "rechazado", "devuelto"].includes(order.orderStatus);

  if (
    !rejected &&
    !closed &&
    (order.paymentMethod === "nequi_manual" || order.paymentMethod === "nequi_api") &&
    !paid
  ) {
    return (
      <section className="order-note order-note--attention" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Siguiente paso</h2>
        <p>
          Este pedido se registró con un medio de pago que ya no ofrecemos. No
          realices transferencias por tu cuenta: escríbenos indicando el número
          de pedido y te indicaremos cómo continuar.
        </p>
        <a
          href={getWhatsAppUrl(buildWhatsAppMessage(order))}
          target="_blank"
          rel="noreferrer"
          className="order-btn order-btn--primary"
          onClick={() =>
            trackWhatsAppClick({ linkLocation: "order_confirmation", purpose: "payment_inquiry" })
          }
        >
          Escribir por WhatsApp
        </a>
      </section>
    );
  }

  if (!rejected && !closed && order.paymentMethod === "wompi" && !paid) {
    return (
      <section className="order-note" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Pago en línea</h2>
        <p>
          Estamos esperando la confirmación de Wompi. El estado del pago se
          actualizará cuando la pasarela lo confirme; puedes consultarlo en
          el seguimiento del pedido.
        </p>
      </section>
    );
  }

  if (
    !rejected &&
    !closed &&
    !paid &&
    order.paymentStatus !== "reembolsado" &&
    order.paymentMethod === "contra_entrega"
  ) {
    return (
      <section className="order-note" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Siguiente paso</h2>
        <p>
          Pagarás al recibir tu pedido. El repartidor cobrará el valor exacto
          en efectivo o con tu método acordado.
        </p>
      </section>
    );
  }

  if (order.paymentStatus === "reembolsado") {
    return (
      <section className="order-note" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Pago</h2>
        <p>El pago figura como reembolsado.</p>
      </section>
    );
  }

  if (order.orderStatus === "en_preparacion") {
    return (
      <section className="order-note" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Siguiente paso</h2>
        <p>El pedido está en preparación.</p>
      </section>
    );
  }

  if (order.orderStatus === "enviado") {
    return (
      <section className="order-note" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Siguiente paso</h2>
        <p>
          El pedido figura como enviado. La guía, si ya fue registrada, aparece
          al consultar el pedido con tu correo.
        </p>
      </section>
    );
  }

  if (order.orderStatus === "entregado") {
    return (
      <section className="order-note" aria-labelledby="order-next-title">
        <h2 id="order-next-title" className="order-note__title">Estado</h2>
        <p>El pedido figura como entregado.</p>
      </section>
    );
  }

  return null;
}

function OrderSummary({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const paid = order.paymentStatus === "pagado";
  const registered = formatOrderDate(order.createdAt);

  return (
    <>
      <p className="order-ref">
        Pedido <strong>{order.orderNumber}</strong>
        <span className={`order-status order-status--${statusTone(order.orderStatus)}`}>
          {ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
        </span>
      </p>
      {registered && <p className="order-ref__date">Registrado el {registered}</p>}

      <div className="order-view__body">
        <section className="order-section" aria-labelledby="order-summary-title">
          <h2 id="order-summary-title" className="order-section__title">Resumen</h2>
          {items.length > 0 && (
            <ul className="order-items">
              {items.map((it, idx) => {
                const variant = [it.sizeName, it.colorName].filter(Boolean).join(" · ");
                const qty = `${it.quantity} × ${formatCOP(it.unitPrice)}`;
                return (
                  <li key={`${it.productName}-${idx}`}>
                    <div>
                      <p className="order-line__name">{it.productName}</p>
                      <p className="order-line__meta">{variant ? `${variant} · ${qty}` : qty}</p>
                    </div>
                    <span className="order-line__amount">{formatCOP(it.lineTotal)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="order-totals">
            <div className="order-totals__row">
              <span>Subtotal</span>
              <span>{formatCOP(order.subtotal)}</span>
            </div>
            {Number(order.discountTotal) > 0 && (
              <div className="order-totals__row order-totals__row--discount">
                <span>Descuento{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                <span>−{formatCOP(order.discountTotal)}</span>
              </div>
            )}
            {Number(order.taxTotal) > 0 && (
              <div className="order-totals__row">
                <span>IVA{Number(order.ivaPercent) > 0 ? ` (${order.ivaPercent}%)` : ""}</span>
                <span>{formatCOP(order.taxTotal)}</span>
              </div>
            )}
            <div className="order-totals__row">
              <span>Envío</span>
              <span>{shippingLabel(order)}</span>
            </div>
            <div className="order-totals__grand">
              <span>{paid ? "Total pagado" : "Total"}</span>
              <strong>{formatCOP(order.total)}</strong>
            </div>
          </div>
        </section>

        <section className="order-section" aria-labelledby="order-payment-title">
          <h2 id="order-payment-title" className="order-section__title">Pago</h2>
          <dl className="order-meta">
            <div>
              <dt>Método</dt>
              <dd>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</dd>
            </div>
            <div>
              <dt>Estado del pago</dt>
              <dd>{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</dd>
            </div>
          </dl>
        </section>

        <NextStep order={order} />
      </div>
    </>
  );
}

function OrderViewFrame({ children, busy = false }) {
  return (
    <div className="order-view" aria-busy={busy || undefined}>
      <div className="order-view__shell">{children}</div>
    </div>
  );
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
      <OrderViewFrame>
        <article className="order-view__panel order-view__panel--center">
          <h1 className="order-view__title">No encontramos el pedido</h1>
          <p className="order-view__lead">Este enlace no incluye un número de pedido.</p>
          <div className="order-actions">
            <Link href="/catalogo" className="order-btn order-btn--primary">
              Volver a la tienda
            </Link>
          </div>
        </article>
      </OrderViewFrame>
    );
  }

  if (status === "loading") {
    return (
      <OrderViewFrame busy>
        <div className="order-view__panel order-view__panel--loading">
          <p className="order-view__loading">Cargando confirmación…</p>
        </div>
      </OrderViewFrame>
    );
  }

  if (status === "limited") {
    const loginHref = `/login?next=${encodeURIComponent(confirmationPath(orderNumber))}`;
    return (
      <OrderViewFrame>
        <article className="order-view__panel order-view__panel--center">
          <h1 className="order-view__title">Verifica tu acceso</h1>
          <p className="order-ref">
            Pedido <strong>{orderNumber}</strong>
          </p>
          <p className="order-view__lead">
            Por seguridad, el detalle del pedido solo se muestra en el navegador
            donde hiciste la compra o si inicias sesión con tu cuenta.
          </p>
          <div className="order-actions">
            <Link
              href={`/seguimiento?order=${encodeURIComponent(orderNumber)}`}
              className="order-btn order-btn--primary"
            >
              Consultar pedido
            </Link>
            <Link href={loginHref} className="order-btn order-btn--ghost">
              Iniciar sesión
            </Link>
          </div>
          <Link href="/catalogo" className="order-view__quiet">
            Volver a la tienda
          </Link>
        </article>
      </OrderViewFrame>
    );
  }

  const copy = confirmationCopy(order);
  const orderHref = isAuthenticated
    ? "/cuenta?tab=pedidos"
    : `/seguimiento?order=${encodeURIComponent(order.orderNumber)}`;

  return (
    <OrderViewFrame>
      <article className="order-view__panel">
        <RegistroPromptModal
          email={order.buyer?.email || ""}
          name={order.buyer?.name || ""}
          isOpen={showRegistroModal && !isAuthenticated}
          onClose={() => setShowRegistroModal(false)}
        />

        <header className="order-view__hero">
          <h1 className="order-view__title">{copy.title}</h1>
          <p className="order-view__lead">{copy.lead}</p>
        </header>

        <OrderSummary order={order} />

        <div className="order-actions order-actions--split">
          <Link href={orderHref} className="order-btn order-btn--primary">
            Ver mi pedido
          </Link>
          <Link href="/catalogo" className="order-btn order-btn--ghost">
            Seguir explorando
          </Link>
        </div>
      </article>
    </OrderViewFrame>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense
      fallback={
        <div className="order-view">
          <div className="order-view__shell">
            <div className="order-view__panel order-view__panel--loading">
              <p className="order-view__loading">Cargando confirmación…</p>
            </div>
          </div>
        </div>
      }
    >
      <ConfirmacionContent />
    </Suspense>
  );
}
