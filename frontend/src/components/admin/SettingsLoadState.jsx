"use client";
export default function SettingsLoadState({ state, label, editable = true }) {
  const { status, value, message, resource } = state;
  const busy = ["loading", "saving", "verifying"].includes(status);
  return <div aria-label={`Estado de ${label}`}>
    {status === "loading" && <p role="status">Cargando {label}…</p>}
    {status === "saving" && <p role="status">Guardando cambios…</p>}
    {status === "load-error" && <p role="alert">Error al cargar {label}. {editable ? message : "No se ha confirmado una lista vacía. Los registros que pudieran verse corresponden a la última consulta válida."}</p>}
    {status === "save-error" && <p role="alert">{message}</p>}
    {["uncertain", "verifying"].includes(status) && <><p role="alert">{message}</p><button type="button" className="admin-btn" disabled={busy} onClick={() => resource.verify()}>Comprobar resultado de {label}</button><p className="admin-muted">Recargar descarta el borrador y consulta los datos actuales; no vuelve a enviar cambios.</p></>}
    {status === "saved" && <p role="status">{message}</p>}
    {editable && resource.canEdit() && !resource.canSave() && <p role="alert">Revisa los valores antes de guardar la configuración.</p>}
    {status !== "saved" && status !== "loading" && value !== null && editable && (value.popup ? !value.popup.enabled && [value.popup.title, value.popup.text, value.popup.ctaLabel, value.popup.ctaHref, value.popup.imageUrl, value.popup.couponCode, ...Object.values(value.newsletter), value.abandonedCart.emailSubject].every(v => v === "") : Object.values(value).every(v => v === "")) && <p role="status">Configuración vacía confirmada por el servidor.</p>}
    <button type="button" className="admin-btn" disabled={busy} onClick={() => resource.load()}>{status === "load-error" ? "Reintentar " : "Actualizar "}{label}</button>
  </div>;
}
