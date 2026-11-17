"use client";

import Link from "next/link";

/**
 * Casilla de autorización con el texto exacto servido por el backend (H-03).
 * - Nunca viene marcada por defecto: el estado lo controla el formulario.
 * - Si el aviso no cargó, no se muestra casilla y el formulario debe impedir
 *   el envío (ver `isNoticeReady`).
 * - El texto es el definitivo publicado; la revisión jurídica se gestiona
 *   internamente (docs/auditoria-privacidad/07-…) y no se muestra al público.
 */
export function isNoticeReady(notices, purpose) {
  const n = notices?.[purpose];
  return Boolean(n && n.label && n.status !== "missing");
}

export default function ConsentCheckbox({
  notices,
  noticesError = false,
  purpose,
  checked,
  onChange,
  id,
  compact = false,
}) {
  const notice = notices?.[purpose];
  const inputId = id || `consent-${purpose}`;

  if (noticesError) {
    return (
      <p className="consent-check__error" role="alert">
        No se pudo cargar el aviso de privacidad. Recarga la página para continuar.
      </p>
    );
  }

  if (!notice) {
    return <p className="consent-check__loading">Cargando aviso de privacidad…</p>;
  }

  if (notice.status === "missing" || !notice.label) return null;

  return (
    <div className={`consent-check${compact ? " consent-check--compact" : ""}`}>
      <input
        id={inputId}
        type="checkbox"
        className="consent-check__input"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        required={Boolean(notice.required)}
      />
      <label htmlFor={inputId} className="consent-check__label">
        {notice.label}{" "}
        <Link href={notice.policyPath || "/politica-de-privacidad"} target="_blank">
          {notice.policyPath === "/terminos-y-condiciones" ? "Ver términos" : "Ver política"}
        </Link>
        {notice.required ? null : <span className="consent-check__optional"> (opcional)</span>}
      </label>
    </div>
  );
}
