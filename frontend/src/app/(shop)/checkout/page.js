"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import MunicipalityCombobox from "@/components/checkout/MunicipalityCombobox";
import { findMunicipality } from "@/lib/municipalities";
import { getCheckoutConfig, calculateCheckout, createOrder } from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";
import { validateCheckout } from "@/lib/checkoutValidation";
import { trackAddPaymentInfo, trackAddShippingInfo, trackBeginCheckout, trackPurchase } from "@/lib/analytics/events";
import { mapCartItemToItem } from "@/lib/analytics/productMapper";
import { hasPurchaseBeenTracked, markPurchaseTracked } from "@/lib/analytics/purchaseDedup";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";
import { saveOrderAccess, confirmationPath } from "@/lib/orderAccess";
import TrackedWhatsAppLink from "@/components/layout/TrackedWhatsAppLink";
import { getWhatsAppUrl } from "@/lib/whatsapp";

const STAFF_ROLES = ["superadmin", "admin", "vendedor"];
const ROLE_LABELS = { superadmin: "Super Admin", admin: "Administrador", vendedor: "Vendedor" };

export default function CheckoutPage() {
  const { user, loadingAuth } = useAuth();
  if (loadingAuth) return <p className="auth-loading">Preparando checkout...</p>;
  return <CheckoutForm key={user?.id || user?._id || "guest"} />;
}

