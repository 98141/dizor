"use client";

import { useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import {
  getMarketingSettings,
  updateMarketingSettings,
  getNewsletterSubscribers,
  getAbandonedCarts,
  sendAbandonedReminders,
  exportNewsletterCsv,
  exportOrdersCsv,
  exportAbandonedCartsCsv,
} from "@/services/adminMarketingService";
import { formatCOP } from "@/lib/formatCurrency";

const TABS = [
  { id: "settings", label: "Configuración" },
  { id: "newsletter", label: "Newsletter" },
  { id: "abandoned", label: "Carritos" },
  { id: "exports", label: "Exportar" },
];

const normalizeSettings = (raw) => ({
  ...raw,
  popup: {
    enabled: false,
    delaySeconds: 4,
    showNewsletterForm: true,
    title: "",
    text: "",
    ctaLabel: "Suscribirme",
    ctaHref: "",
    imageUrl: "",
    ...(raw?.popup || {}),
  },
  newsletter: {
    footerTitle: "Newsletter Dizor",
    footerText: "",
    successMessage: "¡Gracias! Te hemos suscrito.",
    ...(raw?.newsletter || {}),
  },
  abandonedCart: {
    enabled: true,
    delayHours: 24,
    maxReminders: 2,
    emailSubject: "Tu carrito te espera — Dizor",
    ...(raw?.abandonedCart || {}),
  },
});

function MarketingAdminContent() {
  const [tab, setTab] = useState("settings");
  const [settings, setSettings] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    setError(false);
    try {
      const settingsRes = await getMarketingSettings();
      setSettings(normalizeSettings(settingsRes.settings));
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Error al cargar configuración de marketing"
      );
      setError(true);
      setSettings(normalizeSettings({}));
    }

    try {
      const subsRes = await getNewsletterSubscribers({ limit: 50 });
      setSubscribers(subsRes.subscribers || []);
    } catch {
      setSubscribers([]);
    }

    try {
      const cartsRes = await getAbandonedCarts({ limit: 30 });
      setCarts(cartsRes.carts || []);
    } catch {
      setCarts([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const data = await updateMarketingSettings({
        popup: settings.popup,
        newsletter: settings.newsletter,
        abandonedCart: settings.abandonedCart,
      });
      setSettings(normalizeSettings(data.settings));
      setMessage("Configuración guardada");
    } catch (err) {
      setMessage(err.response?.data?.message || "No se pudo guardar");
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminders = async () => {
    setSaving(true);
    try {
      const data = await sendAbandonedReminders();
      setMessage(data.message || "Recordatorios procesados");
      setError(false);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Error al enviar");
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const setPopup = (key, value) =>
    setSettings((s) => ({
      ...s,
      popup: { ...normalizeSettings(s).popup, [key]: value },
    }));
  const setNewsletter = (key, value) =>
    setSettings((s) => ({
      ...s,
      newsletter: { ...normalizeSettings(s).newsletter, [key]: value },
    }));
  const setAbandoned = (key, value) =>
    setSettings((s) => ({
      ...s,
      abandonedCart: { ...normalizeSettings(s).abandonedCart, [key]: value },
    }));

  if (loading) {
    return <p className="auth-loading">Cargando marketing…</p>;
  }

  if (!settings) {
    return (
      <p className="auth-loading">
        No se pudo cargar marketing. Revisa que el backend esté en marcha.
      </p>
    );
  }

  return (
    <div className="admin-page marketing-admin">
      <h1 className="admin-page__title">Marketing</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1rem" }}>
        Newsletter, popup promocional, carritos abandonados y exportaciones
      </p>

      <div className="marketing-admin__tabs">
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
      </div>

      {message && (
        <p style={{ color: error ? "#b33" : "var(--color-primary)" }}>{message}</p>
      )}

      {tab === "settings" && (
        <form className="marketing-admin__card" onSubmit={saveSettings}>
          <h2>Popup promocional</h2>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={Boolean(settings.popup?.enabled)}
              onChange={(e) => setPopup("enabled", e.target.checked)}
            />
            Activar popup
          </label>
          <AuthFormField
            label="Título"
            name="popupTitle"
            value={settings.popup?.title || ""}
            onChange={(e) => setPopup("title", e.target.value)}
          />
          <AuthFormField
            label="Texto"
            name="popupText"
            value={settings.popup?.text || ""}
            onChange={(e) => setPopup("text", e.target.value)}
          />
          <AuthFormField
            label="Retraso (segundos)"
            name="delay"
            type="number"
            value={settings.popup?.delaySeconds ?? 4}
            onChange={(e) => setPopup("delaySeconds", Number(e.target.value))}
          />

          <h2 style={{ marginTop: "1.5rem" }}>Newsletter (footer)</h2>
          <AuthFormField
            label="Título footer"
            name="nlTitle"
            value={settings.newsletter?.footerTitle || ""}
            onChange={(e) => setNewsletter("footerTitle", e.target.value)}
          />
          <AuthFormField
            label="Texto footer"
            name="nlText"
            value={settings.newsletter?.footerText || ""}
            onChange={(e) => setNewsletter("footerText", e.target.value)}
          />

          <h2 style={{ marginTop: "1.5rem" }}>Carrito abandonado</h2>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={Boolean(settings.abandonedCart?.enabled)}
              onChange={(e) => setAbandoned("enabled", e.target.checked)}
            />
            Enviar recordatorios
          </label>
          <AuthFormField
            label="Horas antes del primer correo"
            name="delayHours"
            type="number"
            value={settings.abandonedCart?.delayHours ?? 24}
            onChange={(e) => setAbandoned("delayHours", Number(e.target.value))}
          />
          <AuthFormField
            label="Máximo de recordatorios"
            name="maxReminders"
            type="number"
            value={settings.abandonedCart?.maxReminders ?? 2}
            onChange={(e) =>
              setAbandoned("maxReminders", Number(e.target.value))
            }
          />

          <AuthSubmitButton loading={saving}>Guardar configuración</AuthSubmitButton>
        </form>
      )}

      {tab === "newsletter" && (
        <div className="marketing-admin__card">
          <p>{subscribers.length} suscriptores activos (últimos 50)</p>
          <table className="marketing-admin__table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Nombre</th>
                <th>Fuente</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s._id}>
                  <td>{s.email}</td>
                  <td>{s.name || "—"}</td>
                  <td>{s.source}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "abandoned" && (
        <div className="marketing-admin__card">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleSendReminders}
            disabled={saving}
            style={{ marginBottom: "1rem" }}
          >
            Enviar recordatorios pendientes
          </button>
          <table className="marketing-admin__table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Ítems</th>
                <th>Subtotal</th>
                <th>Recordatorios</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {carts.map((c) => (
                <tr key={c._id}>
                  <td>{c.email}</td>
                  <td>{c.itemCount}</td>
                  <td>{formatCOP(c.subtotal)}</td>
                  <td>{c.remindersSent}</td>
                  <td>{new Date(c.updatedAt).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "exports" && (
        <div className="marketing-admin__card">
          <div className="marketing-admin__exports">
            <button
              type="button"
              className="admin-btn"
              onClick={() => exportNewsletterCsv().catch(() => {})}
            >
              Exportar newsletter (CSV)
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => exportOrdersCsv().catch(() => {})}
            >
              Exportar pedidos (CSV)
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => exportAbandonedCartsCsv().catch(() => {})}
            >
              Exportar carritos (CSV)
            </button>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
            Los archivos CSV se descargan en tu navegador. Máximo 5.000–10.000
            registros por exportación.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminMarketingPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell>
        <MarketingAdminContent />
      </AdminShell>
    </RoleRoute>
  );
}
