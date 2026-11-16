"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { unsubscribeMarketing } from "@/services/marketingService";

// Baja de comunicaciones comerciales sin iniciar sesión (H-04, H-05).
// El enlace del correo trae un token firmado (sin datos personales). La baja
// se confirma con un botón (POST) para que los escáneres automáticos de
// enlaces de los clientes de correo no la ejecuten sin la persona.
export default function BajaPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura del token tras hidratar
    setToken(t);
    if (t) window.history.replaceState(window.history.state, "", "/baja");
  }, []);

  const confirm = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const data = await unsubscribeMarketing(token);
      setStatus("done");
      setMessage(data.message);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "No se pudo procesar la baja.");
    }
  };

  return (
    <div className="checkout-page" style={{ maxWidth: 560 }}>
      <h1 className="checkout-page__title">Darme de baja</h1>
      {!token && status === "idle" ? (
        <p>
          Este enlace no es válido. Usa el enlace “Darme de baja” incluido en
          el correo que recibiste.
        </p>
      ) : status === "done" ? (
        <p>{message}</p>
      ) : (
        <>
          <p>
            Confirma que no quieres recibir más correos de este tipo. Los
            mensajes sobre tus pedidos (confirmación, envío) no se ven
            afectados.
          </p>
          <button
            type="button"
            className="checkout-btn checkout-btn--primary"
            onClick={confirm}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Procesando…" : "Confirmar baja"}
          </button>
          {status === "error" && (
            <p style={{ color: "var(--color-error)", marginTop: "0.75rem" }}>{message}</p>
          )}
        </>
      )}
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/">Volver al inicio</Link>
      </p>
    </div>
  );
}
