"use client";

// Sprint 08 · Usuarios y personal. The team comes first; the creation form opens on demand.
// Same endpoints, fields, validations and superadmin-only access as before (the API also
// enforces authorizeRoles("superadmin")). No delete, password reset or role change added.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HiOutlinePlus, HiOutlineUserGroup, HiOutlineArrowPath } from "react-icons/hi2";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AdminFormField from "@/components/admin/AdminFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AdminFeedback from "@/components/admin/AdminFeedback";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import { createAdminUser, getAdminUsers, updateAdminUserStatus } from "@/services/adminUserService";
import { getAuditRoleLabel } from "@/lib/auditLabels";

const EMPTY = { name: "", email: "", password: "", phone: "", role: "vendedor" };
const lastAccess = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
// "25 nov 2026, 9:05 a m": the parts without the "de" fillers, so it fits a phone card.
const when = (value) => {
  if (!value) return "Sin accesos registrados";
  const p = Object.fromEntries(lastAccess.formatToParts(new Date(value)).map((x) => [x.type, x.value.replace(/\./g, "").trim()]));
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod || ""}`.trim();
};

function AdminUsuariosContent() {
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState({ text: "", error: false });
  const [pageMessage, setPageMessage] = useState({ text: "", error: false });
  const [confirming, setConfirming] = useState(null);
  const lock = useRef(false);
  const trigger = useRef(null), panel = useRef(null), formRef = useRef(null);

  const fetchTeam = useCallback(() => getAdminUsers().then((data) => {
    const list = data.users || [];
    setUsers(list); setLoaded(true); setLoadError("");
    return list;
  }).catch(() => {
    setLoadError("No se pudo cargar el equipo. Reintenta para consultar los usuarios reales.");
    return null;
  }).finally(() => setLoading(false)), []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);
  const load = () => { setLoading(true); return fetchTeam(); };

  // Focus moves once the panel is committed: to the first field on open, back to the trigger on close.
  const focusTarget = useRef(null);
  useLayoutEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "field" && open) document.getElementById("name")?.focus();
    if (target === "trigger" && !open) trigger.current?.focus();
  }, [open]);

  const openForm = () => {
    focusTarget.current = "field";
    setOpen(true);
    setPageMessage({ text: "", error: false });
  };
  // Closing discards the draft, password included, and returns focus to the trigger.
  const closeForm = () => {
    if (saving) return;
    focusTarget.current = "trigger";
    setOpen(false);
    setForm(EMPTY);
    setFormMessage({ text: "", error: false });
    formRef.current?.reset();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setOpen(true); // a submitted form always shows its own progress and result
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFormMessage({ text: "", error: false });
    const node = e.currentTarget, draft = form;
    try {
      await createAdminUser(draft);
      setForm(EMPTY);
      node?.reset();
      focusTarget.current = "trigger";
      setOpen(false);
      setPageMessage({ text: "Usuario creado correctamente", error: false });
      await load();
    } catch (err) {
      if (!err.response) {
        // No answer: check the real team before suggesting a retry.
        const list = await load();
        const found = list?.some((u) => u.email === draft.email.trim().toLowerCase());
        if (found) {
          setForm(EMPTY); node?.reset(); setOpen(false);
          setPageMessage({ text: `No llegó la respuesta, pero ${draft.email.trim().toLowerCase()} aparece en el equipo: la creación quedó registrada.`, error: false });
        } else {
          setFormMessage({ text: list ? "No llegó la respuesta y el usuario no aparece en el equipo. Puedes volver a intentarlo." : "No se pudo confirmar la creación ni consultar el equipo. Actualiza el equipo antes de reintentar para no duplicarlo.", error: true });
        }
      } else {
        setFormMessage({ text: err.response?.data?.message || "No se pudo crear el usuario", error: true });
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const toggleStatus = async (user) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setConfirming(null);
    setPageMessage({ text: "", error: false });
    try {
      const data = await updateAdminUserStatus(user._id, !user.isActive);
      setPageMessage({ text: data?.message || "Estado del usuario actualizado", error: false });
      await load();
    } catch (err) {
      setPageMessage({ text: err.response?.data?.message || "No se pudo actualizar el estado. El equipo muestra el último estado confirmado.", error: true });
      await load();
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const active = users.filter((u) => u.isActive).length;

  return (
    <div className="admin-page cf-page cf-page--team">
      <header className="cf-head cf-head--action">
        <div>
          <h1>Usuarios del equipo</h1>
          <p className="cf-lead">Administra los accesos y roles del personal autorizado.</p>
        </div>
        <button ref={trigger} id="cf-new-user" type="button" className="admin-btn admin-btn--primary" aria-expanded={open} aria-controls="cf-user-panel" onClick={() => (open ? closeForm() : openForm())}>
          <HiOutlinePlus aria-hidden="true" />Nuevo usuario
        </button>
      </header>

      <AdminFeedback message={pageMessage.text} variant={pageMessage.error ? "error" : "success"} />

      <section id="cf-user-panel" ref={panel} className="cf-card cf-user-panel" aria-labelledby="cf-user-panel-title" hidden={!open}
        onKeyDown={(e) => { if (e.key === "Escape" && !e.target.closest?.("select")) { e.preventDefault(); closeForm(); } }}>
        <div className="cf-card__head">
          <div className="cf-card__titles">
            <h2 id="cf-user-panel-title">Nuevo usuario</h2>
            <p className="cf-card__sub">Solo el superadministrador puede crear administradores y vendedores.</p>
          </div>
        </div>
        <form ref={formRef} className="admin-form cf-user-form" onSubmit={handleCreate} aria-busy={saving} autoComplete="off">
          <div className="cf-two">
            <AdminFormField label="Nombre" name="name" value={form.name} onChange={set("name")} autoComplete="off" maxLength={120} required />
            <AdminFormField label="Correo" name="email" type="email" value={form.email} onChange={set("email")} autoComplete="off" required />
            <AdminFormField label="Contraseña" name="password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={8} maxLength={128} hint="Mínimo 8 caracteres, con mayúscula, minúscula, un número y un símbolo." required />
            <AdminFormField label="Teléfono" name="phone" type="tel" value={form.phone} onChange={set("phone")} autoComplete="off" hint="Opcional." />
            <div className="admin-form__group">
              <label htmlFor="role">Rol</label>
              <select id="role" value={form.role} onChange={set("role")} aria-describedby="role-hint">
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
              <span id="role-hint" className="cf-hint">{form.role === "admin" ? "Gestiona la tienda, sin acceso a Finanzas ni a Usuarios." : "Atiende pedidos y solicitudes desde el panel del vendedor."}</span>
            </div>
          </div>
          <AdminFeedback message={formMessage.text} variant={formMessage.error ? "error" : "success"} />
          <div className="cf-actions">
            <AuthSubmitButton loading={saving}>Crear usuario</AuthSubmitButton>
            <button type="button" className="admin-btn admin-btn--tertiary" disabled={saving} onClick={closeForm}>Cancelar</button>
          </div>
        </form>
      </section>

      <section className="cf-team" aria-labelledby="cf-team-title" aria-busy={loading}>
        <div className="cf-section-head">
          <h2 id="cf-team-title">Equipo</h2>
          {loaded && !loadError && users.length > 0 && <p className="cf-count" role="status">{users.length === 1 ? "1 persona" : `${users.length} personas`} · {active === 1 ? "1 activa" : `${active} activas`}</p>}
        </div>

        {loadError && <div className="cf-notice cf-notice--error" role="alert">
          <p><strong>{loadError}</strong>{loaded ? " Se muestra la última lista confirmada; las acciones quedan bloqueadas hasta actualizar." : ""}</p>
          <button type="button" className="admin-btn admin-btn--sm" disabled={loading} onClick={load}><HiOutlineArrowPath aria-hidden="true" />Reintentar equipo</button>
        </div>}

        {loading && !loaded && !loadError && <div aria-hidden="true" className="cf-skeleton-list"><span /><span /><span /></div>}
        {loading && !loaded && !loadError && <p role="status" className="cf-hint">Cargando equipo…</p>}

        {loaded && users.length === 0 && !loadError && <div className="cf-empty">
          <span className="cf-empty__icon" aria-hidden="true"><HiOutlineUserGroup /></span>
          <p className="cf-empty__title">Aún no hay administradores ni vendedores.</p>
          <p className="cf-hint">Crea el primer acceso cuando alguien del equipo necesite entrar al panel.</p>
          <button type="button" className="admin-btn" onClick={openForm}>Crear primer usuario</button>
        </div>}

        {loaded && users.length > 0 && <div className={`cf-table-wrap${loading ? " is-stale" : ""}`}>
          <table className="cf-table cf-team__table">
            <thead><tr><th scope="col">Persona</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Último acceso</th><th scope="col"><span className="cf-sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {users.map((u) => <tr key={u._id}>
                <td className="cf-team__person"><span className="cf-strong">{u.name}</span><span className="cf-sub cf-ellipsis" title={u.email}>{u.email}</span></td>
                <td className="cf-team__role"><span className="cf-chip">{getAuditRoleLabel(u.role)}</span></td>
                <td className="cf-team__status"><span className={`cf-chip ${u.isActive ? "cf-chip--ok" : "cf-chip--muted"}`}>{u.isActive ? "Activo" : "Inactivo"}</span></td>
                <td className="cf-team__last">{when(u.lastLoginAt)}</td>
                <td className="cf-team__action">
                  <button type="button" className={`admin-btn admin-btn--sm${u.isActive ? " admin-btn--danger" : ""}`} disabled={saving || !!loadError}
                    aria-label={`${u.isActive ? "Desactivar" : "Activar"} acceso de ${u.name}`}
                    onClick={() => (u.isActive ? setConfirming(u) : toggleStatus(u))}>{u.isActive ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>}
        {loaded && <p className="cf-hint cf-footnote">El superadministrador no aparece en esta lista y no se desactiva desde aquí.</p>}
      </section>

      <AdminConfirmModal isOpen={!!confirming} title="Desactivar acceso"
        message={confirming ? `${confirming.name} no podrá iniciar sesión ni usar el panel hasta que se active de nuevo. Su historial se conserva.` : ""}
        confirmLabel="Desactivar acceso" onCancel={() => setConfirming(null)} onConfirm={() => toggleStatus(confirming)} />
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
