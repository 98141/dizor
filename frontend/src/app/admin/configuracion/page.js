"use client";

// Sprint 08 · Configuración de tienda (Operativo Premium Híbrido).
// Same endpoints and payload as before: while the shipping policy is "included", the PATCH
// only carries { taxEnabled, taxRate }. Shipping amounts stay as read-only history.
import { useCallback, useEffect, useRef, useState } from "react";
import { HiOutlineTruck, HiOutlineReceiptPercent, HiOutlineArrowPath } from "react-icons/hi2";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AdminFeedback from "@/components/admin/AdminFeedback";
import { getStoreSettings, updateStoreSettings } from "@/services/adminSettingsService";
import { CARRIER_LABELS } from "@/lib/orderLabels";
import { formatCOP } from "@/lib/formatCurrency";
import { useFlashMessage } from "@/hooks/useFlashMessage";

const SHIPPING_MODE_LABELS = { included: "Incluido", fixed: "Costo fijo", free_threshold: "Gratis desde monto mínimo", by_department: "Por departamento" };
const updatedFormat = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Fields this form can actually write, normalised for comparison. */
const editable = (s) => s ? {
  taxEnabled: !!s.taxEnabled, taxRate: String(s.taxRate ?? ""),
  ...(!s.shippingIncluded ? { shippingMode: s.shippingMode, shippingFixedCost: String(s.shippingFixedCost ?? ""), freeShippingMinAmount: String(s.freeShippingMinAmount ?? "") } : {}),
} : null;
const sameDraft = (a, b) => JSON.stringify(editable(a)) === JSON.stringify(editable(b));

function payloadOf(form) {
  return {
    taxEnabled: form.taxEnabled,
    taxRate: Number(form.taxRate),
    ...(!form.shippingIncluded ? { shippingMode: form.shippingMode, shippingFixedCost: Number(form.shippingFixedCost), freeShippingMinAmount: Number(form.freeShippingMinAmount) } : {}),
  };
}

