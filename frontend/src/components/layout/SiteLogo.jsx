"use client";

import Link from "next/link";
import { useState } from "react";
import { useSiteConfig } from "@/context/SiteConfigContext";

// Logo horizontal por defecto. Pegar el archivo en: frontend/public/images/
const DEFAULT_LOGO = "/images/logo-dizor-horizontal.png";

/**
 * Logo del navbar: muestra la imagen (URL de la BBDD o el asset por defecto).
 * Si la imagen no carga (BBDD vacía, archivo faltante o error de red),
 * cae de forma automática al nombre del sitio en texto.
 */
export default function SiteLogo({ active = false }) {
  const { siteName, logoUrl } = useSiteConfig();
  const [imgFailed, setImgFailed] = useState(false);

  const src = logoUrl || DEFAULT_LOGO;
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
