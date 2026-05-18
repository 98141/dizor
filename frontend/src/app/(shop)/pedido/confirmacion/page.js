"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatCOP } from "@/lib/formatCurrency";

const PAYMENT_LABELS = {
  wompi: "Wompi (en línea)",
  nequi_manual: "Nequi manual",
  contra_entrega: "Contra entrega",
};

function ConfirmacionContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order");
  const total = params.get("total");
  const payment = params.get("payment");

  if (!orderNumber) {
    return (
      <div className="checkout-success">
        <p>Pedido no encontrado.</p>
        <Link href="/">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="checkout-page checkout-success">
      <h1 className="checkout-page__title">¡Pedido confirmado!</h1>
      <p>Gracias por comprar en Dizor.</p>
      <p className="checkout-success__number">{orderNumber}</p>
      <p>
        Total: <strong>{formatCOP(Number(total))}</strong>
      </p>
      <p style={{ color: "var(--color-text-muted)" }}>
        Método de pago: {PAYMENT_LABELS[payment] || payment}
      </p>
      {payment === "nequi_manual" && (
        <p>
          Envía tu comprobante Nequi por{" "}
          <a href="https://wa.me/573000000000" target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          .
        </p>
      )}
      {payment === "wompi" && (
        <p>La integración de pago Wompi se activará en la siguiente fase.</p>
      )}
      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/seguimiento" className="cart-summary__cta" style={{ maxWidth: 220 }}>
          Rastrear pedido
        </Link>
        <Link href="/catalogo" className="cart-summary__cta cart-summary__cta--secondary" style={{ maxWidth: 220 }}>
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<p className="auth-loading">Cargando...</p>}>
      <ConfirmacionContent />
    </Suspense>
  );
}
