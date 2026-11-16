"use client";

import { useSyncExternalStore } from "react";
import { grantAnalyticsConsent, denyAnalyticsConsent } from "@/lib/analytics/consent";
import { CONSENT_VERSION, readValidRecord, writeRecord } from "@/lib/consentRecord";
import { isAnalyticsConfigured } from "@/lib/analytics/config";

// Registro estructurado de preferencias de cookies. Orquesta el adaptador
// técnico de analítica (src/lib/analytics/consent.js), que deriva su estado
// de este mismo registro versionado (H-07): una sola fuente de verdad.
//
// Solo se guarda: la decisión (por categoría), fecha y versión de la
// política. Nunca datos personales.

export { CONSENT_VERSION };

let preferences = null; // null = todavía sin decisión guardada (o versión obsoleta)
const listeners = new Set();

function setPreferences(record) {
  preferences = record;
  writeRecord(record);
  listeners.forEach((cb) => {
    try {
      cb(preferences);
    } catch {
      // un listener roto no debe afectar a los demás
    }
  });
}

if (typeof window !== "undefined") {
  preferences = readValidRecord();
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
    // Sin un servicio de analítica configurado no hay nada que aceptar
    // (H-09): la categoría se guarda siempre como no aceptada.
    analytics: Boolean(analytics) && isAnalyticsConfigured(),
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
