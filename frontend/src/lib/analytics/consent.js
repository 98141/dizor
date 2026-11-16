"use client";

import { useSyncExternalStore } from "react";
import { readValidRecord, removeLegacyKey } from "../consentRecord";

// Adaptador técnico de consentimiento para analítica.
//
// Estado por defecto: DENEGADO. El consentimiento se DERIVA del registro
// versionado de preferencias (lib/consentRecord.js); este módulo ya no
// persiste ninguna clave propia (H-07).
//
// Al pasar de concedido a denegado (rechazo posterior o retirada) se
// eliminan las cookies `_ga*` y, si gtag.js llegó a cargarse en esta página,
// se recarga para descargarlo (H-08).

const PURCHASE_KEY_PREFIX = "dizor_ga_purchase_fired_";

let consentState = false;
const listeners = new Set();

if (typeof window !== "undefined") {
  removeLegacyKey();
  consentState = Boolean(readValidRecord()?.analytics);
}

// Borra las cookies de Google Analytics en el host actual y en sus dominios
// padre (gtag suele escribirlas en el dominio de nivel superior).
export function clearAnalyticsCookies() {
  if (typeof document === "undefined") return [];
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_") || name === "_gid");
  if (names.length === 0) return [];

  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i += 1) {
    domains.push(`.${parts.slice(i).join(".")}`);
  }
  const expired = "Thu, 01 Jan 1970 00:00:00 GMT";
  names.forEach((name) => {
    domains.forEach((domain) => {
      document.cookie = `${name}=; expires=${expired}; path=/${domain ? `; domain=${domain}` : ""}`;
    });
  });
  return names;
}

// Marcas locales que solo existen para la analítica de compras.
function clearAnalyticsLocalMarks() {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PURCHASE_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignorar
  }
}

function isGtagScriptLoaded() {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('script[src*="googletagmanager.com/gtag/js"]'));
}

function setConsentState(granted) {
  const wasGranted = consentState;
  consentState = granted;
  listeners.forEach((cb) => {
    try {
      cb(consentState);
    } catch {
      // un listener roto no debe afectar a los demás
    }
  });

  if (wasGranted && !granted && typeof window !== "undefined") {
    clearAnalyticsCookies();
    clearAnalyticsLocalMarks();
    // gtag.js no se puede "descargar" de una página ya cargada: se recarga
    // para garantizar que deje de ejecutarse.
    if (isGtagScriptLoaded()) {
      window.location.reload();
    }
  }
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

export function useAnalyticsConsent() {
  return useSyncExternalStore(
    subscribeToConsentChanges,
    hasAnalyticsConsent,
    () => false
  );
}
