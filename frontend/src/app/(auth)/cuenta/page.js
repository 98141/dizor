"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyOrders, cancelOrder } from "@/services/checkoutService";
import { getMySpecialRequests } from "@/services/specialRequestService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  getRequestBadgeClass,
} from "@/lib/specialRequestLabels";
import ProtectedRoute from "@/guards/ProtectedRoute";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import AddressBook from "@/components/cuenta/AddressBook";
import {
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/validators/authSchemas";

const TABS = [
  { id: "perfil", label: "Perfil" },
  { id: "pedidos", label: "Pedidos" },
  { id: "solicitudes", label: "Solicitudes" },
  { id: "direcciones", label: "Direcciones" },
  { id: "seguridad", label: "Seguridad" },
];

function CuentaContent() {
  const router = useRouter();
  const { user, logout, updatePassword, updateProfile, loadUser } = useAuth();
  const [tab, setTab] = useState("perfil");
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [addresses, setAddresses] = useState([]);
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
  const [specialRequests, setSpecialRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || "", phone: user.phone || "" });
      setAddresses(user.shippingAddresses || []);
    }
  }, [user]);

  useEffect(() => {
    getMyOrders()
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
    getMySpecialRequests()
      .then((d) => setSpecialRequests(d.requests || []))
      .catch(() => setSpecialRequests([]))
      .finally(() => setRequestsLoading(false));
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

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg("");
    setProfileError(false);
    try {
      await updateProfile(profileForm);
      setProfileMsg("Perfil actualizado");
    } catch (err) {
      setProfileMsg(err.response?.data?.message || "Error al guardar");
      setProfileError(true);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAddressesChange = async (nextAddresses) => {
    setAddresses(nextAddresses);
    await loadUser();
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

        <nav className="cuenta-tabs" aria-label="Secciones de cuenta">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "perfil" && (
          <div className="cuenta-card">
            <form className="auth-form" onSubmit={handleProfileSubmit}>
              <AuthFormField
                label="Nombre"
                name="name"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
              <AuthFormField
                label="Correo"
                name="email"
                value={user.email}
                disabled
              />
              <AuthFormField
                label="Teléfono"
                name="phone"
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <AuthErrorAlert
                message={profileMsg}
                variant={profileError ? "error" : "success"}
              />
              <AuthSubmitButton loading={profileLoading}>
                Guardar perfil
              </AuthSubmitButton>
            </form>
            <div className="cuenta-links">
              {["superadmin", "admin"].includes(user.role) && (
                <Link href="/admin">Panel administrativo</Link>
              )}
              {["superadmin", "admin", "vendedor"].includes(user.role) && (
                <Link href="/vendedor">Panel vendedor</Link>
              )}
            </div>
          </div>
        )}

        {tab === "pedidos" && (
          <div className="cuenta-card">
            {ordersLoading ? (
              <p>Cargando pedidos...</p>
            ) : orders.length === 0 ? (
              <p className="cuenta-muted">
                Aún no tienes pedidos.{" "}
                <Link href="/catalogo">Ir al catálogo</Link>
              </p>
            ) : (
              <ul className="cuenta-orders">
                {orders.map((order) => (
                  <li key={order._id} className="cuenta-orders__item">
                    <strong>{order.orderNumber}</strong>
                    <span>
                      {formatCOP(order.total)} · {order.orderStatus}
                    </span>
                    {order.trackingNumber && (
                      <span className="cuenta-muted">
                        Guía: {order.trackingNumber}
                      </span>
                    )}
                    {!["enviado", "entregado", "cancelado"].includes(
                      order.orderStatus
                    ) && (
                      <button
                        type="button"
                        className="cuenta-logout"
                        onClick={() => handleCancelOrder(order._id)}
                      >
                        Cancelar pedido
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="cuenta-muted">
              <Link href="/seguimiento">Rastrear pedido</Link>
            </p>
          </div>
        )}

        {tab === "solicitudes" && (
          <div className="cuenta-card">
            {requestsLoading ? (
              <p>Cargando solicitudes...</p>
            ) : specialRequests.length === 0 ? (
              <p className="cuenta-muted">
                No tienes solicitudes.{" "}
                <Link href="/personalizar">Personalizar</Link> ·{" "}
                <Link href="/pedido-mayor">Por mayor</Link>
              </p>
            ) : (
              <ul className="cuenta-orders">
                {specialRequests.map((req) => (
                  <li key={req.id} className="cuenta-orders__item">
                    <strong>{req.requestNumber}</strong>
                    <span>
                      {REQUEST_TYPE_LABELS[req.type]} ·{" "}
                      <span
                        className={`request-badge ${getRequestBadgeClass(req.status)}`}
                      >
                        {REQUEST_STATUS_LABELS[req.status]}
                      </span>
                    </span>
                    {req.quotedAmount != null && (
                      <span>{formatCOP(req.quotedAmount)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="cuenta-muted">
              <Link href="/solicitud/seguimiento">Consultar con número y correo</Link>
            </p>
          </div>
        )}

        {tab === "direcciones" && (
          <div className="cuenta-card">
            <AddressBook
              addresses={addresses}
              onChange={handleAddressesChange}
            />
          </div>
        )}

        {tab === "seguridad" && (
          <div className="cuenta-card">
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
        )}

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
