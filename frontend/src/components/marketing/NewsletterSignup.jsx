"use client";

import { useState } from "react";
import {
  subscribeNewsletter,
  marketingError,
} from "@/services/marketingService";

export default function NewsletterSignup({
  title = "Newsletter Dizor prueba",
  description = "Recibe lanzamientos y ofertas.",
  successMessage = "¡Gracias! Te hemos suscrito.",
  source = "footer",
  compact = false,
  onSuccess,
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const data = await subscribeNewsletter({ email, name, source });
      setStatus("success");
      setMessage(data.message || successMessage);
      setEmail("");
      setName("");
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setMessage(marketingError(err, "No se pudo completar la suscripción"));
    }
  };

  return (
    <div className={`newsletter${compact ? " newsletter--compact" : ""}`}>
      {title ? <h3 className="newsletter__title">{title}</h3> : null}
      {description ? <p className="newsletter__text">{description}</p> : null}
      <form className="newsletter__form" onSubmit={handleSubmit}>
        {!compact && (
          <input
            type="text"
            className="newsletter__input"
            placeholder="Tu nombre (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          type="email"
          className="newsletter__input"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <button
          type="submit"
          className="newsletter__btn"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Enviando…" : "Suscribirme"}
        </button>
      </form>
      {message && (
        <p
          className={`newsletter__feedback${status === "error" ? " newsletter__feedback--error" : ""}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
