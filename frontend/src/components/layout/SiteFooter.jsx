import Link from "next/link";
import { getContentPages } from "@/services/cmsService";
import { fetchAppearance, getSiteName } from "@/lib/fetchAppearance";
import { getVisitCount } from "@/services/visitService";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { BUSINESS } from "@/lib/businessInfo";
import VisitCounter from "./VisitCounter";
import TrackedWhatsAppLink from "./TrackedWhatsAppLink";
import CookieSettingsLink from "./CookieSettingsLink";

export default async function SiteFooter() {
  let pages = [];

  try {
    const data = await getContentPages();
            pages = (data.pages || []).filter(
              // "cambios" queda sustituida por /garantias-y-devoluciones.
              (p) =>
                p.showInFooter !== false &&
                p.slug !== "guia-de-tallas" &&
                p.slug !== "cambios" &&
                p.slug !== "envios"
            );
  } catch {
    pages = [];
  }

  const appearance = await fetchAppearance();
  const siteName = getSiteName(appearance);
  const visitTotal = await getVisitCount();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__brand">{siteName}</p>
          <p className="site-footer__tagline">
            Sombreros artesanales en palma de iraca · Sandoná, Nariño, Colombia
          </p>
                  {/* Identificación del vendedor (Ley 1480, art. 50 lit. a). */}
        <div className="site-footer__seller">
          <p>
            {BUSINESS.brand} es una marca de {BUSINESS.legalName} · NIT {BUSINESS.nit}
          </p>
          <p>
            Domicilio registrado: {BUSINESS.registeredAddress} ·{" "}
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> · Atención:{" "}
            {BUSINESS.attentionHours}
          </p>
        </div>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__col">
            <strong className="site-footer__heading">Tienda</strong>
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/catalogo?featured=true">Destacados</Link>
            <Link href="/personalizar">Personalizar</Link>
            <Link href="/pedido-mayor">Por mayor</Link>
          </div>
          <div className="site-footer__col">
            <strong className="site-footer__heading">Ayuda</strong>
            <Link href="/cuenta">Mi cuenta</Link>
            <Link href="/guia-de-tallas">Guía de tallas</Link>
            <Link href="/seguimiento">Seguimiento de pedido</Link>
            <Link href="/solicitud/seguimiento">Mis solicitudes</Link>
            <TrackedWhatsAppLink
              href={getWhatsAppUrl()}
              linkLocation="footer"
              purpose="general_inquiry"
            >
              WhatsApp
            </TrackedWhatsAppLink>
            <CookieSettingsLink />
          </div>
          <div className="site-footer__col">
            <strong className="site-footer__heading">Información</strong>
            {pages.map((p) => (
              <Link key={p.slug} href={`/pagina/${p.slug}`}>
                {p.title}
              </Link>
            ))}
            <Link href="/garantias-y-devoluciones">Garantías, retracto y devoluciones</Link>
            <Link href="/terminos-y-condiciones">Términos y condiciones</Link>
            <Link href="/politica-de-privacidad">Política de privacidad</Link>
            <Link href="/politica-de-cookies">Política de cookies</Link>
            {/* Canal PQR: visible solo cuando el propietario lo habilite (E-2). */}
            {process.env.NEXT_PUBLIC_PQR_ENABLED === "true" && (
              <Link href="/pqr">Peticiones, quejas y reclamos</Link>
            )}
            {/* Enlace a la autoridad de protección al consumidor (Ley 1480,
                art. 50, parágrafo — H-16). Informativo: no implica aval. */}
            <a
              href="https://www.sic.gov.co/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Superintendencia de Industria y Comercio (SIC)
            </a>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copy">
            © {new Date().getFullYear()} Diseño y desarrollo.{" "}
            <a
              href="https://armandomora.com.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Armando Mora. Todos los derechos reservados.
            </a>
          </p>
          <VisitCounter initialTotal={visitTotal} />
        </div>
      </div>
    </footer>
  );
}