function CheckoutForm() {
  const router = useRouter();
  const { items, hydrated, toApiItems, clearCart, appliedCoupon, clearCoupon } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { removePurchasedFromFavorites } = useFavorites();
  // La misma clave se conserva al reintentar. El servidor verifica su huella.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const submittingRef = useRef(false);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [buyer, setBuyer] = useState(() => ({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "" }));
  const [shipping, setShipping] = useState(() => {
    const saved = user?.shippingAddresses || [];
    const address = saved.find((a) => a.isDefault) || saved[0];
    return address
      ? { address: address.address, city: address.city, department: address.department, postalCode: address.postalCode || "" }
      : { address: "", city: "", department: "", postalCode: "" };
  });
  const [addressRevision, setAddressRevision] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("contra_entrega");
  const [customerNotes, setCustomerNotes] = useState("");
  const [privacyAuthorization, setPrivacyAuthorization] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();
  const privacyNoticeReady = isNoticeReady(notices, "order_processing");
  const termsNoticeReady = isNoticeReady(notices, "terms");
  const quoteLoading = !quote || quote.sourceItems !== items || quote.department !== shipping.department || quote.revision !== quoteRevision;
  const totals = quoteLoading ? null : quote.data?.totals;
  const quoteItems = quoteLoading ? [] : quote.data?.items || [];
  const quoteError = quoteLoading ? "" : quote.error;
  const selectedMunicipality = findMunicipality(config?.municipalities || [], shipping.city, shipping.department);
  const finalTotal = totals ? totals.total - (appliedCoupon?.discountAmount || 0) : 0;

  useEffect(() => {
    let active = true;
    getCheckoutConfig().then(({ config: cfg }) => {
      if (!active) return;
      // El checkout público solo ofrece estos dos medios.
      const paymentMethods = (cfg.paymentMethods || []).filter((m) => ["wompi", "contra_entrega"].includes(m.id));
      setConfig({ ...cfg, paymentMethods });
      setPaymentMethod((current) => paymentMethods.some((m) => m.id === current) ? current : paymentMethods[0]?.id || "");
    }).catch(() => { if (active) setConfigError("No se pudo preparar la compra. Recarga la página para reintentar."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated && !items.length && !success) router.replace("/carrito");
  }, [hydrated, items, router, success]);

  const beginCheckoutFiredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !items.length || beginCheckoutFiredRef.current) return;
    beginCheckoutFiredRef.current = true;
    trackBeginCheckout({ items: items.map((item) => mapCartItemToItem(item)).filter(Boolean),
      value: items.reduce((sum, item) => sum + (item.unitPrice || 0) * item.quantity, 0), coupon: appliedCoupon?.code });
  }, [hydrated, items, appliedCoupon?.code]);

  useEffect(() => {
    let active = true;
    if (!hydrated || !items.length) return;
    // Una respuesta antigua nunca sustituye el resumen de una dirección/carrito nuevos.
    calculateCheckout(toApiItems(), shipping.department).then((data) => {
      if (!active) return;
      setQuote({ sourceItems: items, department: shipping.department, revision: quoteRevision, data, error: "" });
    }).catch((err) => {
      if (!active) return;
      setQuote({ sourceItems: items, department: shipping.department, revision: quoteRevision, data: null,
        error: err.response?.data?.message || "No se pudo actualizar el resumen del pedido." });
    });
    return () => { active = false; };
  }, [hydrated, items, shipping.department, toApiItems, quoteRevision]);

  const clearFieldError = (name) => setFieldErrors((current) => ({ ...current, [name]: "" }));
  const handleBuyerChange = (e) => {
    setBuyer((current) => ({ ...current, [e.target.name]: e.target.value }));
    clearFieldError(e.target.name);
  };
  const handleShippingChange = (e) => {
    setShipping((current) => ({ ...current, [e.target.name]: e.target.value }));
    clearFieldError(e.target.name);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const errors = validateCheckout({ buyer, shipping, paymentMethod, methods: config.paymentMethods,
      municipalities: config.municipalities, privacyAuthorization, termsAccepted });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }
    if (!totals || quoteLoading || !privacyNoticeReady || !termsNoticeReady) return;
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
      trackAddShippingInfo({ items: cartItemsSnapshot, value: finalTotal, shippingTier: "Envío incluido" });
      trackAddPaymentInfo({ items: cartItemsSnapshot, value: finalTotal, paymentType: paymentMethod });
      const data = await createOrder({
        items:           toApiItems(),
        buyer,
        shippingAddress: { ...shipping, city: selectedMunicipality.city, department: selectedMunicipality.department },
        paymentMethod,
        customerNotes,
        couponCode:      appliedCoupon?.code || null,
        idempotencyKey,
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

      // Contraentrega confirma el compromiso de compra; el recaudo ocurre después.
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

  const isStaff = user && STAFF_ROLES.includes(user.role);
  if (configError) return <div className="checkout-page"><AuthErrorAlert message={configError} /><Link href="/carrito">Volver al carrito</Link></div>;
  if (!hydrated || !config) return <p className="auth-loading">Preparando checkout...</p>;
  if (isStaff) return (
    <div className="checkout-page">
      <h1 className="checkout-page__title">Checkout</h1>
      <div className="checkout-staff-notice">
        <h2 className="checkout-staff-notice__title">Cuenta de personal — compras no disponibles</h2>
        <p>Estás navegando como <strong>{ROLE_LABELS[user.role]}</strong>. Para hacer un pedido, inicia sesión con una cuenta de cliente o compra como invitado.</p>
        <Link href="/carrito">Volver al carrito</Link>
      </div>
    </div>
  );

  return (
    <div className="checkout-surface">
    <div className="checkout-page checkout-page--single">
      <h1 className="checkout-page__title">Finaliza tu compra</h1>
      {!isAuthenticated && <p className="checkout-intro">Compra como invitado. <Link href="/login">Inicia sesión</Link> para guardar tu historial.</p>}
      <form className="checkout-layout" noValidate onSubmit={handleSubmit} aria-busy={loading}>
        <fieldset className="checkout-fields" disabled={loading || Boolean(success)}>
          <legend className="sr-only">Datos para tu compra</legend>
          <section className="checkout-card" aria-labelledby="contact-title">
            <h2 id="contact-title">Datos de contacto</h2>
            <div className="checkout-form">
              <AuthFormField label="Nombre completo" name="name" value={buyer.name} onChange={handleBuyerChange} error={fieldErrors.name} autoComplete="name" required />
              <AuthFormField label="Correo electrónico" name="email" type="email" value={buyer.email} onChange={handleBuyerChange} error={fieldErrors.email} autoComplete="email" required />
              <AuthFormField label="Teléfono / WhatsApp" name="phone" type="tel" value={buyer.phone} onChange={handleBuyerChange} error={fieldErrors.phone} autoComplete="tel" required />
            </div>
          </section>
          <section className="checkout-card" aria-labelledby="shipping-title">
            <h2 id="shipping-title">Dirección de envío</h2>
            <p className="checkout-hint">Entrega en Colombia · Envío incluido</p>
            <div className="checkout-form">
              {isAuthenticated && user?.shippingAddresses?.length > 0 && (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="savedAddress">Dirección guardada</label>
                  <select id="savedAddress" className="auth-field__input" defaultValue="" onChange={(e) => {
                    const address = user.shippingAddresses.find((a) => String(a.id || a._id) === e.target.value);
                    if (!address) return;
                    setShipping({ address: address.address, city: address.city, department: address.department, postalCode: address.postalCode || "" });
                    setAddressRevision((current) => current + 1);
                    setFieldErrors((current) => ({ ...current, address: "", municipality: "" }));
                  }}>
                    <option value="">Escribir otra dirección</option>
                    {user.shippingAddresses.map((a) => <option key={a.id || a._id} value={a.id || a._id}>{a.label} — {a.address}, {a.city}</option>)}
                  </select>
                </div>
              )}
              <AuthFormField label="Dirección" name="address" value={shipping.address} onChange={handleShippingChange} error={fieldErrors.address} autoComplete="street-address" required />
              <MunicipalityCombobox key={addressRevision} options={config.municipalities} selected={selectedMunicipality}
                initialText={shipping.city} error={fieldErrors.municipality} onChange={(entry) => {
                  setShipping((current) => ({ ...current, city: entry?.city || "", department: entry?.department || "" }));
                  clearFieldError("municipality");
                }} />
              <AuthFormField label="Código postal (opcional)" name="postalCode" value={shipping.postalCode} onChange={handleShippingChange} autoComplete="postal-code" />
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="notes">Notas del pedido (opcional)</label>
                <textarea id="notes" className="auth-field__input" rows={3} placeholder="Instrucciones de entrega, personalización..." value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
              </div>
              {config.deliveryTerms?.text && <p className="checkout-hint">{config.deliveryTerms.text}</p>}
            </div>
          </section>
          <section className="checkout-card" aria-labelledby="payment-title">
            <h2 id="payment-title">Medio de pago</h2>
            <div id="payment" className="checkout-form" role="radiogroup" aria-labelledby="payment-title" tabIndex={-1} aria-invalid={Boolean(fieldErrors.payment)} aria-describedby={fieldErrors.payment ? "payment-error" : undefined}>
              {config.paymentMethods.map((pm) => (
                <label key={pm.id} className={`checkout-payment-option${paymentMethod === pm.id ? " checkout-payment-option--active" : ""}`}>
                  <input type="radio" name="payment" value={pm.id} checked={paymentMethod === pm.id} onChange={() => { setPaymentMethod(pm.id); clearFieldError("payment"); }} />
                  <span><span className="checkout-payment-option__title">{pm.label}</span><span className="checkout-payment-option__desc">{pm.description}</span></span>
                </label>
              ))}
              {fieldErrors.payment && <span id="payment-error" className="auth-field__error">{fieldErrors.payment}</span>}
            </div>
            {paymentMethod === "wompi" && <p className="checkout-hint">Al confirmar, irás a Wompi para completar el pago y luego volverás a DIZOR.</p>}
          </section>
        </fieldset>
        <aside className="checkout-card checkout-summary" aria-labelledby="summary-title">
          <h2 id="summary-title">Resumen del pedido</h2>
          {quoteLoading && <p role="status">Actualizando resumen...</p>}
          <AuthErrorAlert message={quoteError} autoHide={false} />
          {quoteError && <button type="button" className="checkout-btn" onClick={() => setQuoteRevision((n) => n + 1)}>Actualizar resumen</button>}
          <ul className="checkout-products">
            {quoteItems.map((item) => (
              <li key={`${item.productId}-${item.variantId}`}>
                <div><strong>{item.productName}</strong><span>{[item.sizeName, item.colorName].filter(Boolean).join(" · ")}</span><span>Cantidad: {item.quantity} · {formatCOP(item.unitPrice)} c/u</span></div>
                <strong>{formatCOP(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>
          {totals && <>
            <div className="checkout-review-item"><span>Subtotal</span><span>{formatCOP(totals.subtotal)}</span></div>
            {appliedCoupon && <div className="checkout-review-item"><span>Cupón ({appliedCoupon.code})</span><span>−{formatCOP(appliedCoupon.discountAmount)}</span></div>}
            {totals.ivaEnabled && totals.taxTotal > 0 && <div className="checkout-review-item"><span>IVA ({totals.ivaPercent}%)</span><span>{formatCOP(totals.taxTotal)}</span></div>}
            <p className="checkout-hint">Envío incluido</p>
          </>}
          <fieldset className="checkout-consents" disabled={loading || Boolean(success)}>
            <legend className="sr-only">Autorizaciones de compra</legend>
            <ConsentCheckbox notices={notices} noticesError={noticesError} purpose="order_processing" checked={privacyAuthorization} onChange={(checked) => { setPrivacyAuthorization(checked); clearFieldError("consent-order_processing"); }} />
            {fieldErrors["consent-order_processing"] && <p className="auth-field__error" role="alert">{fieldErrors["consent-order_processing"]}</p>}
            <ConsentCheckbox notices={notices} noticesError={noticesError} purpose="terms" checked={termsAccepted} onChange={(checked) => { setTermsAccepted(checked); clearFieldError("consent-terms"); }} />
            {fieldErrors["consent-terms"] && <p className="auth-field__error" role="alert">{fieldErrors["consent-terms"]}</p>}
          </fieldset>
          <AuthErrorAlert message={error} autoHide={false} />
          <div className="checkout-final">
            <div className="checkout-review-item checkout-total" aria-live="polite"><span>Total (COP)</span><strong>{totals && !quoteLoading ? formatCOP(finalTotal) : "Calculando..."}</strong></div>
            <button type="submit" className="checkout-btn checkout-btn--primary" disabled={loading || Boolean(success) || quoteLoading || !totals || !privacyNoticeReady || !termsNoticeReady}>
              {loading || success ? "Procesando..." : paymentMethod === "wompi" ? "Ir a pagar con Wompi" : "Confirmar pedido contraentrega"}
            </button>
            <div className="checkout-secondary-actions">
              <Link href="/carrito">Volver al carrito</Link>
              <TrackedWhatsAppLink href={getWhatsAppUrl()} linkLocation="checkout_help" purpose="checkout_inquiry">
                Ayuda por WhatsApp
              </TrackedWhatsAppLink>
            </div>
          </div>
        </aside>
      </form>
    </div>
    </div>
  );
}
