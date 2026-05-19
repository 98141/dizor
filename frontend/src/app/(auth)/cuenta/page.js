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

const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Administrador",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

const ORDER_STATUS = {
  pendiente_pago: { label: "Pendiente pago", cls: "badge--warning" },
  pagado:         { label: "Pagado",         cls: "badge--info" },
  procesando:     { label: "Procesando",     cls: "badge--info" },
  enviado:        { label: "Enviado",        cls: "badge--purple" },
  entregado:      { label: "Entregado",      cls: "badge--success" },
  cancelado:      { label: "Cancelado",      cls: "badge--danger" },
};

const REQUEST_BADGE = {
  pendiente:   "badge--warning",
  en_revision: "badge--info",
  cotizado:    "badge--purple",
  aprobado:    "badge--success",
  completado:  "badge--success",
  rechazado:   "badge--danger",
  cancelado:   "badge--danger",
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");

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
      setProfileMsg("Perfil actualizado correctamente");
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
      setPwdForm({ currentPassword: "", password: "", passwordConfirm: "" });
      setShowPasswordForm(false);
    } catch (error) {
      setPwdMessage(
        error.response?.data?.message || "No se pudo actualizar la contraseña."
      );
    } finally {
      setPwdLoading(false);
    }
  };

  const isAdmin  = ["superadmin", "admin"].includes(user.role);
  const isStaff  = ["superadmin", "admin", "vendedor"].includes(user.role);
  const initials = getInitials(user.name);
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
      })
    : null;

  const TABS = [
    { id: "perfil", label: "Perfil" },
    {
      id: "pedidos",
      label: ordersLoading
        ? "Pedidos"
        : `Pedidos${orders.length ? ` (${orders.length})` : ""}`,
    },
    {
      id: "solicitudes",
      label: requestsLoading
        ? "Solicitudes"
        : `Solicitudes${specialRequests.length ? ` (${specialRequests.length})` : ""}`,
    },
    {
      id: "direcciones",
      label: `Direcciones${addresses.length ? ` (${addresses.length})` : ""}`,
    },
    { id: "seguridad", label: "Seguridad" },
  ];

  return (
    <div className="auth-page">
      <div className="cuenta-page">
        <Link href="/catalogo" className="cuenta-back">
          ← Volver a la tienda
        </Link>

        {/* ── Hero ── */}
        <div className="cuenta-hero">
          <div className="cuenta-hero__top">
            <div className="cuenta-avatar">{initials}</div>
            <div className="cuenta-hero__info">
              <h1 className="cuenta-hero__name">{user.name}</h1>
              <div className="cuenta-hero__meta">
                <span className={`cuenta-role-badge cuenta-role-badge--${user.role}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                <span>{user.email}</span>
                {memberSince && <span>· Miembro desde {memberSince}</span>}
              </div>
            </div>
          </div>

          <div className="cuenta-stats">
            <div className="cuenta-stat">
              <span className="cuenta-stat__value">
                {ordersLoading ? "—" : orders.length}
              </span>
              <span className="cuenta-stat__label">Pedidos</span>
            </div>
            <div className="cuenta-stat">
              <span className="cuenta-stat__value">
                {requestsLoading ? "—" : specialRequests.length}
              </span>
              <span className="cuenta-stat__label">Solicitudes</span>
            </div>
            <div className="cuenta-stat">
              <span className="cuenta-stat__value">{addresses.length}</span>
              <span className="cuenta-stat__label">Direcciones</span>
            </div>
          </div>

          {isStaff && (
            <div className="cuenta-panels">
              {isAdmin && (
                <Link href="/admin" className="cuenta-panel-card">
                  <span className="cuenta-panel-card__icon">⚙</span>
                  <span className="cuenta-panel-card__text">
                    <span className="cuenta-panel-card__title">Panel administrativo</span>
                    <span className="cuenta-panel-card__desc">Gestionar tienda y productos</span>
                  </span>
                </Link>
              )}
              <Link href="/vendedor" className="cuenta-panel-card">
                <span className="cuenta-panel-card__icon">📦</span>
                <span className="cuenta-panel-card__text">
                  <span className="cuenta-panel-card__title">Panel de ventas</span>
                  <span className="cuenta-panel-card__desc">Pedidos y solicitudes</span>
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
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

        {/* ── Perfil ── */}
        {tab === "perfil" && (
          <div className="cuenta-card">
            <h2 className="cuenta-card__title">Datos personales</h2>
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
                label="Correo electrónico"
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
                Guardar cambios
              </AuthSubmitButton>
            </form>
          </div>
        )}

        {/* ── Pedidos ── */}
        {tab === "pedidos" && (
          <div className="cuenta-card">
            <h2 className="cuenta-card__title">Mis pedidos</h2>
            {ordersLoading ? (
              <p className="cuenta-muted">Cargando pedidos...</p>
            ) : orders.length === 0 ? (
              <p className="cuenta-muted">
                Aún no tienes pedidos.{" "}
                <Link href="/catalogo">Ir al catálogo</Link>
              </p>
            ) : (
              <ul className="cuenta-orders">
                {orders.map((order) => {
                  const st = ORDER_STATUS[order.orderStatus] ?? {
                    label: order.orderStatus,
                    cls: "badge--gray",
                  };
                  return (
                    <li key={order._id} className="cuenta-orders__item">
                      <div className="cuenta-order-main">
                        <span className="cuenta-order-num">{order.orderNumber}</span>
                        <span className="cuenta-order-date">
                          {formatDate(order.createdAt)}
                        </span>
                        {order.trackingNumber && (
                          <span className="cuenta-order-track">
                            Guía: {order.trackingNumber}
                          </span>
                        )}
                      </div>
                      <div className="cuenta-order-aside">
                        <span className="cuenta-order-total">
                          {formatCOP(order.total)}
                        </span>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                        {!["enviado", "entregado", "cancelado"].includes(
                          order.orderStatus
                        ) && (
                          <button
                            type="button"
                            className="cuenta-order-cancel"
                            onClick={() => handleCancelOrder(order._id)}
                          >
                            Cancelar pedido
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="cuenta-muted" style={{ marginTop: "var(--space-md)" }}>
              <Link href="/seguimiento">Rastrear pedido con número de guía</Link>
            </p>
          </div>
        )}

        {/* ── Solicitudes ── */}
        {tab === "solicitudes" && (
          <div className="cuenta-card">
            <h2 className="cuenta-card__title">Mis solicitudes</h2>
            {requestsLoading ? (
              <p className="cuenta-muted">Cargando solicitudes...</p>
            ) : specialRequests.length === 0 ? (
              <p className="cuenta-muted">
                No tienes solicitudes aún.{" "}
                <Link href="/personalizar">Personalizar sombrero</Link>
                {" · "}
                <Link href="/pedido-mayor">Pedido al por mayor</Link>
              </p>
            ) : (
              <ul className="cuenta-orders">
                {specialRequests.map((req) => (
                  <li key={req.id} className="cuenta-orders__item">
                    <div className="cuenta-order-main">
                      <span className="cuenta-order-num">{req.requestNumber}</span>
                      <span className="cuenta-order-date">
                        {REQUEST_TYPE_LABELS[req.type]}
                        {req.createdAt ? ` · ${formatDate(req.createdAt)}` : ""}
                      </span>
                    </div>
                    <div className="cuenta-order-aside">
                      {req.quotedAmount != null && (
                        <span className="cuenta-order-total">
                          {formatCOP(req.quotedAmount)}
                        </span>
                      )}
                      <span
                        className={`badge ${REQUEST_BADGE[req.status] ?? "badge--gray"}`}
                      >
                        {REQUEST_STATUS_LABELS[req.status] ?? req.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="cuenta-muted" style={{ marginTop: "var(--space-md)" }}>
              <Link href="/solicitud/seguimiento">
                Consultar con número y correo
              </Link>
            </p>
          </div>
        )}

        {/* ── Direcciones ── */}
        {tab === "direcciones" && (
          <div className="cuenta-card">
            <h2 className="cuenta-card__title">Mis direcciones de envío</h2>
            <AddressBook addresses={addresses} onChange={handleAddressesChange} />
          </div>
        )}

        {/* ── Seguridad ── */}
        {tab === "seguridad" && (
          <div className="cuenta-card">
            <h2 className="cuenta-card__title">Seguridad de la cuenta</h2>
            <div className="cuenta-security-info">
              <div className="cuenta-card__row">
                <span className="cuenta-card__label">Correo electrónico</span>
                <span>{user.email}</span>
              </div>
              {user.lastLoginAt && (
                <div className="cuenta-card__row">
                  <span className="cuenta-card__label">Último acceso</span>
                  <span>{formatDate(user.lastLoginAt)}</span>
                </div>
              )}
              {memberSince && (
                <div className="cuenta-card__row">
                  <span className="cuenta-card__label">Miembro desde</span>
                  <span>{memberSince}</span>
                </div>
              )}
            </div>

            {!showPasswordForm ? (
              <>
                {pwdMessage && (
                  <AuthErrorAlert
                    message={pwdMessage}
                    variant={pwdSuccess ? "success" : "error"}
                  />
                )}
                <button
                  type="button"
                  className="cuenta-logout"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Cambiar contraseña
                </button>
              </>
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
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  <AuthSubmitButton loading={pwdLoading}>
                    Guardar contraseña
                  </AuthSubmitButton>
                  <button
                    type="button"
                    className="cuenta-logout"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPwdMessage("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <button
          type="button"
          className="cuenta-logout cuenta-logout--danger cuenta-logout--full"
          onClick={handleLogout}
        >
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