function AdminConfigContent() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | load-error
  const [saving, setSaving] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const lock = useRef(false);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();

  const fetchSettings = useCallback(() => getStoreSettings()
    .then((d) => { setForm(d.settings); setSaved(d.settings); setStatus("ready"); })
    .catch(() => setStatus("load-error")), []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  const load = () => { setStatus("loading"); fetchSettings(); };

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lock.current || !form) return;
    lock.current = true;
    setSaving(true);
    setUnknown(false);
    clearMsg();
    try {
      const data = await updateStoreSettings(payloadOf(form));
      setForm(data.settings);
      setSaved(data.settings);
      showMsg("Configuración guardada");
    } catch (err) {
      if (!err.response) {
        // No answer: the change may or may not be applied. Keep the draft and offer a check.
        setUnknown(true);
        showMsg("No se pudo confirmar si el servidor guardó los cambios. Comprueba la configuración antes de volver a guardar.", true);
      } else {
        showMsg(err.response?.data?.message || "No se pudo guardar", true);
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  // Compare the server state with the draft, without sending anything.
  const verify = async () => {
    if (lock.current) return;
    lock.current = true;
    setVerifying(true);
    try {
      const { settings } = await getStoreSettings();
      setSaved(settings);
      setUnknown(false);
      if (sameDraft(settings, form)) { setForm(settings); showMsg("El servidor confirma los cambios. Configuración guardada."); }
      else showMsg("El servidor no tiene estos cambios. Tu borrador se conserva: revisa y guarda de nuevo.", true);
    } catch {
      showMsg("Sigue sin poder consultarse la configuración. Tu borrador se conserva.", true);
    } finally {
      lock.current = false;
      setVerifying(false);
    }
  };

  const head = <header className="cf-head">
    <div>
      <h1>Configuración de tienda</h1>
      <p className="cf-lead">Impuestos, política de envío y transportadoras que usa el checkout.</p>
    </div>
  </header>;

  if (status === "loading" && !form) {
    return <div className="admin-page cf-page">{head}
      <div className="cf-settings" aria-busy="true"><p role="status" className="cf-sr-only">Cargando configuración…</p>
        <div className="cf-skeleton cf-skeleton--tall" aria-hidden="true" /><div className="cf-skeleton" aria-hidden="true" /></div>
    </div>;
  }

  if (status === "load-error" || !form) {
    return <div className="admin-page cf-page">{head}
      <div className="cf-notice cf-notice--error" role="alert">
        <p><strong>No se pudo cargar la configuración de la tienda.</strong> No se muestran valores para no confundirlos con los guardados.</p>
        <button type="button" className="admin-btn admin-btn--sm" onClick={load}><HiOutlineArrowPath aria-hidden="true" />Reintentar</button>
      </div>
    </div>;
  }

  const dirty = !sameDraft(form, saved);
  const carriers = form.activeCarriers || form.carriers || [];

  return (
    <div className="admin-page cf-page">
      {head}
      <div className="cf-settings">
        <form className="cf-card cf-tax cf-settings__main" onSubmit={handleSubmit} aria-busy={saving} aria-labelledby="cf-tax-title">
          <div className="cf-card__head">
            <span className="cf-card__icon" aria-hidden="true"><HiOutlineReceiptPercent /></span>
            <div className="cf-card__titles">
              <h2 id="cf-tax-title">Impuestos</h2>
              <p className="cf-card__sub">Se suman sobre el subtotal del pedido en el checkout.</p>
            </div>
            <span className={`cf-chip ${saved.taxEnabled ? "cf-chip--ok" : "cf-chip--muted"}`}>
              {saved.taxEnabled ? `Activos · ${saved.taxRate} %` : "Desactivados"}
            </span>
          </div>

          <div className="cf-tax__fields">
            <label className="admin-checkbox cf-switch" htmlFor="taxEnabled">
              <input id="taxEnabled" type="checkbox" checked={form.taxEnabled} onChange={(e) => handleChange("taxEnabled", e.target.checked)} />
              <span>Aplicar impuestos</span>
            </label>
            <div className="admin-form__group cf-rate">
              <label htmlFor="taxRate">Tasa de impuesto (%)</label>
              <div className="cf-suffix">
                <input id="taxRate" type="number" inputMode="decimal" min="0" max="100" step="any" required
                  aria-describedby="taxRate-hint" value={form.taxRate} onChange={(e) => handleChange("taxRate", e.target.value)} />
                <span aria-hidden="true">%</span>
              </div>
            </div>
          </div>
          <p id="taxRate-hint" className="cf-hint cf-tax__hint">La tasa admite valores entre 0 y 100.</p>
          {!form.taxEnabled && <p className="cf-inline-note" role="note">Con los impuestos desactivados, el checkout no los suma. La tasa se conserva, pero no se aplican mientras sigan desactivados.</p>}

          {!form.shippingIncluded && <fieldset className="cf-fieldset">
            <legend>Envíos</legend>
            <div className="admin-form__group">
              <label htmlFor="shippingMode">Modo de envío</label>
              <select id="shippingMode" value={form.shippingMode} onChange={(e) => handleChange("shippingMode", e.target.value)}>
                <option value="included">Incluido en el precio</option>
                <option value="free_threshold">Gratis desde monto mínimo</option>
                <option value="fixed">Costo fijo siempre</option>
                <option value="by_department">Por departamento</option>
              </select>
            </div>
            <div className="cf-two">
              <div className="admin-form__group">
                <label htmlFor="shippingFixedCost">Costo envío (COP)</label>
                <input id="shippingFixedCost" type="number" min="0" value={form.shippingFixedCost} onChange={(e) => handleChange("shippingFixedCost", e.target.value)} />
              </div>
              <div className="admin-form__group">
                <label htmlFor="freeShippingMinAmount">Mínimo envío gratis</label>
                <input id="freeShippingMinAmount" type="number" min="0" value={form.freeShippingMinAmount} onChange={(e) => handleChange("freeShippingMinAmount", e.target.value)} />
              </div>
            </div>
          </fieldset>}

          <AdminFeedback key={flashKey} message={message} variant={error ? "error" : "success"} />
          {unknown && <button type="button" className="admin-btn admin-btn--sm" aria-busy={verifying} disabled={verifying} onClick={verify}>Comprobar configuración</button>}

          <div className="cf-actions">
            <AuthSubmitButton loading={saving}>Guardar configuración</AuthSubmitButton>
            {dirty && !saving && <span className="cf-chip cf-chip--warning">Cambios sin guardar</span>}
            {saved.updatedAt && <span className="cf-hint cf-actions__meta">Última actualización: {updatedFormat.format(new Date(saved.updatedAt)).replace(/\./g, "")}</span>}
          </div>
        </form>

        <div className="cf-settings__side">
          {form.shippingIncluded && <section className="cf-card cf-card--compact" aria-labelledby="cf-shipping-title">
            <div className="cf-card__head">
              <span className="cf-card__icon" aria-hidden="true"><HiOutlineTruck /></span>
              <div className="cf-card__titles"><h2 id="cf-shipping-title">Envíos</h2></div>
              <span className="cf-chip cf-chip--ok">Vigente</span>
            </div>
            <p className="cf-policy" role="status"><strong>Envío incluido en el precio.</strong> El cliente no paga un cargo adicional de envío en el checkout.</p>
            <details className="cf-history">
              <summary>Consultar configuración histórica de envío</summary>
              <p className="cf-hint">Valores guardados de otras políticas. No se aplican mientras esta política esté vigente y no se editan aquí.</p>
              <dl className="cf-dl">
                <div><dt>Modo guardado</dt><dd>{SHIPPING_MODE_LABELS[form.shippingMode] || form.shippingMode}</dd></div>
                <div><dt>Costo guardado (sin efecto actual)</dt><dd>{formatCOP(form.shippingFixedCost)}</dd></div>
                <div><dt>Mínimo guardado (sin efecto actual)</dt><dd>{formatCOP(form.freeShippingMinAmount)}</dd></div>
              </dl>
            </details>
          </section>}

          <section id="cf-carriers" className="cf-card cf-card--compact" aria-labelledby="cf-carriers-title">
            <div className="cf-card__head">
              <div className="cf-card__titles">
                <h2 id="cf-carriers-title">Transportadoras</h2>
                <p className="cf-card__sub">Confirmadas para los envíos. No se editan desde esta pantalla.</p>
              </div>
            </div>
            {carriers.length
              ? <ul className="cf-carriers">{carriers.map((id) => <li key={id}><span className="cf-dot" aria-hidden="true" />{CARRIER_LABELS[id] || id}</li>)}</ul>
              : <p className="cf-hint">Sin transportadoras confirmadas.</p>}
          </section>
        </div>
      </div>
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
