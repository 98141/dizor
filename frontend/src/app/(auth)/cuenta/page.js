"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/guards/ProtectedRoute";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import {
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/validators/authSchemas";

function CuentaContent() {
  const router = useRouter();
  const { user, logout, updatePassword } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    password: "",
    passwordConfirm: "",
  });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdMessage, setPwdMessage] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handlePwdChange = (e) => {
    const { name, value } = e.target;
    setPwdForm((prev) => ({ ...prev, [name]: value }));
    setPwdErrors((prev) => ({ ...prev, [name]: null }));
    setPwdMessage("");
    setPwdSuccess(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    const next = {
      currentPassword: !pwdForm.currentPassword
        ? "La contraseña actual es obligatoria"
        : null,
      password: validatePassword(pwdForm.password),
      passwordConfirm: validatePasswordConfirm(
        pwdForm.password,
        pwdForm.passwordConfirm
      ),
    };
    setPwdErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setPwdLoading(true);
    try {
      await updatePassword(pwdForm);
      setPwdSuccess(true);
      setPwdMessage("Contraseña actualizada correctamente.");
      setPwdForm({
        currentPassword: "",
        password: "",
        passwordConfirm: "",
      });
      setShowPasswordForm(false);
    } catch (error) {
      setPwdMessage(
        error.response?.data?.message || "No se pudo actualizar la contraseña."
      );
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="cuenta-page">
        <h1 className="cuenta-page__title">Mi cuenta</h1>

        <div className="cuenta-card">
          <div className="cuenta-card__row">
            <span className="cuenta-card__label">Nombre</span>
            <span>{user.name}</span>
          </div>
          <div className="cuenta-card__row">
            <span className="cuenta-card__label">Correo</span>
            <span>{user.email}</span>
          </div>
          <div className="cuenta-card__row">
            <span className="cuenta-card__label">Teléfono</span>
            <span>{user.phone || "—"}</span>
          </div>
          <div className="cuenta-card__row">
            <span className="cuenta-card__label">Rol</span>
            <span>{user.role}</span>
          </div>
        </div>

        <div className="cuenta-links">
          {["superadmin", "admin"].includes(user.role) && (
            <Link href="/admin">Panel administrativo</Link>
          )}
          {["superadmin", "admin", "vendedor"].includes(user.role) && (
            <Link href="/vendedor">Panel vendedor</Link>
          )}
        </div>

        <div className="cuenta-card" style={{ marginBottom: "var(--space-lg)" }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.125rem",
              margin: "0 0 var(--space-md)",
            }}
          >
            Seguridad
          </h2>
          {!showPasswordForm ? (
            <button
              type="button"
              className="cuenta-logout"
              onClick={() => setShowPasswordForm(true)}
            >
              Cambiar contraseña
            </button>
          ) : (
            <form className="auth-form" onSubmit={handleUpdatePassword}>
              <AuthFormField
                label="Contraseña actual"
                name="currentPassword"
                type="password"
                value={pwdForm.currentPassword}
                onChange={handlePwdChange}
                error={pwdErrors.currentPassword}
                autoComplete="current-password"
              />
              <AuthFormField
                label="Nueva contraseña"
                name="password"
                type="password"
                value={pwdForm.password}
                onChange={handlePwdChange}
                error={pwdErrors.password}
                autoComplete="new-password"
              />
              <AuthFormField
                label="Confirmar nueva contraseña"
                name="passwordConfirm"
                type="password"
                value={pwdForm.passwordConfirm}
                onChange={handlePwdChange}
                error={pwdErrors.passwordConfirm}
                autoComplete="new-password"
              />
              <AuthErrorAlert
                message={pwdMessage}
                variant={pwdSuccess ? "success" : "error"}
              />
              <AuthSubmitButton loading={pwdLoading}>
                Guardar contraseña
              </AuthSubmitButton>
              <button
                type="button"
                className="cuenta-logout"
                onClick={() => setShowPasswordForm(false)}
              >
                Cancelar
              </button>
            </form>
          )}
        </div>

        <button type="button" className="cuenta-logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function CuentaPage() {
  return (
    <ProtectedRoute>
      <CuentaContent />
    </ProtectedRoute>
  );
}
