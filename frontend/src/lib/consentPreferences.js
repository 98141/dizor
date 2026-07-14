"use client";

import { useSyncExternalStore } from "react";
import { grantAnalyticsConsent, denyAnalyticsConsent } from "@/lib/analytics/consent";

// Registro estructurado de preferencias de cookies (Sprint 4). No reemplaza
// el adaptador técnico de analítica del Sprint 3 (src/lib/analytics/consent.js)
// — lo orquesta: guardar preferencias aquí llama a
// grantAnalyticsConsent()/denyAnalyticsConsent() para que Analytics
// reaccione (Sprint 3 sigue siendo el único lugar que sabe de gtag).
//
// Solo se guarda: la decisión (por categoría), fecha y versión de la
// política. Nunca datos personales.

const STORAGE_KEY = "dizor_cookie_preferences";
// Subir este valor si cambia sustancialmente la política de cookies:
// invalida las decisiones ya guardadas y vuelve a mostrar el banner.
export const CONSENT_VERSION = "1";

let preferences = null; // null = todavía sin decisión guardada (o versión obsoleta)
const listeners = new Set();

function loadStoredPreferences() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(record) {
  if (typeof window === "undefined") return;
  try {
    if (record) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage no disponible (modo privado, cuotas, etc.) — no bloquear
  }
}

function setPreferences(record) {
  preferences = record;
  persist(record);
  listeners.forEach((cb) => {
    try {
      cb(preferences);
    } catch {
      // un listener roto no debe afectar a los demás
    }
  });
}

if (typeof window !== "undefined") {
  preferences = loadStoredPreferences();
}

export function getStoredPreferences() {
  return preferences;
}

export function hasValidStoredDecision() {
  return preferences != null;
}

export function subscribeToPreferencesChanges(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function usePreferences() {
  return useSyncExternalStore(subscribeToPreferencesChanges, getStoredPreferences, () => null);
}

// marketing queda fijo en false: no existe ninguna integración de marketing
// todavía, así que nunca se persiste como aceptado bajo ninguna circunstancia.
export function savePreferences({ analytics }) {
  const record = {
    analytics: Boolean(analytics),
    marketing: false,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  setPreferences(record);
  if (record.analytics) {
    grantAnalyticsConsent();
  } else {
    denyAnalyticsConsent();
  }
}

export function acceptAllPreferences() {
  savePreferences({ analytics: true });
}

export function rejectAllPreferences() {
  savePreferences({ analytics: false });
}

// Retira el consentimiento por completo: borra la decisión guardada (el
// banner vuelve a aparecer) y desactiva Analytics de inmediato.
export function withdrawConsent() {
  setPreferences(null);
  denyAnalyticsConsent();
}

// ─── Estado del panel de preferencias ──────────────────────────────────────
// Permite abrir/cerrar el mismo panel desde árboles de componentes distintos
// (el banner y el enlace "Configurar cookies" del footer) sin Context nuevo,
// con el mismo patrón de store externo que ya usa consent.js del Sprint 3.
let panelOpen = false;
const panelListeners = new Set();

function notifyPanel() {
  panelListeners.forEach((cb) => {
    try {
      cb(panelOpen);
    } catch {
      // no propagar errores de un listener a los demás
    }
  });
}

export function openConsentPanel() {
  panelOpen = true;
  notifyPanel();
}

export function closeConsentPanel() {
  panelOpen = false;
  notifyPanel();
}

export function subscribeToPanelState(callback) {
  panelListeners.add(callback);
  return () => panelListeners.delete(callback);
}

export function useConsentPanelOpen() {
  return useSyncExternalStore(subscribeToPanelState, () => panelOpen, () => false);
}
