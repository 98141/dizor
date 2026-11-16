"use client";

import { useEffect, useState } from "react";
import { getLegalNotices } from "@/services/legalService";

// Los textos de aviso/autorización vienen del backend (config/legalTexts.js)
// para que el texto mostrado y la versión registrada como evidencia sean
// siempre los mismos (H-03). Se piden una vez por carga de página.
let cache = null;
let inflight = null;

const loadNotices = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getLegalNotices()
      .then((data) => {
        cache = data?.notices || {};
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export function useLegalNotices() {
  const [state, setState] = useState(() => ({
    notices: cache,
    error: false,
  }));

  useEffect(() => {
    if (cache) return undefined;
    let cancelled = false;
    loadNotices()
      .then((notices) => {
        if (!cancelled) setState({ notices, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ notices: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
