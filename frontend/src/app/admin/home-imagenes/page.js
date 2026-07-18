"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ruta legacy → pestaña Imágenes en Contenido */
export default function HomeImagesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/contenido?tab=imagenes");
  }, [router]);

  return <p className="auth-loading">Redirigiendo…</p>;
}
