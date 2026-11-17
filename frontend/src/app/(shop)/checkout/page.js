"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";

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
import {
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackBeginCheckout,
  trackPurchase,
} from "@/lib/analytics/events";
import { mapCartItemToItem } from "@/lib/analytics/productMapper";
import { hasPurchaseBeenTracked, markPurchaseTracked } from "@/lib/analytics/purchaseDedup";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";
import { saveOrderAccess, confirmationPath } from "@/lib/orderAccess";

const STEPS = ["Datos", "Envío", "Entrega", "Pago", "Confirmar"];

const CARRIER_LABELS = {
  interrapidisimo: "Inter Rapidísimo",
  servientrega: "Servientrega",
  // Históricos
  envia: "Envía",
  coordinadora: "Coordinadora",
};

const NEQUI_MAX_POLLS    = 75;  // 5 minutos a 4 s por poll
const NEQUI_POLL_INTERVAL = 4000;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, hydrated, toApiItems, clearCart, appliedCoupon, clearCoupon } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { removePurchasedFromFavorites } = useFavorites();

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

  // Autorización de tratamiento para gestionar el pedido (H-03). Nunca
  // preseleccionada; el servidor la valida de nuevo.
  const [privacyAuthorization, setPrivacyAuthorization] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();
  const privacyNoticeReady = isNoticeReady(notices, "order_processing");
  // Términos y condiciones de compra (H-17): casilla obligatoria, nunca
  // premarcada; el servidor exige `termsAccepted === true`.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsNoticeReady = isNoticeReady(notices, "terms");

  // Líneas del pedido con precios calculados por el servidor (H-19).
  const [quoteItems, setQuoteItems] = useState([]);

  // ─── Estado Nequi API ──────────────────────────────────────────────────────
  const [nequiPhone, setNequiPhone] = useState("");

  // nequiPending: { orderId, orderNumber, total, phone, … } (sin correo ni nombre)
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
    getCheckoutConfig().then((d) => {
      const cfg = d.config;
      setConfig(cfg);
      // Solo se puede elegir lo que el servidor ofrece (hoy: Wompi y
      // contraentrega; transportadoras confirmadas).
      const methods = (cfg?.paymentMethods || []).map((m) => m.id);
      setPaymentMethod((cur) => (methods.includes(cur) ? cur : methods[0] || ""));
      const carriers = cfg?.carriers || [];
      setCarrier((cur) => (carriers.includes(cur) ? cur : carriers[0] || ""));
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0 && !success && !nequiPending) {
      router.replace("/carrito");
    }
  }, [hydrated, items, router, success, nequiPending]);

  // begin_checkout una sola vez por visita, cuando el carrito ya hidrató y
  // tiene contenido válido (el mismo guard que decide si redirigir a
  // /carrito, pero en sentido contrario).
  const beginCheckoutFiredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || items.length === 0 || beginCheckoutFiredRef.current) return;
    beginCheckoutFiredRef.current = true;
    trackBeginCheckout({
      items: items.map((item) => mapCartItemToItem(item)).filter(Boolean),
      value: items.reduce((s, i) => s + (i.unitPrice || 0) * i.quantity, 0),
      coupon: appliedCoupon?.code,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items]);

  const recalculate = async (department) => {
    if (items.length === 0) return;
    try {
      const data = await calculateCheckout(toApiItems(), department);
      setTotals(data.totals);
      setQuoteItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setTotals(null);
      setQuoteItems([]);
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

          if (!hasPurchaseBeenTracked(nequiPending.orderNumber)) {
            trackPurchase({
              transactionId: nequiPending.orderNumber,
              value: nequiPending.total,
              items: nequiPending.trackedItems,
              coupon: nequiPending.couponCode || undefined,
              shipping: nequiPending.shipping,
              tax: nequiPending.iva,
            });
            markPurchaseTracked(nequiPending.orderNumber);
          }

          // Sin datos personales en la URL (H-06): la confirmación consulta
          // el pedido al servidor con el token de acceso.
          router.push(confirmationPath(nequiPending.orderNumber));
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

  // add_shipping_info se dispara al salir del paso 2 (Entrega, donde se
  // elige el transportador = shipping_tier); add_payment_info al salir del
  // paso 3 (Pago, donde ya está seleccionado el método real).
  const handleContinue = () => {
    const checkoutItems = items.map((item) => mapCartItemToItem(item)).filter(Boolean);
    const checkoutValue = totals
      ? totals.total - (appliedCoupon?.discountAmount || 0)
      : undefined;

    if (step === 2) {
      trackAddShippingInfo({
        items: checkoutItems,
        value: checkoutValue,
        shippingTier: carrier,
      });
    }
    if (step === 3) {
      trackAddPaymentInfo({
        items: checkoutItems,
        value: checkoutValue,
        paymentType: paymentMethod,
      });
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    // Capturado antes de clearCart() — se usa para construir los items del
    // evento purchase (el carrito se vacía justo después de crear el pedido,
    // antes de llegar a la pantalla de confirmación).
    const cartItemsSnapshot = items.map((item) => mapCartItemToItem(item)).filter(Boolean);
    const purchasedProductIds = [
      ...new Set(items.map((item) => String(item.productId || "")).filter(Boolean)),
    ];
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
        privacyAuthorization: privacyAuthorization === true,
        termsAccepted: termsAccepted === true,
      });

      // Token de acceso a la confirmación (H-06). Se guarda antes de
      // cualquier redirección, incluida la de Wompi.
      saveOrderAccess(data.order.orderNumber, data.accessToken);

      clearCart();
      clearCoupon();
      removePurchasedFromFavorites(purchasedProductIds);
      setSuccess(data.order);

      // Wompi: redirigir al checkout externo
      if (data.paymentUrl) {
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
          subtotal:    totals?.subtotal ?? data.order.total,
          discount:    appliedCoupon?.discountAmount || 0,
          couponCode:  appliedCoupon?.code || "",
          iva:         totals?.taxTotal ?? 0,
          ivaPercent:  totals?.ivaPercent ?? 0,
          shipping:    totals?.shippingCost ?? 0,
          freeShipping: totals?.freeShippingApplied ? "1" : "0",
          trackedItems: cartItemsSnapshot,
        });
        return;
      }

      // Otros métodos: ir directo a confirmación

      // purchase solo para contra_entrega: el pedido queda confirmado y
      // comprometido de inmediato (stock descontado) aunque el cobro sea
      // después, en la entrega. nequi_manual NO dispara purchase aquí: el
      // pago ni siquiera se ha intentado (orderStatus queda "pago_pendiente"
      // hasta que el cliente envíe comprobante y un admin lo apruebe).
      if (
        data.order.paymentMethod === "contra_entrega" &&
        !hasPurchaseBeenTracked(data.order.orderNumber)
      ) {
        trackPurchase({
          transactionId: data.order.orderNumber,
          value: data.order.total,
          items: cartItemsSnapshot,
          coupon: appliedCoupon?.code,
          shipping: totals?.shippingCost,
          tax: totals?.taxTotal,
        });
        markPurchaseTracked(data.order.orderNumber);
      }

      // Solo el número de pedido en la URL (H-06); el resto lo devuelve el
      // servidor a quien tenga el token o sea el dueño autenticado.
      router.push(confirmationPath(data.order.orderNumber));
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

          {/* Resumen del pedido antes de confirmar (H-19): productos,
              cantidades, precio unitario y subtotal por línea, calculados
              por el servidor. Se puede corregir volviendo atrás o al carrito. */}
          <table className="checkout-summary-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Precio unitario</th>
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {quoteItems.map((it) => (
                <tr key={`${it.productId}-${it.variantId}`}>
                  <td>
                    {it.productName}
                    {[it.sizeName, it.colorName].filter(Boolean).length > 0 && (
                      <> · {[it.sizeName, it.colorName].filter(Boolean).join(" · ")}</>
                    )}
                  </td>
                  <td className="num">{it.quantity}</td>
                  <td className="num">{formatCOP(it.unitPrice)}</td>
                  <td className="num">{formatCOP(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="no-print" style={{ fontSize: "0.85rem", margin: "0 0 1rem" }}>
            ¿Algo no está bien? Usa el botón Atrás o{" "}
            <Link href="/carrito">vuelve al carrito</Link> para corregir.{" "}
            <button
              type="button"
              className="checkout-btn"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
              onClick={() => window.print()}
            >
              Imprimir resumen
            </button>
          </p>
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
          {/* Plazo de entrega: solo cuando el negocio lo haya definido
              (config/deliveryTerms.js). Mientras tanto no se promete nada. */}
          {config.deliveryTerms?.text && (
            <div className="checkout-review-item">
              <span>Plazo de entrega</span>
              <span>{config.deliveryTerms.text}</span>
            </div>
          )}
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
                <span>Envío</span>
                <span>
                  {totals.shippingIncluded
                    ? "Incluido en el precio"
                    : totals.shippingCost === 0
                      ? "Sin costo"
                      : formatCOP(totals.shippingCost)}
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
          <ConsentCheckbox
            notices={notices}
            noticesError={noticesError}
            purpose="order_processing"
            checked={privacyAuthorization}
            onChange={setPrivacyAuthorization}
          />
          <ConsentCheckbox
            notices={notices}
            noticesError={noticesError}
            purpose="terms"
            checked={termsAccepted}
            onChange={setTermsAccepted}
          />
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
            onClick={handleContinue}
          >
            Continuar
          </button>
        ) : (
          <button
            type="button"
            className="checkout-btn checkout-btn--primary"
            disabled={
              loading ||
              !totals ||
              !privacyNoticeReady ||
              !privacyAuthorization ||
              !termsNoticeReady ||
              !termsAccepted
            }
            onClick={handleSubmit}
          >
            {loading ? "Procesando..." : "Confirmar pedido"}
          </button>
        )}
      </div>
    </div>
  );
}
