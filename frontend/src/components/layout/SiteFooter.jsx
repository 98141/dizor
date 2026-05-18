import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__brand">Dizor</p>
          <p style={{ opacity: 0.85, fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Sombreros artesanales en palma de iraca · Sandoná, Nariño, Colombia
          </p>
        </div>

        <div className="site-footer__grid">
          <div>
            <strong style={{ display: "block", marginBottom: "0.75rem" }}>
              Tienda
            </strong>
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/catalogo?featured=true">Destacados</Link>
          </div>
          <div>
            <strong style={{ display: "block", marginBottom: "0.75rem" }}>
              Ayuda
            </strong>
            <Link href="/login">Mi cuenta</Link>
            <Link href="/seguimiento">Seguimiento de pedido</Link>
            <a href="https://wa.me/573000000000" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </div>
          <div>
            <strong style={{ display: "block", marginBottom: "0.75rem" }}>
              Legal
            </strong>
            <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              Políticas — próximamente
            </span>
          </div>
        </div>

        <p className="site-footer__copy">
          © {new Date().getFullYear()} Dizor. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
