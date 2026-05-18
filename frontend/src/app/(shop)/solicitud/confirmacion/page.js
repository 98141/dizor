"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { REQUEST_TYPE_LABELS } from "@/lib/specialRequestLabels";

function ConfirmacionContent() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const tipo = params.get("tipo");

  return (
    <div className="special-confirm">
      <h1 className="special-page__title">Solicitud recibida</h1>
      <p>
        Tu solicitud de{" "}
        <strong>{REQUEST_TYPE_LABELS[tipo] || "servicio especial"}</strong> fue
        registrada correctamente.
      </p>
      {ref && <p className="special-confirm__number">{ref}</p>}
      <p className="special-page__intro">
        Guarda este número. Te contactaremos por correo o WhatsApp con la
        cotización. Puedes consultar el estado cuando quieras.
      </p>
      <div className="special-confirm__actions">
        <Link href="/solicitud/seguimiento" className="admin-btn admin-btn--primary">
          Consultar estado
        </Link>
        <Link href="/catalogo" className="admin-btn">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

export default function SolicitudConfirmacionPage() {
  return (
    <Suspense fallback={<p className="auth-loading">Cargando…</p>}>
      <ConfirmacionContent />
    </Suspense>
  );
}
