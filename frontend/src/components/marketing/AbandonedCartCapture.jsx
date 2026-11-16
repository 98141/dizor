"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { saveAbandonedCart } from "@/services/marketingService";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";

// Recordatorio de carrito por correo: solo si el titular lo pide
// expresamente (H-05). Se mantiene oculto para usuarios registrados, como
// antes; a ellos ya no se les inscribe automáticamente. Ofrecerles la
// opción es una decisión de negocio pendiente (E-5).
export default function AbandonedCartCapture() {
  const { items, toApiItems } = useCart();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  if (items.length === 0) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    const target = email.trim();
    if (!target || !marketingConsent) return;
    setStatus("loading");
    try {
      await saveAbandonedCart({
        email: target,
        name: "",
        items: toApiItems(),
        marketingConsent: marketingConsent === true,
      });
      setStatus("success");
      setMessage("Listo. Te enviaremos un recordatorio si no completas la compra.");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "No se pudo guardar");
    }
  };

  if (user?.email) return null;

  if (status === "success") {
    return (
      <div className="abandoned-cart-capture">
        <p className="abandoned-cart-capture__msg">{message}</p>
      </div>
    );
  }

  return (
    <div className="abandoned-cart-capture">
      <p className="abandoned-cart-capture__label">
        ¿Quieres que te recordemos este carrito por correo?
      </p>
      <form className="abandoned-cart-capture__form" onSubmit={handleSave}>
        <input
          type="email"
          className="abandoned-cart-capture__input"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="abandoned-cart-capture__btn"
          disabled={
            status === "loading" ||
            !isNoticeReady(notices, "marketing_cart_reminder") ||
            !marketingConsent
          }
        >
          Guardar
        </button>
      </form>
      <ConsentCheckbox
        notices={notices}
        noticesError={noticesError}
        purpose="marketing_cart_reminder"
        checked={marketingConsent}
        onChange={setMarketingConsent}
        compact
      />
      {message && (
        <p
          className={`abandoned-cart-capture__msg${status === "error" ? " abandoned-cart-capture__msg--error" : ""}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
