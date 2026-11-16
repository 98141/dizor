"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import PasswordStrengthHint from "@/components/auth/PasswordStrengthHint";
import {
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/validators/authSchemas";
import { getAuthRedirect } from "@/lib/auth/getAuthRedirect";
import { useSiteConfig } from "@/context/SiteConfigContext";
import ConsentCheckbox, { isNoticeReady } from "@/components/legal/ConsentCheckbox";
import { useLegalNotices } from "@/lib/legalNotices";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { siteName } = useSiteConfig();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // Autorización de tratamiento para la cuenta (H-03). Nunca premarcada.
  const [privacyAuthorization, setPrivacyAuthorization] = useState(false);
  const { notices, error: noticesError } = useLegalNotices();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
    setMessage("");
  };

  const validateForm = () => {
    const next = {
      name: validateName(form.name),
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
      const data = await register({ ...form, privacyAuthorization: privacyAuthorization === true });
      router.push(getAuthRedirect(data.user.role));
    } catch (error) {
      setMessage(error.response?.data?.message || "Error al registrarse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle={`Únete a la comunidad ${siteName}`}
      footerText="¿Ya tienes cuenta?"
      footerLinkText="Inicia sesión"
      footerHref="/login"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthFormField
          label="Nombre completo"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          placeholder="Tu nombre"
          autoComplete="name"
        />
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
        <div className="auth-field">
          <AuthFormField
            label="Contraseña"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="Mínimo 8 caracteres y un número"
            autoComplete="new-password"
          />
          <PasswordStrengthHint password={form.password} />
        </div>
        <AuthFormField
          label="Teléfono (opcional)"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="+57 300 000 0000"
          autoComplete="tel"
        />

        <ConsentCheckbox
          notices={notices}
          noticesError={noticesError}
          purpose="account"
          checked={privacyAuthorization}
          onChange={setPrivacyAuthorization}
        />

        <AuthErrorAlert message={message} />
        <AuthSubmitButton
          loading={loading}
          disabled={!isNoticeReady(notices, "account") || !privacyAuthorization}
        >
          Registrarme
        </AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
