"use client";

import Link from "next/link";
import { useState } from "react";
import { useSiteConfig } from "@/context/SiteConfigContext";

/**
 * Logo del navbar: imagen de BBDD/CMS si existe.
 * Sin URL (o si falla la carga) → nombre del sitio en texto.
 * No pedir /images/logo-dizor-horizontal.png si el archivo no está en el repo.
 */
export default function SiteLogo({ active = false }) {
  const { siteName, logoUrl } = useSiteConfig();
  const [imgFailed, setImgFailed] = useState(false);

  const src = (logoUrl || "").trim();
  const showImg = Boolean(src) && !imgFailed;

  return (
    <Link
      href="/"
      className={`site-header__logo${active ? " is-active" : ""}${
        showImg ? " site-header__logo--img" : ""
      }`}
      aria-current={active ? "page" : undefined}
      aria-label={siteName}
    >
      {showImg ? (
        // CMS puede servir cualquier host; <img> + onError evita 404 de asset local.
        // eslint-disable-next-line @next/next/no-img-element -- remote/CMS logo fallback
        <img
          src={src}
          alt={siteName}
          className="site-header__logo-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        siteName
      )}
    </Link>
  );
}
