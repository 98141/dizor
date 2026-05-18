"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import {
  getCheckoutConfig,
  calculateCheckout,
  createOrder,
} from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";

const STEPS = ["Datos", "Envío", "Entrega", "Pago", "Confirmar"];

const CARRIER_LABELS = {
  interrapidisimo: "Interrapidísimo",
  envia: "Envía",
  coordinadora: "Coordinadora",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, hydrated, toApiItems, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const [buyer, setBuyer] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [shipping, setShipping] = useState({
    address: "",
    city: "",
    department: "Nariño",
    postalCode: "",
  });

  const [carrier, setCarrier] = useState("interrapidisimo");
  const [paymentMethod, setPaymentMethod] = useState("contra_entrega");
  const [customerNotes, setCustomerNotes] = useState("");

  useEffect(() => {
    if (user) {
      setBuyer({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });

      const saved = user.shippingAddresses || [];
      if (saved.length > 0) {
        const defaultAddr =
          saved.find((a) => a.isDefault) || saved[0];
        setShipping({
          address: defaultAddr.address,
          city: defaultAddr.city,
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
    if (items.length === 0 && !success) {
      router.replace("/carrito");
    }
  }, [hydrated, items, router, success]);

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
    if (shipping.department) {
      recalculate(shipping.department);
    }
  }, [items, shipping.department]);

  const handleBuyerChange = (e) => {
    setBuyer((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleShippingChange = (e) => {
    setShipping((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const canNext = () => {
    if (step === 0) {
      return buyer.name && buyer.email && buyer.phone;
    }
    if (step === 1) {
      return shipping.address && shipping.city && shipping.department;
    }
    if (step === 2) {
      return !!carrier;
    }
    if (step === 3) {
      return !!paymentMethod;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await createOrder({
        items: toApiItems(),
        buyer,
        shippingAddress: shipping,
        paymentMethod,
        carrier,
        customerNotes,
      });
      clearCart();
      setSuccess(data.order);

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      router.push(
        `/pedido/confirmacion?order=${data.order.orderNumber}&total=${data.order.total}&payment=${data.order.paymentMethod}`
      );
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated || !config) {
    return <p className="auth-loading">Preparando checkout...</p>;
  }

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
                      address: addr.address,
                      city: addr.city,
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

      {step === 3 && (
        <div className="checkout-card">
          <h2>Método de pago</h2>
          <div className="checkout-form">
            {config.paymentMethods.map((pm) => (
              <label
                key={pm.id}
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
            ))}
          </div>
        </div>
      )}

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
              {
                config.paymentMethods.find((p) => p.id === paymentMethod)
                  ?.label
              }
            </span>
          </div>
          {totals && (
            <>
              <div className="checkout-review-item">
                <span>Subtotal</span>
                <span>{formatCOP(totals.subtotal)}</span>
              </div>
              <div className="checkout-review-item">
                <span>Envío</span>
                <span>
                  {totals.shippingCost === 0
                    ? "Gratis"
                    : formatCOP(totals.shippingCost)}
                </span>
              </div>
              {totals.taxTotal > 0 && (
                <div className="checkout-review-item">
                  <span>Impuestos</span>
                  <span>{formatCOP(totals.taxTotal)}</span>
                </div>
              )}
              <div
                className="checkout-review-item"
                style={{ fontWeight: 600, fontSize: "1.1rem" }}
              >
                <span>Total</span>
                <span>{formatCOP(totals.total)}</span>
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
