"use client";

import Link from "next/link";

export default function Error({ reset }) {
  return (
    <div className="not-found">
      <div className="not-found__inner">
        <p className="not-found__code">⚠</p>
        <h1 className="not-found__title">Algo salió mal</h1>
        <p className="not-found__text">
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al
          inicio.
        </p>
        <div className="not-found__actions">
          <button
            type="button"
            onClick={() => reset()}
            className="not-found__btn-primary"
          >
            Reintentar
          </button>
          <Link href="/" className="not-found__btn-secondary">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
