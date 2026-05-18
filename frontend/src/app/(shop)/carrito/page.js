"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { validateCart } from "@/services/cartService";
import { formatCOP } from "@/lib/formatCurrency";

export default function CarritoPage() {
  const { items, hydrated, itemCount, updateQuantity, removeItem, toApiItems } =
    useCart();
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);

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
          shippingCost: data.shippingCost,
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

  return (
    <div className="cart-page">
      <h1 className="cart-page__title">Tu carrito ({itemCount})</h1>

      <div className="cart-layout">
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
                    {item.sizeName} · {item.colorName} · {item.sku}
                  </p>
                  <div className="cart-item__row">
                    <div className="cart-qty">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.variantId,
                            qty - 1
                          )
                        }
                        aria-label="Reducir cantidad"
                      >
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            item.variantId,
                            qty + 1
                          )
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
                    onClick={() =>
                      removeItem(item.productId, item.variantId)
                    }
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary">
          <h2 className="cart-summary__title">Resumen</h2>
          {loading ? (
            <p>Calculando...</p>
          ) : (
            <>
              <div className="cart-summary__row">
                <span>Subtotal</span>
                <span>{formatCOP(totals?.subtotal)}</span>
              </div>
              <div className="cart-summary__row">
                <span>Envío estimado</span>
                <span>
                  {totals?.shippingCost === 0
                    ? "Gratis"
                    : formatCOP(totals?.shippingCost)}
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                Envío final según departamento en checkout
              </p>
              <Link href="/checkout" className="cart-summary__cta">
                Ir a checkout
              </Link>
              <Link href="/catalogo" className="cart-summary__cta cart-summary__cta--secondary">
                Seguir comprando
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
