"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthFormField from "@/components/admin/AdminFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/admin/AdminFeedback";
import {
  createAdminUser,
  getAdminUsers,
  updateAdminUserStatus,
} from "@/services/adminUserService";

function AdminUsuariosContent() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "vendedor",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => getAdminUsers().then(data => {
    setUsers(data.users || []); setLoadError("");
  }).catch(() => setLoadError("No se pudo cargar el equipo. Reintenta para consultar los usuarios reales.")).finally(() => setLoading(false)), []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      await createAdminUser(form);
      setMessage("Usuario creado correctamente");
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "vendedor",
      });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "No se pudo crear el usuario");
      setError(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const toggleStatus = async (id, isActive) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setMessage("");
    try {
      await updateAdminUserStatus(id, !isActive);
      setError(false);
      setMessage("Estado del usuario actualizado");
      await load();
    } catch (err) {
      setError(true);
      setMessage(err.response?.data?.message || "No se pudo actualizar");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Usuarios del equipo</h1>
      <p className="admin-page__subtitle">
        Solo superadmin puede crear administradores y vendedores.
      </p>

      <div className="admin-grid-2">
        <section className="taxonomy-form-card">
          <h2>Nuevo usuario</h2>
          <form className="admin-form" onSubmit={handleCreate} aria-busy={saving}>
            <AuthFormField
              label="Nombre"
              name="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <AuthFormField
              label="Correo"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
            <AuthFormField
              label="Contraseña"
              name="password"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              required
            />
            <AuthFormField
              label="Teléfono"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <div className="admin-form__group">
              <label htmlFor="role">Rol</label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <AuthErrorAlert message={message} variant={error ? "error" : "success"} />
            <AuthSubmitButton loading={saving}>Crear usuario</AuthSubmitButton>
          </form>
        </section>

        <section className="taxonomy-list-card">
          <h2>Equipo activo</h2>
          {loadError && <><AuthErrorAlert message={loadError} /><button type="button" className="admin-btn" onClick={() => { setLoading(true); load(); }}>Reintentar equipo</button></>}
          {loading ? (
            <p className="auth-loading">Cargando…</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td data-label="Nombre">
                        {u.name}
                        <br />
                        <span className="admin-muted">{u.email}</span>
                      </td>
                      <td data-label="Rol">{u.role}</td>
                      <td data-label="Estado">{u.isActive ? "Activo" : "Inactivo"}</td>
                      <td data-label="Acciones">
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm"
                          disabled={saving || !!loadError}
                          onClick={() => toggleStatus(u._id, u.isActive)}
                        >
                          {u.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AdminUsuariosPage() {
  return (
    <RoleRoute allowedRoles={["superadmin"]}>
      <AdminShell variant="admin">
        <AdminUsuariosContent />
      </AdminShell>
    </RoleRoute>
  );
}
