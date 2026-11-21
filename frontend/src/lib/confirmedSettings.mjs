// A failed read is never editable data. No commercial defaults live here.
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const strings = (value, keys) => object(value) && keys.every(key => typeof value[key] === "string");
const number = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const popupText = ["title", "text", "ctaLabel", "ctaHref", "imageUrl", "variant", "couponCode"];
const newsletterText = ["footerTitle", "footerText", "successMessage"];
export const APPEARANCE_FIELDS = ["siteName", "primaryColor", "accentColor", "bgColor", "faviconUrl", "logoUrl"];
const invalid = () => { throw new Error("La respuesta de configuración está incompleta o no es válida."); };
export function validMarketing(value) {
  return object(value) && value.key === "default" && strings(value.popup, popupText)
    && typeof value.popup.enabled === "boolean" && typeof value.popup.showNewsletterForm === "boolean"
    && ["newsletter", "coupon", "info"].includes(value.popup.variant) && number(value.popup.delaySeconds, 0, 60)
    && strings(value.newsletter, newsletterText) && strings(value.abandonedCart, ["emailSubject"])
    && typeof value.abandonedCart.enabled === "boolean" && typeof value.abandonedCart.featureEnabled === "boolean"
    && number(value.abandonedCart.delayHours, 1, 168) && number(value.abandonedCart.maxReminders, 1, 5);
}
export function readMarketing(data) {
  if (data?.status !== "success" || !validMarketing(data.settings)) invalid();
  return copy(data.settings);
}
export function marketingPayload(value) {
  if (!validMarketing(value)) invalid();
  const payload = copy({ popup: value.popup, newsletter: value.newsletter, abandonedCart: value.abandonedCart });
  delete payload.abandonedCart.featureEnabled; // Server policy is read-only.
  return payload;
}
export function readAppearance(data) {
  const settings = data?.settings, value = settings?.appearance;
  if (data?.status !== "success" || typeof settings?.id !== "string" || !object(value)) invalid();
  // An explicitly empty appearance in a valid resource is legitimate. A partial
  // appearance is not synthesized into an editable replacement.
  if (Object.keys(value).length && !strings(value, APPEARANCE_FIELDS)) invalid();
  return Object.fromEntries(APPEARANCE_FIELDS.map(key => [key, value[key] ?? ""]));
}
export const validAppearance = value => strings(value, APPEARANCE_FIELDS);
export function readRows(field, requireSuccess = true) {
  return data => {
    if ((requireSuccess && data?.status !== "success") || !Array.isArray(data?.[field])) invalid();
    return copy(data[field]);
  };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return typeof value === "string" ? value.trim() : value;
}
function matches(actual, sent) {
  const clean = value => { const normalized = canonical(value); if (normalized?.popup?.couponCode) normalized.popup.couponCode = normalized.popup.couponCode.toUpperCase(); return JSON.stringify(normalized); };
  return clean(actual) === clean(sent);
}
export function createConfirmedSettings({ read, write, parse, valid = () => true, payload = copy, timeoutMs = 15000 }) {
  let state = { status: "loading", value: null, confirmed: null, message: "" };
  let generation = 0, controller, locked = false, pending = null;
  const listeners = new Set();
  const emit = changes => { state = { ...state, ...changes }; listeners.forEach(fn => fn()); };
  const editable = () => ["ready", "saved", "save-error"].includes(state.status) && state.value !== null;
  const request = async (fn, body) => {
    const activeController = controller, signal = activeController.signal;
    let timer, abort;
    try {
      return await Promise.race([
        Promise.resolve().then(() => fn(body, { signal, timeout: timeoutMs })),
        new Promise((_, reject) => {
          abort = () => reject(Object.assign(new Error("Solicitud interrumpida o agotada"), { code: "ERR_CANCELED" }));
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
          timer = setTimeout(() => activeController.abort(), timeoutMs);
        }),
      ]);
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  };
  const fetchValue = async () => parse(await request((_, config) => read(config)));
  const begin = () => { generation += 1; controller?.abort(); controller = new AbortController(); return generation; };
  const confirmed = (value, message) => emit({ status: "saved", value: copy(value), confirmed: copy(value), message });
  const verifyResult = async ticket => {
    try {
      const value = await fetchValue();
      if (ticket !== generation) return false;
      if (matches(payload(value), pending)) { pending = null; confirmed(value, "Cambios guardados y verificados con el servidor."); return true; }
    } catch { if (ticket !== generation) return false; }
    emit({ status: "uncertain", message: "El resultado del guardado no está confirmado. No se ha declarado éxito. Comprueba el resultado antes de continuar." });
    return false;
  };
  const resource = {
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    canEdit: editable,
    canSave: () => !!write && editable() && valid(state.value),
    edit: updater => { if (editable()) emit({ value: typeof updater === "function" ? updater(copy(state.value)) : copy(updater), status: "ready", message: "" }); },
    cancel: () => { generation += 1; controller?.abort(); },
    async load() {
      if (locked) return false;
      const ticket = begin(); emit({ status: "loading", message: "" });
      try {
        const value = await fetchValue();
        if (ticket !== generation) return false;
        pending = null; emit({ status: "ready", value, confirmed: copy(value), message: "" }); return true;
      } catch {
        if (ticket === generation) emit({ status: "load-error", message: "No se pudo cargar información válida. Los datos que pudieran verse no están actualizados; guardar está bloqueado." });
        return false;
      }
    },
    async save() {
      if (locked || !resource.canSave()) return false;
      locked = true; const ticket = begin(); pending = payload(state.value); emit({ status: "saving", message: "Guardando cambios…" });
      try {
        const value = parse(await request(write, copy(pending)));
        if (ticket !== generation) return false;
        if (!matches(payload(value), pending)) return await verifyResult(ticket);
        pending = null; confirmed(value, "Cambios guardados correctamente."); return true;
      } catch (error) {
        if (ticket !== generation) return false;
        if ([400, 401, 403, 404, 409, 422].includes(error.response?.status)) {
          pending = null; emit({ status: "save-error", message: error.response?.data?.message || "No se pudieron guardar los cambios. Se conserva el borrador." }); return false;
        }
        return await verifyResult(ticket);
      } finally { locked = false; }
    },
    async verify() {
      if (locked || !pending || state.status !== "uncertain") return false;
      locked = true; const ticket = begin(); emit({ status: "verifying", message: "Comprobando el resultado…" });
      try { return await verifyResult(ticket); } finally { locked = false; }
    },
  };
  return resource;
}
