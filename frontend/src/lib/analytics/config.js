// Origen único de configuración de Google Analytics 4. No hardcodear el ID
// en ningún otro archivo — siempre leer desde aquí.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

export function isAnalyticsConfigured() {
  return Boolean(GA_MEASUREMENT_ID);
}
