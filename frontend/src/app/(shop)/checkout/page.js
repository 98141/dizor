"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

const STAFF_ROLES = ["superadmin", "admin", "vendedor"];

const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Administrador",
  vendedor: "Vendedor",
};
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import {
  getCheckoutConfig,
  calculateCheckout,
  createOrder,
  getNequiStatus,
  retryNequiPayment,
} from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";

const STEPS = ["Datos", "Envío", "Entrega", "Pago", "Confirmar"];

const CARRIER_LABELS = {
  interrapidisimo: "Interrapidísimo",
  envia: "Envía",
  coordinadora: "Coordinadora",
};

const NEQUI_MAX_POLLS    = 75;  // 5 minutos a 4 s por poll
const NEQUI_POLL_INTERVAL = 4000;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, hydrated, toApiItems, clearCart, appliedCoupon, clearCoupon } = useCart();
  const { user, isAuthenticated } = useAuth();

  // Clave única por sesión de checkout — evita órdenes duplicadas por doble clic o reenvío
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const submittingRef = useRef(false);

  const [step, setStep]   = useState(0);
  const [config, setConfig] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(null);

  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });

  const [shipping, setShipping] = useState({
    address: "",
    city: "",
    department: "Nariño",
    postalCode: "",
  });

  const [carrier, setCarrier]           = useState("interrapidisimo");
  const [paymentMethod, setPaymentMethod] = useState("contra_entrega");
  const [customerNotes, setCustomerNotes] = useState("");

  // ─── Estado Nequi API ──────────────────────────────────────────────────────
  const [nequiPhone, setNequiPhone] = useState("");

  // nequiPending: { orderId, orderNumber, total, phone, buyerEmail, buyerName }
  const [nequiPending, setNequiPending]   = useState(null);
  const [nequiError, setNequiError]       = useState("");
  const [nequiRetrying, setNequiRetrying] = useState(false);
  const [nequiRetryCount, setNequiRetryCount] = useState(0);

  // ─── Prellenar datos del usuario autenticado ───────────────────────────────
  useEffect(() => {
    if (user) {
      setBuyer({
        name:  user.name  || "",
        email: user.email || "",
        phone: user.phone || "",
      });

      const saved = user.shippingAddresses || [];
      if (saved.length > 0) {
        const defaultAddr = saved.find((a) => a.isDefault) || saved[0];
        setShipping({
          address:    defaultAddr.address,
          city:       defaultAddr.city,
          department: defaultAddr.department,
          postalCode: defaultAddr.postalCode || "",
        });
      }
    }
  }, [user]);

  useEffect(() => {
    getCheckoutConfig().then((d) => setConfig(d.config));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0 && !success && !nequiPending) {
      router.replace("/carrito");
    }
  }, [hydrated, items, router, success, nequiPending]);

  const recalculate = async (department) => {
    if (items.length === 0) return;
    try {
      const data = await calculateCheckout(toApiItems(), department);
      setTotals(data.totals);
    } catch {
      setTotals(null);
    }
  };

  useEffect(() => {
    if (shipping.department) recalculate(shipping.department);
  }, [items, shipping.department]);

  // ─── Polling Nequi ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nequiPending) return;

    let pollCount = 0;

    const interval = setInterval(async () => {
      pollCount++;

      if (pollCount > NEQUI_MAX_POLLS) {
        clearInterval(interval);
        setNequiError(
          "El tiempo de espera expiró. Tu pedido quedó registrado con el número " +
          nequiPending.orderNumber +
          ". Si ya pagaste en Nequi, contacta soporte para confirmar."
        );
        return;
      }

      try {
        const data = await getNequiStatus(nequiPending.orderId);

        if (data.orderStatus === "pagado") {
          clearInterval(interval);
          const params = new URLSearchParams({
            order:       nequiPending.orderNumber,
            total:       nequiPending.total,
            payment:     "nequi_api",
            email:       nequiPending.buyerEmail,
            name:        nequiPending.buyerName,
            subtotal:    nequiPending.subtotal ?? nequiPending.total,
            discount:    nequiPending.discount ?? 0,
            couponCode:  nequiPending.couponCode ?? "",
            iva:         nequiPending.iva ?? 0,
            ivaPercent:  nequiPending.ivaPercent ?? 0,
            shipping:    nequiPending.shipping ?? 0,
            freeShipping: nequiPending.freeShipping ?? "0",
          });
          router.push(`/pedido/confirmacion?${params.toString()}`);
        } else if (data.orderStatus === "cancelado") {
          clearInterval(interval);
          setNequiError("El pago fue rechazado o expiró en la app Nequi.");
        }
      } catch {
        // Ignorar errores de red y seguir intentando
      }
    }, NEQUI_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [nequiPending, nequiRetryCount, router]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleBuyerChange   = (e) => setBuyer((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleShippingChange = (e) => setShipping((p) => ({ ...p, [e.target.name]: e.target.value }));

  const normalizeNequiPhone = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("57")) return digits.slice(2);
    return digits.slice(-10);
  };

  const canNext = () => {
    if (step === 0) return buyer.name && buyer.email && buyer.phone;
    if (step === 1) return shipping.address && shipping.city && shipping.department;
    if (step === 2) return !!carrier;
    if (step === 3) {
      if (!paymentMethod) return false;
      if (paymentMethod === "nequi_api") {
        return /^3\d{9}$/.test(normalizeNequiPhone(nequiPhone));
      }
      return true;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await createOrder({
        items:           toApiItems(),
        buyer,
        shippingAddress: shipping,
        paymentMethod,
        carrier,
        customerNotes,
        couponCode:      appliedCoupon?.code || null,
        idempotencyKey,
        nequiPhone:      paymentMethod === "nequi_api" ? normalizeNequiPhone(nequiPhone) : undefined,
      });

      clearCart();
      clearCoupon();
      setSuccess(data.order);

      // Wompi: redirigir al checkout externo
      if (data.paymentUrl) {
        try {
          sessionStorage.setItem("dizor_guest_email", buyer.email);
          sessionStorage.setItem("dizor_guest_name", buyer.name);
        } catch {}
        window.location.href = data.paymentUrl;
        return;
      }

      // Nequi API: mostrar pantalla de espera + polling
      if (paymentMethod === "nequi_api") {
        setNequiPending({
          orderId:     data.order.id,
          orderNumber: data.order.orderNumber,
          total:       data.order.total,
          phone:       normalizeNequiPhone(nequiPhone),
          buyerEmail:  buyer.email,
          buyerName:   buyer.name,
          subtotal:    totals?.subtotal ?? data.order.total,
          discount:    appliedCoupon?.discountAmount || 0,
          couponCode:  appliedCoupon?.code || "",
          iva:         totals?.taxTotal ?? 0,
          ivaPercent:  totals?.ivaPercent ?? 0,
          shipping:    totals?.shippingCost ?? 0,
          freeShipping: totals?.freeShippingApplied ? "1" : "0",
        });
        return;
      }

      // Otros métodos: ir directo a confirmación
      const couponDiscount = appliedCoupon?.discountAmount || 0;
      const params = new URLSearchParams({
        order:        data.order.orderNumber,
        total:        data.order.total,
        payment:      data.order.paymentMethod,
        email:        buyer.email,
        name:         buyer.name,
        subtotal:     totals?.subtotal ?? 0,
        discount:     couponDiscount,
        couponCode:   appliedCoupon?.code || "",
        iva:          totals?.taxTotal ?? 0,
        ivaPercent:   totals?.ivaPercent ?? 0,
        shipping:     totals?.shippingCost ?? 0,
        freeShipping: totals?.freeShippingApplied ? "1" : "0",
      });
      router.push(`/pedido/confirmacion?${params.toString()}`);
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo crear el pedido");
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleNequiRetry = async () => {
    if (!nequiPending) return;
    setNequiRetrying(true);
    setNequiError("");
    try {
      await retryNequiPayment(nequiPending.orderId, nequiPending.phone);
      setNequiRetryCount((c) => c + 1); // reactiva el polling effect
    } catch (err) {
      setNequiError(err.response?.data?.message || "No se pudo reintentar el cobro Nequi");
    } finally {
      setNequiRetrying(false);
    }
  };

  // ─── Pantalla: Nequi pendiente ─────────────────────────────────────────────
  if (nequiPending) {
    return (
      <div className="checkout-page">
        <h1 className="checkout-page__title">Pago con Nequi</h1>
        <div className="checkout-card checkout-nequi-pending">
          {!nequiError ? (
            <>
              <div className="checkout-nequi-pending__spinner" aria-hidden="true" />
              <h2 className="checkout-nequi-pending__title">
                Esperando tu aprobación en Nequi
              </h2>
              <p className="checkout-nequi-pending__desc">
                Enviamos una notificación de cobro al número{" "}
                <strong>{nequiPending.phone}</strong>
              </p>
              <ol className="checkout-nequi-pending__steps">
                <li>Abre tu <strong>app Nequi</strong></li>
                <li>Ve a <strong>Cobros recibidos</strong></li>
                <li>Aprueba el pago de <strong>{formatCOP(nequiPending.total)}</strong></li>
              </ol>
              <p className="checkout-nequi-pending__order">
                Pedido: <strong>{nequiPending.orderNumber}</strong>
              </p>
            </>
          ) : (
            <>
              <div className="checkout-nequi-pending__icon checkout-nequi-pending__icon--error">
                ✕
              </div>
              <h2 className="checkout-nequi-pending__title">Pago no completado</h2>
              <AuthErrorAlert message={nequiError} />
              <p className="checkout-nequi-pending__order">
                Pedido registrado:{" "}
                <strong>{nequiPending.orderNumber}</strong>
              </p>
              <div className="checkout-nequi-pending__actions">
                <button
                  type="button"
                  className="checkout-btn checkout-btn--primary"
                  onClick={handleNequiRetry}
                  disabled={nequiRetrying}
                >
                  {nequiRetrying ? "Enviando..." : "Reintentar cobro Nequi"}
                </button>
                <Link href="/catalogo" className="checkout-btn">
                  Seguir comprando
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Pantalla: cargando o staff ────────────────────────────────────────────
  const isStaff = user && STAFF_ROLES.includes(user.role);

  if (!hydrated || !config) {
    return <p className="auth-loading">Preparando checkout...</p>;
  }

  if (isStaff) {
    return (
      <div className="checkout-page">
        <h1 className="checkout-page__title">Checkout</h1>
        <div className="checkout-staff-notice">
          <span className="checkout-staff-notice__icon">⚠</span>
          <h2 className="checkout-staff-notice__title">
            Cuenta de personal — compras no disponibles
          </h2>
          <p className="checkout-staff-notice__text">
            Estás navegando como <strong>{ROLE_LABELS[user.role]}</strong>. Las
            cuentas de personal no pueden realizar compras en la tienda. Para
            hacer un pedido, inicia sesión con una cuenta de cliente o compra
            como invitado.
          </p>
          <div className="checkout-staff-notice__actions">
            <Link href="/catalogo">Seguir explorando</Link>
            <Link href="/carrito">Ver carrito</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Checkout por pasos ────────────────────────────────────────────────────
  return (
    <div className="checkout-page">
      <h1 className="checkout-page__title">Checkout</h1>

      {!isAuthenticated && (
        <p style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          Compra como invitado.{" "}
          <Link href="/login">Inicia sesión</Link> para guardar tu historial.
        </p>
      )}

      <div className="checkout-steps">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`checkout-step${i === step ? " checkout-step--active" : ""}${i < step ? " checkout-step--done" : ""}`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {/* Paso 0: Datos del cliente */}
      {step === 0 && (
        <div className="checkout-card">
          <h2>Datos del cliente</h2>
          <form className="checkout-form">
            <AuthFormField
              label="Nombre completo"
              name="name"
              value={buyer.name}
              onChange={handleBuyerChange}
            />
            <AuthFormField
              label="Correo electrónico"
              name="email"
              type="email"
              value={buyer.email}
              onChange={handleBuyerChange}
            />
            <AuthFormField
              label="Teléfono / WhatsApp"
              name="phone"
              type="tel"
              value={buyer.phone}
              onChange={handleBuyerChange}
            />
          </form>
        </div>
      )}

      {/* Paso 1: Dirección de envío */}
      {step === 1 && (
        <div className="checkout-card">
          <h2>Dirección de envío</h2>
          <form className="checkout-form">
            {isAuthenticated && user?.shippingAddresses?.length > 0 && (
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="savedAddress">
                  Dirección guardada
                </label>
                <select
                  id="savedAddress"
                  className="auth-field__input"
                  defaultValue=""
                  onChange={(e) => {
                    const addr = user.shippingAddresses.find(
                      (a) => a.id === e.target.value
                    );
                    if (!addr) return;
                    setShipping({
                      address:    addr.address,
                      city:       addr.city,
                      department: addr.department,
                      postalCode: addr.postalCode || "",
                    });
                  }}
                >
                  <option value="">Escribir otra dirección</option>
                  {user.shippingAddresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label} — {addr.address}, {addr.city}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <AuthFormField
              label="Dirección"
              name="address"
              value={shipping.address}
              onChange={handleShippingChange}
            />
            <div className="checkout-form__row checkout-form__row--2">
              <AuthFormField
                label="Ciudad"
                name="city"
                value={shipping.city}
                onChange={handleShippingChange}
              />
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="department">
                  Departamento
                </label>
                <select
                  id="department"
                  name="department"
                  className="auth-field__input"
                  value={shipping.department}
                  onChange={handleShippingChange}
                >
                  {config.departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <AuthFormField
              label="Código postal (opcional)"
              name="postalCode"
              value={shipping.postalCode}
              onChange={handleShippingChange}
            />
          </form>
        </div>
      )}

      {/* Paso 2: Método de entrega */}
      {step === 2 && (
        <div className="checkout-card">
          <h2>Método de entrega</h2>
          <div className="checkout-form">
            {config.carriers.map((c) => (
              <label
                key={c}
                className={`checkout-payment-option${carrier === c ? " checkout-payment-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="carrier"
                  checked={carrier === c}
                  onChange={() => setCarrier(c)}
                />
                <div>
                  <p className="checkout-payment-option__title">
                    {CARRIER_LABELS[c] || c}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3: Método de pago */}
      {step === 3 && (
        <div className="checkout-card">
          <h2>Método de pago</h2>
          <div className="checkout-form">
            {config.paymentMethods.map((pm) => (
              <div key={pm.id}>
                <label
                  className={`checkout-payment-option${paymentMethod === pm.id ? " checkout-payment-option--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === pm.id}
                    onChange={() => setPaymentMethod(pm.id)}
                  />
                  <div>
                    <p className="checkout-payment-option__title">{pm.label}</p>
                    <p className="checkout-payment-option__desc">
                      {pm.description}
                    </p>
                  </div>
                </label>

                {/* Campo de teléfono solo para Nequi API */}
                {pm.id === "nequi_api" && paymentMethod === "nequi_api" && (
                  <div className="checkout-nequi-phone-field">
                    <AuthFormField
                      label="Número de teléfono Nequi"
                      name="nequiPhone"
                      type="tel"
                      value={nequiPhone}
                      onChange={(e) => setNequiPhone(e.target.value)}
                      placeholder="Ej: 3001234567"
                    />
                    <p className="checkout-nequi-phone-field__hint">
                      Ingresa el número vinculado a tu cuenta Nequi. Recibirás
                      una notificación para aprobar el pago.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paso 4: Revisión y confirmación */}
      {step === 4 && (
        <div className="checkout-card">
          <h2>Revisión y confirmación</h2>
          <div className="checkout-review-item">
            <span>Cliente</span>
            <span>{buyer.name}</span>
          </div>
          <div className="checkout-review-item">
            <span>Envío a</span>
            <span>
              {shipping.city}, {shipping.department}
            </span>
          </div>
          <div className="checkout-review-item">
            <span>Transportadora</span>
            <span>{CARRIER_LABELS[carrier]}</span>
          </div>
          <div className="checkout-review-item">
            <span>Pago</span>
            <span>
              {config.paymentMethods.find((p) => p.id === paymentMethod)?.label}
            </span>
          </div>
          {paymentMethod === "nequi_api" && nequiPhone && (
            <div className="checkout-review-item">
              <span>Número Nequi</span>
              <span>{normalizeNequiPhone(nequiPhone)}</span>
            </div>
          )}
          {totals && (
            <>
              <div className="checkout-review-item">
                <span>Subtotal</span>
                <span>{formatCOP(totals.subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="checkout-review-item" style={{ color: "var(--color-success)" }}>
                  <span>Cupón ({appliedCoupon.code})</span>
                  <span>−{formatCOP(appliedCoupon.discountAmount)}</span>
                </div>
              )}
              {totals.ivaEnabled && totals.taxTotal > 0 && (
                <div className="checkout-review-item">
                  <span>IVA ({totals.ivaPercent}%)</span>
                  <span>{formatCOP(totals.taxTotal)}</span>
                </div>
              )}
              <div className="checkout-review-item">
                <span>
                  Envío
                  {totals.freeShippingApplied && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-success)", marginLeft: "0.4rem" }}>
                      (gratis ≥ {formatCOP(totals.freeShippingThreshold)})
                    </span>
                  )}
                </span>
                <span>
                  {totals.shippingCost === 0 ? "Gratis" : formatCOP(totals.shippingCost)}
                </span>
              </div>
              <div
                className="checkout-review-item"
                style={{ fontWeight: 600, fontSize: "1.1rem" }}
              >
                <span>Total</span>
                <span>
                  {formatCOP(totals.total - (appliedCoupon?.discountAmount || 0))}
                </span>
              </div>
            </>
          )}
          <div className="auth-field" style={{ marginTop: "1rem" }}>
            <label className="auth-field__label" htmlFor="notes">
              Notas del pedido
            </label>
            <textarea
              id="notes"
              className="auth-field__input"
              rows={3}
              placeholder="Instrucciones de entrega, personalización..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
            />
          </div>
          <AuthErrorAlert message={error} />
        </div>
      )}

      {/* Navegación entre pasos */}
      <div className="checkout-nav">
        {step > 0 ? (
          <button
            type="button"
            className="checkout-btn"
            onClick={() => setStep((s) => s - 1)}
          >
            Atrás
          </button>
        ) : (
          <Link href="/carrito" className="checkout-btn">
            Volver al carrito
          </Link>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="checkout-btn checkout-btn--primary"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            className="checkout-btn checkout-btn--primary"
            disabled={loading || !totals}
            onClick={handleSubmit}
          >
            {loading ? "Procesando..." : "Confirmar pedido"}
          </button>
        )}
      </div>
    </div>
  );
}
