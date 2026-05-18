"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import PasswordStrengthHint from "@/components/auth/PasswordStrengthHint";
import { resetPassword } from "@/services/authService";
import {
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/validators/authSchemas";
import { getAuthRedirect } from "@/lib/auth/getAuthRedirect";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const router = useRouter();
  const { setAuthUser } = useAuth();

  const [form, setForm] = useState({
    password: "",
    passwordConfirm: "",
  });
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
      password: validatePassword(form.password),
      passwordConfirm: validatePasswordConfirm(
        form.password,
        form.passwordConfirm
      ),
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
      const data = await resetPassword(token, {
        password: form.password,
        passwordConfirm: form.passwordConfirm,
      });
      setAuthUser(data.user);
      router.push(getAuthRedirect(data.user.role));
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "El enlace no es válido o ha expirado."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Nueva contraseña"
      subtitle="Elige una contraseña segura para tu cuenta"
      footerText="¿Necesitas ayuda?"
      footerLinkText="Contactar soporte"
      footerHref="/login"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <AuthFormField
            label="Nueva contraseña"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="new-password"
          />
          <PasswordStrengthHint password={form.password} />
        </div>
        <AuthFormField
          label="Confirmar contraseña"
          name="passwordConfirm"
          type="password"
          value={form.passwordConfirm}
          onChange={handleChange}
          error={errors.passwordConfirm}
          autoComplete="new-password"
        />

        <AuthErrorAlert message={message} />
        <AuthSubmitButton loading={loading}>
          Guardar contraseña
        </AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
