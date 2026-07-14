import Link from "next/link";

export const metadata = {
  title: "Política de Cookies",
  description:
    "Qué cookies utiliza Dizor, para qué sirven y cómo puedes gestionar tus preferencias.",
  alternates: {
    canonical: "/politica-de-cookies",
  },
};

export default function PoliticaCookiesPage() {
  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / Política de cookies
      </nav>

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">Política de Cookies</h1>
          <p className="content-page__excerpt">
            Esta página describe, de forma real y verificable, qué cookies y
            almacenamiento local usa este sitio.
          </p>
        </div>
      </div>

      <div className="content-page__body">
        <h2 className="content-page__section-title">¿Qué son las cookies?</h2>
        <p className="content-page__body-p">
          Las cookies (y mecanismos equivalentes como el almacenamiento local
          del navegador) son pequeños archivos que un sitio guarda en tu
          dispositivo para recordar información entre visitas, como el
          contenido de tu carrito o tus preferencias.
        </p>

        <h2 className="content-page__section-title">Cookies necesarias</h2>
        <p className="content-page__body-p">
          Se usan siempre, sin necesidad de tu consentimiento, porque el
          sitio no puede funcionar sin ellas:
        </p>
        <ul className="content-page__list">
          <li><code>accessToken</code> / <code>refreshToken</code> — mantienen tu sesión iniciada.</li>
          <li><code>dizor_cart_v1</code> / <code>dizor_coupon_v1</code> — recuerdan el contenido de tu carrito y el cupón aplicado.</li>
          <li><code>dizor_guest_email</code> / <code>dizor_guest_name</code> — solo durante el checkout como invitado, para prellenar datos si creas una cuenta después.</li>
          <li><code>dizor_analytics_consent</code> / <code>dizor_cookie_preferences</code> — recuerdan tu decisión sobre esta misma política de cookies.</li>
          <li><code>dizor_visit_day</code> / <code>dizor_last_visit_day</code> — evitan contar tu visita más de una vez por día en el contador del pie de página.</li>
        </ul>

        <h2 className="content-page__section-title">Cookies analíticas</h2>
        <p className="content-page__body-p">
          Solo se activan si das tu consentimiento explícito desde el banner
          o el panel de preferencias. Usamos Google Analytics 4, que puede
          establecer cookies como <code>_ga</code> y <code>_ga_&lt;id&gt;</code>{" "}
          para distinguir sesiones y medir el uso del sitio de forma
          agregada. No configuramos estas cookies para identificar a una
          persona concreta, y nunca les enviamos tu nombre, correo,
          teléfono, dirección ni el contenido de tus pedidos. Más información
          en la{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            política de privacidad de Google
          </a>
          .
        </p>

        <h2 className="content-page__section-title">Cookies de marketing</h2>
        <p className="content-page__body-p">
          Actualmente no utilizamos ninguna cookie de marketing, publicidad
          ni remarketing (no hay Meta Pixel, Google Ads ni herramientas
          similares). Si en el futuro se incorpora alguna, esta política se
          actualizará antes de activarla.
        </p>

        <h2 className="content-page__section-title">
          Cómo gestionar tus preferencias
        </h2>
        <p className="content-page__body-p">
          Puedes aceptar, rechazar o ajustar las cookies analíticas en
          cualquier momento desde el enlace{" "}
          <strong>&quot;Configurar cookies&quot;</strong> en el pie de
          página del sitio. Rechazar las cookies analíticas no afecta el
          funcionamiento de la tienda, el carrito ni el proceso de compra.
        </p>

        <p className="content-page__body-p">
          <strong>
            [PLACEHOLDER — pendiente de revisión legal: datos de contacto
            formales para consultas sobre esta política]
          </strong>
        </p>
      </div>

      <div className="content-page__back">
        <Link href="/" className="content-page__back-link">
          ← Volver al inicio
        </Link>
      </div>
    </article>
  );
}
