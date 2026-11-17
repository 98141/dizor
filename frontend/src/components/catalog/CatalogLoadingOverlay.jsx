"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const APPEAR_DELAY_MS = 200;

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * Capa de espera del catálogo. Cubre el viewport, incluido el encabezado
 * y los controles flotantes, sin tarjeta ni fondo de marca.
 */
export default function CatalogLoadingOverlay({
  label = "Cargando catálogo…",
  restoreFocusRef,
}) {
  const panelRef = useRef(null);
  const isClient = useIsClient();

  useEffect(() => {
    const panel = panelRef.current;
    const explicit = restoreFocusRef?.current;
    const previous =
      explicit instanceof HTMLElement
        ? explicit
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

    const marked = [];
    document.body.childNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (panel && (node === panel || panel.contains(node))) return;
      if (node.hasAttribute("inert")) return;
      node.setAttribute("inert", "");
      node.setAttribute("data-catalog-loading-inert", "");
      marked.push(node);
    });

    return () => {
      marked.forEach((node) => {
        node.removeAttribute("inert");
        node.removeAttribute("data-catalog-loading-inert");
      });
      if (restoreFocusRef) restoreFocusRef.current = null;
      if (
        previous &&
        previous.isConnected &&
        !previous.hasAttribute("disabled")
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [restoreFocusRef]);

  if (!isClient) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="catalog-loading"
      role="status"
      aria-live="polite"
    >
      <span className="catalog-loading__indicator" aria-hidden="true" />
      <p className="catalog-loading__label">{label}</p>
    </div>,
    document.body
  );
}

/** Monta la capa solo si la consulta sigue activa después de un instante. */
export function DelayedCatalogLoading({ active, label, restoreFocusRef }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- oculta la capa en cuanto termina la consulta, sin duración mínima
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;
  return (
    <CatalogLoadingOverlay label={label} restoreFocusRef={restoreFocusRef} />
  );
}
