"use client";

import { useSyncExternalStore } from "react";

// Adaptador técnico mínimo de consentimiento para analítica. El Sprint 4
// construirá el banner/modal visual; ese banner debe llamar únicamente a
// grantAnalyticsConsent() / denyAnalyticsConsent() de este archivo — no debe
// gestionar su propio estado de consentimiento en paralelo.
//
// Estado por defecto: DENEGADO. Mientras no exista una llamada explícita a
// grantAnalyticsConsent() (persistida), ninguna función de este módulo
// reporta consentimiento otorgado, y por lo tanto ni el script de GA4 se
// monta ni se envía ningún evento (ver AnalyticsTracker.jsx y events.js).

const STORAGE_KEY = "dizor_analytics_consent";

let consentState = false;
const listeners = new Set();

function loadStoredConsent() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function persistConsent(granted) {
  if (typeof window === "undefined") return;
  try {
    if (granted) {
      window.localStorage.setItem(STORAGE_KEY, "granted");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage no disponible (modo privado, cuotas, etc.) — no bloquear
  }
}

function setConsentState(granted) {
  consentState = granted;
  persistConsent(granted);
  listeners.forEach((cb) => {
    try {
      cb(consentState);
    } catch {
      // un listener roto no debe afectar a los demás
    }
  });
}

// Hidratar el estado en memoria desde localStorage la primera vez que se
// importa este módulo en el navegador.
if (typeof window !== "undefined") {
  consentState = loadStoredConsent();
}

export function hasAnalyticsConsent() {
  return consentState;
}

export function grantAnalyticsConsent() {
  setConsentState(true);
}

export function denyAnalyticsConsent() {
  setConsentState(false);
}

export function subscribeToConsentChanges(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Hook reactivo para componentes cliente (ej. AnalyticsTracker) que deben
// volver a renderizar cuando el consentimiento cambie (p. ej. cuando el
// Sprint 4 conecte el banner a grantAnalyticsConsent()). Se suscribe a un
// store externo a React (este módulo), por eso usa useSyncExternalStore en
// vez de useState+useEffect.
export function useAnalyticsConsent() {
  return useSyncExternalStore(
    subscribeToConsentChanges,
    hasAnalyticsConsent,
    () => false
  );
}
