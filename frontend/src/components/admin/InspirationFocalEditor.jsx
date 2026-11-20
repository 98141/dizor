"use client";

import { useRef, useState } from "react";
import { focusPosition } from "@/lib/inspirationLayout";

function clampPercent(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Punto de enfoque de una foto de Inspiración + vista previa en los marcos
 * reales que tendrá en escritorio y móvil según su posición.
 *
 * @param {{
 *   src: string,
 *   focalX: number|null,
 *   focalY: number|null,
 *   onChange: (x: number|null, y: number|null) => void,
 *   onRatio?: (ratio: number) => void,
 *   previews: { key: string, label: string, ratio: number, width: number }[],
 *   idPrefix: string,
 *   disabled?: boolean,
 * }} props
 */
export default function InspirationFocalEditor({
  src,
  focalX,
  focalY,
  onChange,
  onRatio,
  previews,
  idPrefix,
  disabled = false,
}) {
  const imgRef = useRef(null);
  const dragging = useRef(false);
  const [loadedSrc, setLoadedSrc] = useState("");
  const loaded = loadedSrc === src;
  const x = Number.isFinite(focalX) ? focalX : 50;
  const y = Number.isFinite(focalY) ? focalY : 50;
  const position = focusPosition(focalX, focalY);
  const isCentered = !Number.isFinite(focalX) && !Number.isFinite(focalY);

  const setFromPointer = (event) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;
    onChange(
      clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      clampPercent(((event.clientY - rect.top) / rect.height) * 100)
    );
  };

  const setAxis = (axis, raw) => {
    const value = raw === "" ? null : clampPercent(Number(raw));
    if (axis === "x") onChange(value, Number.isFinite(focalY) ? focalY : 50);
    else onChange(Number.isFinite(focalX) ? focalX : 50, value);
  };

  return (
    <div className="focal-editor">
      <p className="focal-editor__hint">
        Toca o arrastra sobre la foto para elegir el punto que debe quedar
        siempre visible al recortarla.
      </p>
      <div
        className={`focal-editor__picker${disabled ? " is-disabled" : ""}`}
        onPointerDown={(e) => {
          if (disabled) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setFromPointer(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="focal-editor__image"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) onRatio?.(w / h);
            setLoadedSrc(src);
          }}
        />
        <span
          className="focal-editor__marker"
          style={{ left: `${x}%`, top: `${y}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="focal-editor__controls">
        <label className="focal-editor__field" htmlFor={`${idPrefix}-fx`}>
          Horizontal (%)
          <input
            id={`${idPrefix}-fx`}
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            className="auth-field__input"
            value={Number.isFinite(focalX) ? focalX : ""}
            placeholder="50"
            disabled={disabled}
            onChange={(e) => setAxis("x", e.target.value)}
          />
        </label>
        <label className="focal-editor__field" htmlFor={`${idPrefix}-fy`}>
          Vertical (%)
          <input
            id={`${idPrefix}-fy`}
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            className="auth-field__input"
            value={Number.isFinite(focalY) ? focalY : ""}
            placeholder="50"
            disabled={disabled}
            onChange={(e) => setAxis("y", e.target.value)}
          />
        </label>
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={disabled || isCentered}
          onClick={() => onChange(null, null)}
        >
          Centrar
        </button>
      </div>

      {!loaded ? (
        <p className="focal-editor__note" role="status">
          Cargando la foto para calcular sus marcos…
        </p>
      ) : null}
      <div className="focal-editor__previews" aria-label="Vista previa del encuadre">
        {previews.map((p) => (
          <figure key={p.key} className="focal-editor__preview">
            <div
              className="focal-editor__frame"
              style={{ width: p.width, aspectRatio: String(p.ratio) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ objectPosition: position }} />
            </div>
            <figcaption>{p.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
