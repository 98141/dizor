"use client";

import { useEffect, useState } from "react";

/**
 * Alerta de éxito/error. Por defecto aparece como toast flotante
 * y se oculta sola a los ~2.5s.
 */
export default function AuthErrorAlert({
  message,
  variant = "error",
  autoHide = true,
  duration = 2500,
}) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);

    if (!autoHide) return undefined;

    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [message, autoHide, duration]);

  if (!message || !visible) return null;

  return (
    <div
      className={`auth-alert auth-alert--${variant} auth-alert--toast`}
      role="alert"
    >
      {message}
    </div>
  );
}
