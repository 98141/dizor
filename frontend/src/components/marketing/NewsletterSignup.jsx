"use client";

import { useState } from "react";
import {
  subscribeNewsletter,
  marketingError,
} from "@/services/marketingService";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";

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
  // Autorización comercial expresa (H-04): desmarcada por defecto y
  // obligatoria solo para este formulario, cuyo único fin es la suscripción.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!marketingConsent) {
      setStatus("error");
      setMessage("Marca la casilla para confirmar que quieres recibir correos.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const data = await subscribeNewsletter({
        email,
        name,
        source,
        marketingConsent: marketingConsent === true,
      });
      setStatus("success");
      setMessage(data.message || successMessage);
      setEmail("");
      setName("");
      setMarketingConsent(false);
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
          disabled={
            status === "loading" ||
            !isNoticeReady(notices, "marketing_newsletter") ||
            !marketingConsent
          }
        >
          {status === "loading" ? "Enviando…" : "Suscribirme"}
        </button>
      </form>
      <ConsentCheckbox
        notices={notices}
        noticesError={noticesError}
        purpose="marketing_newsletter"
        checked={marketingConsent}
        onChange={setMarketingConsent}
        id={`consent-newsletter-${source}`}
        compact
      />
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
