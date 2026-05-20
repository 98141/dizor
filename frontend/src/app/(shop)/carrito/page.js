"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { validateCart, validateCoupon } from "@/services/cartService";
import AbandonedCartCapture from "@/components/marketing/AbandonedCartCapture";
import { formatCOP } from "@/lib/formatCurrency";

export default function CarritoPage() {
  const {
    items,
    hydrated,
    itemCount,
    updateQuantity,
    removeItem,
    toApiItems,
    appliedCoupon,
    applyCoupon,
    clearCoupon,
  } = useCart();

  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const couponRef = useRef(null);

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      setTotals(null);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const data = await validateCart(toApiItems());
        setTotals({
          subtotal: data.subtotal,
          taxTotal: data.taxTotal ?? 0,
          taxEnabled: data.taxEnabled ?? false,
          taxRate: data.taxRate ?? 0,
          shippingCost: data.shippingCost,
          total: data.total,
          items: data.items,
        });
      } catch {
        setTotals(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [items, hydrated, toApiItems]);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const data = await validateCoupon(couponInput.trim(), totals?.subtotal || 0);
      applyCoupon(data.coupon);
      setCouponInput("");
    } catch (err) {
      setCouponError(err.response?.data?.message || "Cupón no válido");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    clearCoupon();
    setCouponError("");
    setTimeout(() => couponRef.current?.focus(), 50);
  };

  if (!hydrated) {
    return <p className="auth-loading">Cargando carrito...</p>;
  }

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <h1 className="cart-page__title">Tu carrito</h1>
        <div className="cart-empty">
          <p>Tu carrito está vacío.</p>
          <Link href="/catalogo">Explorar catálogo</Link>
        </div>
      </div>
    );
  }

  const displayItems = totals?.items || items;
  const discount = appliedCoupon?.discountAmount || 0;
  const displayTotal = totals ? totals.subtotal + (totals.taxTotal || 0) + totals.shippingCost - discount : null;

  return (
    <div className="cart-page">
      <h1 className="cart-page__title">Tu carrito ({itemCount})</h1>

      <div className="cart-layout">
        {/* ── Lista de productos ── */}
        <div>
          {displayItems.map((item) => {
            const cartItem = items.find(
              (i) =>
                String(i.productId) === String(item.productId) &&
                String(i.variantId) === String(item.variantId)
            );
            const qty = cartItem?.quantity || item.quantity;

            return (
              <article
                key={`${item.productId}-${item.variantId}`}
                className="cart-item"
              >
                <Link
                  href={`/producto/${item.productSlug}`}
                  className="cart-item__image"
                >
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    sizes="120px"
                    style={{ objectFit: "cover" }}
                  />
                </Link>
                <div>
                  <h2 className="cart-item__name">
                    <Link href={`/producto/${item.productSlug}`}>
                      {item.productName}
                    </Link>
                  </h2>
                  <p className="cart-item__meta">
                    {[item.sizeName, item.colorName, item.sku]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="cart-item__row">
                    <div className="cart-qty">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.variantId, qty - 1)
                        }
                        aria-label="Reducir cantidad"
                      >
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.variantId, qty + 1)
                        }
                        aria-label="Aumentar cantidad"
                      >
                        +
                      </button>
                    </div>
                    <span className="cart-item__price">
                      {formatCOP(item.unitPrice * qty)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cart-item__remove"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Resumen ── */}
        <aside className="cart-summary">
          <h2 className="cart-summary__title">Resumen</h2>

          {loading ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
              Calculando...
            </p>
          ) : (
            <>
              <div className="cart-summary__row">
                <span>Subtotal</span>
                <span>{formatCOP(totals?.subtotal)}</span>
              </div>

              {totals?.taxEnabled && totals?.taxTotal > 0 && (
                <div className="cart-summary__row">
                  <span>IVA ({totals.taxRate}%)</span>
                  <span>{formatCOP(totals.taxTotal)}</span>
                </div>
              )}

              <div className="cart-summary__row">
                <span>Envío estimado</span>
                <span>
                  {totals?.shippingCost === 0
                    ? "Gratis"
                    : formatCOP(totals?.shippingCost)}
                </span>
              </div>

              {/* ── Cupón aplicado ── */}
              {appliedCoupon && (
                <div className="cart-summary__row cart-summary__row--discount">
                  <span>
                    Cupón{" "}
                    <span className="cart-coupon-code">{appliedCoupon.code}</span>
                    <button
                      type="button"
                      className="cart-coupon-remove"
                      onClick={handleRemoveCoupon}
                      aria-label="Quitar cupón"
                    >
                      ×
                    </button>
                  </span>
                  <span>−{formatCOP(discount)}</span>
                </div>
              )}

              {/* ── Total ── */}
              <div className="cart-summary__row cart-summary__row--total">
                <span>Total estimado</span>
                <span>{displayTotal != null ? formatCOP(displayTotal) : "—"}</span>
              </div>

              <p className="cart-summary__note">
                Envío final según departamento en checkout
              </p>

              {/* ── Campo de cupón ── */}
              {!appliedCoupon && (
                <form className="cart-coupon" onSubmit={handleApplyCoupon}>
                  <label className="cart-coupon__label" htmlFor="couponCode">
                    ¿Tienes un cupón?
                  </label>
                  <div className="cart-coupon__row">
                    <input
                      ref={couponRef}
                      id="couponCode"
                      type="text"
                      className="cart-coupon__input"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      placeholder="CÓDIGO"
                      autoComplete="off"
                      maxLength={32}
                    />
                    <button
                      type="submit"
                      className="cart-coupon__btn"
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? "..." : "Aplicar"}
                    </button>
                  </div>
                  {couponError && (
                    <p className="cart-coupon__error">{couponError}</p>
                  )}
                </form>
              )}

              <AbandonedCartCapture />

              <Link href="/checkout" className="cart-summary__cta">
                Ir a checkout
              </Link>
              <Link
                href="/catalogo"
                className="cart-summary__cta cart-summary__cta--secondary"
              >
                Seguir comprando
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
