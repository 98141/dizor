"use client";

import { useState } from "react";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { forgotPassword } from "@/services/authService";
import { validateEmail } from "@/lib/validators/authSchemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const data = await forgotPassword({ email });
      setSuccess(true);
      setMessage(data.message);
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "No pudimos procesar tu solicitud. Intenta más tarde."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace a tu correo"
      footerText="¿Recordaste tu contraseña?"
      footerLinkText="Volver al login"
      footerHref="/login"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthFormField
          label="Correo electrónico"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
            setMessage("");
          }}
          error={error}
          placeholder="tu@correo.com"
          autoComplete="email"
        />

        <AuthErrorAlert
          message={message}
          variant={success ? "success" : "error"}
        />
        <AuthSubmitButton loading={loading} disabled={success}>
          Enviar enlace
        </AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
