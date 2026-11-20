"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado mínimo compartido con el botón flotante de WhatsApp, que vive en
 * el layout y no conoce la página. Lo usa la PDP para:
 * - `message`: consulta con el nombre real del producto (null = mensaje general).
 * - `yieldTo`: ceder el espacio (ocultarse) mientras el botón de compra pasa
 *   por la esquina inferior, o subir por encima de la barra de compra móvil.
 * Sin estado en servidor: el SSR siempre usa el mensaje general.
 */
const DEFAULT_STATE = Object.freeze({ message: null, yieldTo: null, offset: 0 });
let state = DEFAULT_STATE;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

export function setWhatsAppContext(patch) {
  const next = { ...state, ...patch };
  if (
    next.message === state.message &&
    next.yieldTo === state.yieldTo &&
    next.offset === state.offset
  ) {
    return;
  }
  state = next;
  emit();
}

export function resetWhatsAppContext() {
  if (state === DEFAULT_STATE) return;
  state = DEFAULT_STATE;
  emit();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useWhatsAppContext() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DEFAULT_STATE
  );
}
