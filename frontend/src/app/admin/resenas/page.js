"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ruta legacy → pestaña Reseñas en Contenido */
export default function ReviewsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/contenido?tab=resenas");
  }, [router]);

  return <p className="auth-loading">Redirigiendo…</p>;
}
