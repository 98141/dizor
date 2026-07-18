"use client";

import { useCallback, useState } from "react";

/** Mensajes flash para toast (fuerza reaparición aunque el texto sea igual). */
export function useFlashMessage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  const showMsg = useCallback((text, isError = false) => {
    setError(Boolean(isError));
    setMessage(text || "");
    setFlashKey((k) => k + 1);
  }, []);

  const clearMsg = useCallback(() => {
    setMessage("");
  }, []);

  return { message, error, flashKey, showMsg, clearMsg, setMessage, setError };
}
