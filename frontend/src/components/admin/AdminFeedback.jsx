"use client";

/** Persistent, in-context feedback. Only confirmed results use the success variant. */
export default function AdminFeedback({ message, variant = "error", id }) {
  if (!message) return null;
  return <div id={id} className={`admin-feedback admin-feedback--${variant}`}
    role={variant === "error" ? "alert" : "status"} aria-atomic="true">
    <strong>{variant === "error" ? "Atención. " : variant === "success" ? "Confirmado. " : "Aviso. "}</strong>
    {message}
  </div>;
}
