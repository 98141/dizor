"use client";

import Link from "next/link";
import { useState } from "react";
import { useSiteConfig } from "@/context/SiteConfigContext";

const NAVBAR_LOGO = "/logoHorizontal-navbar.png";
const BRAND_FALLBACK = "Dizor";

/**
 * Logo del navbar: usa el recurso horizontal incluido en public.
 * Si el recurso no está disponible, muestra el nombre de la marca en texto.
 */
export default function SiteLogo({ active = false }) {
  const { siteName } = useSiteConfig();
  const [imgFailed, setImgFailed] = useState(false);

  const showImg = !imgFailed;

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
        // El manejo de error habilita el respaldo textual si el asset local no existe.
        // eslint-disable-next-line @next/next/no-img-element -- static local logo with text fallback
        <img
          src={NAVBAR_LOGO}
          alt={siteName}
          className="site-header__logo-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        BRAND_FALLBACK
      )}
    </Link>
  );
}
