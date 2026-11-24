// Analytic period of the admin home. The URL uses Spanish keys (?periodo=7d) and the
// API uses its own contract (period=7d). Operational tasks never depend on it.
export const PERIOD_OPTIONS = [
  { url: "hoy", api: "today", label: "Hoy" },
  { url: "7d", api: "7d", label: "7 días" },
  { url: "30d", api: "30d", label: "30 días" },
  { url: "mes", api: "month", label: "Este mes" },
  { url: "personalizado", api: "custom", label: "Personalizado" },
];
export const DEFAULT_PERIOD = "30d";
export const PERIOD_STORAGE_KEY = "dizor.dashboard.period";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "America/Bogota";

export const todayInBogota = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export const shiftDate = (key, days) => new Date(Date.parse(`${key}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Reads the URL. Invalid values fall back to the default instead of failing the page. */
export function readPeriod(params) {
  const option = PERIOD_OPTIONS.find((o) => o.url === params.get("periodo")) || PERIOD_OPTIONS.find((o) => o.url === DEFAULT_PERIOD);
  if (option.api !== "custom") return { option, from: "", to: "" };
  const from = params.get("desde") || "", to = params.get("hasta") || "";
  if (!DATE.test(from) || !DATE.test(to) || from > to) return { option: PERIOD_OPTIONS.find((o) => o.url === DEFAULT_PERIOD), from: "", to: "" };
  return { option, from, to };
}
export const apiParams = ({ option, from, to }) => option.api === "custom" ? { period: "custom", from, to } : { period: option.api };
export const periodQuery = ({ option, from, to }) => {
  const q = new URLSearchParams({ periodo: option.url });
  if (option.api === "custom") { q.set("desde", from); q.set("hasta", to); }
  return q.toString();
};
export function validateRange(from, to, today = todayInBogota()) {
  if (!DATE.test(from) || !DATE.test(to)) return "Indica ambas fechas del rango.";
  if (from > to) return "La fecha inicial debe ser anterior o igual a la final.";
  if (from > today) return "El rango no puede empezar en una fecha futura.";
  if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > 731) return "El rango máximo es de 731 días.";
  return "";
}

const dayFormat = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, day: "numeric", month: "short" });
const dayYearFormat = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const civil = (key) => new Date(`${key}T12:00:00-05:00`);
export const formatCivilDate = (key, withYear = true) => key ? (withYear ? dayYearFormat : dayFormat).format(civil(key)).replace(/\./g, "") : "";
export const formatRange = (from, to) => from === to ? formatCivilDate(from) : `${formatCivilDate(from, from.slice(0, 4) !== to.slice(0, 4))} – ${formatCivilDate(to)}`;

/** Short label for a chart bucket, from the bucket start instant. */
export function bucketLabel(point, granularity, long = false) {
  const d = new Date(point.start);
  if (granularity === "hour") {
    const h = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "numeric", hour12: false }).format(d);
    return long ? `${formatCivilDate(point.key.slice(0, 10))}, ${h}:00–${h}:59` : `${h} h`;
  }
  if (granularity === "month") return new Intl.DateTimeFormat("es-CO", { timeZone: TZ, month: long ? "long" : "short", year: "numeric" }).format(d).replace(/\./g, "");
  const day = long ? dayYearFormat.format(d).replace(/\./g, "") : dayFormat.format(d).replace(/\./g, "").replace(" de ", " ");
  return granularity === "week" ? (long ? `Semana desde ${day}` : day) : day;
}

const compact = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompactCOP = (n) => `$${compact.format(n || 0)}`;
export const formatNumber = (n) => new Intl.NumberFormat("es-CO").format(n || 0);
export const formatPct = (n) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(n))} %`;
