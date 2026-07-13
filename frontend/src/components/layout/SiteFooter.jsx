import Link from "next/link";
import { getContentPages } from "@/services/cmsService";
import { fetchAppearance, getSiteName } from "@/lib/fetchAppearance";
import { getVisitCount } from "@/services/visitService";
import VisitCounter from "./VisitCounter";

export default async function SiteFooter() {
  let pages = [];

  try {
    const data = await getContentPages();
    pages = (data.pages || []).filter((p) => p.showInFooter !== false);
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
        </div>

        <div className="site-footer__grid">
          <div>
            <strong className="site-footer__heading">Tienda</strong>
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/catalogo?featured=true">Destacados</Link>
            <Link href="/personalizar">Personalizar</Link>
            <Link href="/pedido-mayor">Por mayor</Link>
          </div>
          <div>
            <strong className="site-footer__heading">Ayuda</strong>
            <Link href="/cuenta">Mi cuenta</Link>
            <Link href="/seguimiento">Seguimiento de pedido</Link>
            <Link href="/solicitud/seguimiento">Mis solicitudes</Link>
            <a
              href="https://wa.me/573000000000"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
          <div>
            <strong className="site-footer__heading">Información</strong>
            {pages.map((p) => (
              <Link key={p.slug} href={`/pagina/${p.slug}`}>
                {p.title}
              </Link>
            ))}
            {pages.length === 0 && (
              <span className="site-footer__muted">Próximamente</span>
            )}
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
