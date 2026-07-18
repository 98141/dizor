"use client";

import { useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import {
  getStoreSettings,
  updateStoreSettings,
} from "@/services/adminSettingsService";
import { formatCOP } from "@/lib/formatCurrency";
import { useFlashMessage } from "@/hooks/useFlashMessage";

function AdminConfigContent() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();

  useEffect(() => {
    getStoreSettings()
      .then((d) => setForm(d.settings))
      .catch(() => setForm(null))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    clearMsg();
    try {
      const data = await updateStoreSettings({
        taxEnabled: form.taxEnabled,
        taxRate: Number(form.taxRate),
        shippingMode: form.shippingMode,
        shippingFixedCost: Number(form.shippingFixedCost),
        freeShippingMinAmount: Number(form.freeShippingMinAmount),
        carriers: form.carriers,
      });
      setForm(data.settings);
      showMsg("Configuración guardada");
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo guardar", true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="auth-loading">Cargando configuración…</p>;
  }

  if (!form) {
    return <p>No se pudo cargar la configuración de la tienda.</p>;
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Configuración de tienda</h1>
      <p className="admin-page__subtitle">
        Envíos, impuestos y transportadoras usadas en el checkout.
      </p>

      <form className="admin-form store-settings-form" onSubmit={handleSubmit}>
        <section className="product-form__section">
          <h2>Impuestos</h2>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.taxEnabled}
              onChange={(e) => handleChange("taxEnabled", e.target.checked)}
            />
            Aplicar impuestos
          </label>
          <div className="admin-form__group">
            <label htmlFor="taxRate">Tasa de impuesto (%)</label>
            <input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              value={form.taxRate}
              onChange={(e) => handleChange("taxRate", e.target.value)}
            />
          </div>
        </section>

        <section className="product-form__section">
          <h2>Envíos</h2>
          <div className="admin-form__group">
            <label htmlFor="shippingMode">Modo de envío</label>
            <select
              id="shippingMode"
              value={form.shippingMode}
              onChange={(e) => handleChange("shippingMode", e.target.value)}
            >
              <option value="free_threshold">Gratis desde monto mínimo</option>
              <option value="fixed">Costo fijo siempre</option>
              <option value="by_department">Por departamento</option>
            </select>
          </div>
          <div className="admin-form__row">
            <div className="admin-form__group">
              <label htmlFor="shippingFixedCost">Costo envío (COP)</label>
              <input
                id="shippingFixedCost"
                type="number"
                min="0"
                value={form.shippingFixedCost}
                onChange={(e) =>
                  handleChange("shippingFixedCost", e.target.value)
                }
              />
            </div>
            <div className="admin-form__group">
              <label htmlFor="freeShippingMinAmount">Mínimo envío gratis</label>
              <input
                id="freeShippingMinAmount"
                type="number"
                min="0"
                value={form.freeShippingMinAmount}
                onChange={(e) =>
                  handleChange("freeShippingMinAmount", e.target.value)
                }
              />
              <p className="admin-muted">
                Actual: envío gratis desde{" "}
                {formatCOP(form.freeShippingMinAmount)}
              </p>
            </div>
          </div>
        </section>

        <section className="product-form__section">
          <h2>Transportadoras</h2>
          <p className="admin-muted">
            {form.carriers?.join(", ") || "Sin transportadoras"}
          </p>
        </section>

        <AuthErrorAlert
          key={flashKey}
          message={message}
          variant={error ? "error" : "success"}
        />
        <AuthSubmitButton loading={saving}>Guardar configuración</AuthSubmitButton>
      </form>
    </div>
  );
}

export default function AdminConfigPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <AdminConfigContent />
      </AdminShell>
    </RoleRoute>
  );
}
