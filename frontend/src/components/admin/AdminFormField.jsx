"use client";
import { useId, useState } from "react";

/** Admin-only counterpart of the existing auth field; public forms remain unchanged. */
export default function AdminFormField({ label, name, type = "text", error, hint, required, ...props }) {
  const generated = useId(), id = name || generated;
  const [showPassword, setShowPassword] = useState(false);
  const password = type === "password";
  return <div className="auth-field">
    <label className="auth-field__label" htmlFor={id}>{label}{required && <span className="admin-required"> (obligatorio)</span>}</label>
    <div className={password ? "auth-field__input-wrap" : undefined}>
      <input {...props} id={id} name={name} type={password && showPassword ? "text" : type}
        required={required} aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`auth-field__input${password ? " auth-field__input--pwd" : ""}${error ? " auth-field__input--error" : ""}`} />
      {password && <button className="auth-field__toggle-pwd" type="button" disabled={props.disabled}
        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}
        onClick={() => setShowPassword(v => !v)}>{showPassword ? "Ocultar" : "Ver"}</button>}
    </div>
    {hint && !error && <span id={`${id}-hint`} className="auth-field__hint">{hint}</span>}
    {error && <span id={`${id}-error`} role="alert" className="auth-field__error">{error}</span>}
  </div>;
}
