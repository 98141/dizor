"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import { validateEmail, validatePassword } from "@/lib/validators/authSchemas";
import { getAuthRedirect } from "@/lib/auth/getAuthRedirect";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
    setMessage("");
  };

  const validateForm = () => {
    const next = {
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setMessage("");

    try {
      const data = await login(form);
      router.push(getAuthRedirect(data.user.role));
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Error al iniciar sesión."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Accede a tu cuenta Dizor"
      footerText="¿No tienes cuenta?"
      footerLinkText="Regístrate"
      footerHref="/register"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthFormField
          label="Correo electrónico"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="tu@correo.com"
          autoComplete="email"
        />
        <AuthFormField
          label="Contraseña"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <p style={{ textAlign: "right", margin: 0 }}>
          <Link
            href="/olvide-contrasena"
            style={{
              fontSize: "0.875rem",
              color: "var(--color-primary)",
              textDecoration: "underline",
            }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        <AuthErrorAlert message={message} />
        <AuthSubmitButton loading={loading}>Entrar</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
