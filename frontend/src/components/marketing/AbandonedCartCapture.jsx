"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { saveAbandonedCart } from "@/services/marketingService";

export default function AbandonedCartCapture() {
  const { items, toApiItems } = useCart();
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  if (items.length === 0) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      await saveAbandonedCart({
        email: email.trim(),
        name: user?.name || "",
        items: toApiItems(),
      });
      setStatus("success");
      setMessage("Te enviaremos un recordatorio si dejas el carrito.");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "No se pudo guardar");
    }
  };

  if (user?.email) return null;

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
          disabled={status === "loading"}
        >
          Guardar
        </button>
      </form>
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
