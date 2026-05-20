import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found__inner">
        <p className="not-found__code">404</p>
        <h1 className="not-found__title">Página no encontrada</h1>
        <p className="not-found__text">
          La página que buscas no existe o fue movida a otra dirección.
        </p>
        <div className="not-found__actions">
          <Link href="/" className="not-found__btn-primary">
            Ir al inicio
          </Link>
          <Link href="/catalogo" className="not-found__btn-secondary">
            Ver catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
