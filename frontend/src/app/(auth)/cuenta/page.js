"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyOrders, cancelOrder } from "@/services/checkoutService";
import { formatCOP } from "@/lib/formatCurrency";
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
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    getMyOrders()
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, []);

  const handleCancelOrder = async (orderId) => {
    if (!confirm("¿Cancelar este pedido?")) return;
    try {
      await cancelOrder(orderId);
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId ? { ...o, orderStatus: "cancelado" } : o
        )
      );
    } catch {
      alert("No se pudo cancelar el pedido");
    }
  };

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

        <div className="cuenta-card" style={{ marginBottom: "var(--space-lg)" }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.125rem",
              margin: "0 0 var(--space-md)",
            }}
          >
            Mis pedidos
          </h2>
          {ordersLoading ? (
            <p>Cargando pedidos...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>
              Aún no tienes pedidos.{" "}
              <Link href="/catalogo">Ir al catálogo</Link>
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {orders.map((order) => (
                <li
                  key={order._id}
                  style={{
                    padding: "0.75rem 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <strong>{order.orderNumber}</strong>
                  <br />
                  <span style={{ fontSize: "0.85rem" }}>
                    {formatCOP(order.total)} · {order.orderStatus}
                  </span>
                  {order.trackingNumber && (
                    <p style={{ fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                      Guía: {order.trackingNumber}
                    </p>
                  )}
                  {!["enviado", "entregado", "cancelado"].includes(
                    order.orderStatus
                  ) && (
                    <button
                      type="button"
                      className="cuenta-logout"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => handleCancelOrder(order._id)}
                    >
                      Cancelar pedido
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: "0.75rem" }}>
            <Link href="/seguimiento">Rastrear pedido</Link>
          </p>
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
